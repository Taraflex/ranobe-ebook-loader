import dayjs from 'dayjs';
import pMap from 'p-map';

import { progress } from '../stores';
import { downloadImage, getElements, http, ImageInfoMap, parse } from '../utils';
import { concurrency, Base, Chapter } from './Base';

const fetchJson = http('https://xn--80ac9aeh6f.xn--p1ai/api/v2/books/');

export class Ranobe extends Base {
    public static readonly spa = true;
    public static readonly component = 'Link Link_size_md Link_bordered Link_hover_filled BookPageActions__action';
    public static readonly color = (a: number) => `rgba(48,55,69,${a})`;

    public static get injectTarget(): HTMLElement {
        return document.getElementsByClassName('BookPageActions__actions')[0] as any;
    }

    public readonly bookAlias = location.pathname.split('/', 2).find(Boolean);
    public readonly homePage = `https://xn--80ac9aeh6f.xn--p1ai/${this.bookAlias}/`;

    async parts(ctrl: AbortController, cache: ImageInfoMap, mapper: (v: Chapter) => Promise<Chapter>) {
        const { fullTitle, titleEn, genres, author, description, createTime, title, images, country } = await fetchJson(this.bookAlias, ctrl.signal);

        this.covers = [images.vertical.find(b => b.processor === 'bookMain').url];
        this.d = dayjs(createTime);
        this.genres = genres.map(a => a.title);
        this.title = title;
        this.subtitle = [fullTitle, titleEn].filter(Boolean).join(' • ');
        this.description = description || '';
        this.lang = country?.code;
        this.authors = [author].filter(Boolean);

        const { bookAlias } = this;
        const items = ((await fetchJson(bookAlias + '/chapters', ctrl.signal)).items as { slug: string, hasUserPaid: boolean, availabilityStatus: string }[]).filter(i => i.hasUserPaid || i.availabilityStatus === "free").reverse();

        progress.total = items.length;

        return pMap(
            items,
            async ({ slug }) => {
                try {
                    const { title, text: { text } } = await fetchJson(bookAlias + '/chapters/' + slug, ctrl.signal);
                    if (text.includes('<img ')) {
                        const doc = parse(text);
                        for (const img of getElements(doc, 'img')) {
                            await downloadImage(title, img.src, cache, ctrl);
                        }
                        doc.open();
                    }
                    progress.inc();
                    return mapper ? await mapper({ title, text }) : { title, text };
                } catch (e) {
                    ctrl.abort();
                    throw e;
                }
            },
            { concurrency }
        );
    }
}
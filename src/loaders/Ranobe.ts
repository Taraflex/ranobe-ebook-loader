import dayjs from 'dayjs';
import pMap from 'p-map';
import { concurrency, http, ImageInfoMap, downloadImage, parse } from '../utils';
import { Base } from './Base';

const fetchJson = http('https://xn--80ac9aeh6f.xn--p1ai/api/v2/books/');

export class Ranobe extends Base {
    public static readonly spa = true;
    public static readonly component = 'Link Link_size_md Link_bordered Link_hover_filled BookPageActions__action';
    public static readonly color = (a: number) => `rgba(48,55,69,${a})`;

    /*public static async injectTarget(signal: AbortSignal): Promise<Element | null> {
        return signal.aborted ? null : document.querySelector('.BookPageActions__actions') || new Promise(fullfil => {
            const { resolve, promise } = waitEvents<Element>([signal, 'abort'], [window, 'pushState', 'replaceState', 'popstate']);
            promise.then(info => {
                observer.disconnect();
                fullfil(info);
            });
            const observer = new MutationObserver(() => {
                const t = document.querySelector('.BookPageActions__actions');
                t && resolve(t);
            });
            observer.observe(document.getElementById('root'), { childList: true, subtree: true });
        })
    }*/
    public static get injectTarget(): HTMLElement {
        return document.getElementsByClassName('BookPageActions__actions')[0] as any;
    }

    public readonly bookAlias = location.pathname.split('/', 2).find(Boolean);
    public readonly homePage = `https://xn--80ac9aeh6f.xn--p1ai/${this.bookAlias}/`;

    async init({ signal }: AbortController) {
        const { fullTitle, titleEn, genres, author, description, createTime, title, images, country } = await fetchJson(this.bookAlias, signal);

        this.covers = [images.vertical.find(b => b.processor === 'bookMain').url];
        this.d = dayjs(createTime);
        this.genres = genres.map(a => a.title);
        this.title = title;
        this.subtitle = [fullTitle, titleEn].filter(Boolean).join(' • ');
        this.description = description || '';
        this.lang = country?.code;
        this.authors = [author].filter(Boolean);
    }

    async parts(ctrl: AbortController, cache: ImageInfoMap) {
        const { bookAlias } = this;
        const { items } = await fetchJson(bookAlias + '/chapters', ctrl.signal);

        return pMap(
            (items as { slug: string, hasUserPaid: boolean, availabilityStatus: string }[]).filter(i => i.hasUserPaid || i.availabilityStatus === "free").reverse(),
            async ({ slug }, i) => {
                try {
                    const { title, text: { text } } = await fetchJson(bookAlias + '/chapters/' + slug, ctrl.signal);
                    if (text.includes('<img ')) {
                        const doc = parse(text);
                        for (let img of Array.from(doc.getElementsByTagName('img'))) {
                            await downloadImage(title, img.src, cache, ctrl);
                        }
                        doc.open();
                    }
                    this.progress(i, items.length);
                    return { title, text };
                } catch (e) {
                    ctrl.abort();
                    throw e;
                }
            },
            { concurrency }
        );
    }
}
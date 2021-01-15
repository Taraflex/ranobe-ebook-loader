import dayjs from 'dayjs';
import pMap from 'p-map';

import { progress } from '../stores';
import { sanitizeFilename } from '../string-utils';
import { downloadImage, http, ImageInfoMap, parse, getElements } from '../utils';
import { concurrency, Base, Chapter } from './Base';

const months = {
    'янв': 'jan',
    'фев': 'feb',
    'мар': 'mar',
    'апр': 'apr',
    'мая': 'may',
    'июн': 'jun',
    'июл': 'jul',
    'авг': 'aug',
    'сен': 'sep',
    'окт': 'oct',
    'ноя': 'nov',
    'дек': 'dec'
}

function parseDate(s: string) {
    return dayjs(s.replace(/(янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)[а-я]*/i, (_, m) => months[m]).replace(/[^\w:\+\s]+/g, '').replace(/\s+/g, ' '));
}

const fetchJson = http('');

export class Rulate extends Base {

    private readonly chapterElements: HTMLAnchorElement[] = Array.from(document.querySelectorAll('#Chapters .btn-info'));

    public static readonly component = 'btn btn-info';
    public static readonly color = (a: number) => `rgba(0,85,128,${a})`;

    public static get injectTarget(): HTMLElement {
        return document.querySelector('#Info > .btn-toolbar');
    }

    async parts(ctrl: AbortController, cache: ImageInfoMap, mapper: (v: Chapter) => Promise<Chapter>) {

        const info = document.getElementById('Info');
        //icecream ebook reader не умеет не jpeg на обложку, поэтому отсортируем чтобы jpeg был первым
        this.covers = Array.from(info.querySelectorAll('.slick img') as NodeListOf<HTMLImageElement>, i => i.src);
        const j = this.covers.find(s => /\.jpe?g($|\?)/i.test(s));
        if (j) {
            this.covers.unshift(j);
        }
        this.covers = Array.from(new Set(this.covers));
        this.d = parseDate(this.chapterElements[this.chapterElements.length - 1].parentElement.previousElementSibling.previousElementSibling.firstElementChild.getAttribute('title'));
        this.genres = Array.from(document.querySelectorAll('.info a[href^="/search?genres"]'), a => a.textContent);
        this.keywords = Array.from(document.querySelectorAll('.info a[href^="/search?tags"]'), a => a.textContent).join(', ');
        this.subtitle = this.extractTitle(document);
        this.title = this.subtitle.substring(this.subtitle.lastIndexOf(' / ') + 3);
        this.description = info.querySelector('.btn-toolbar + .clear + div').innerHTML;;
        //todo this.lang = undefined;
        this.authors = Array.from(document.getElementById('Info').querySelectorAll('a[href^="/search?from=book&t="]')).filter(e => e.parentElement.previousElementSibling.textContent === 'Автор:').map((a: HTMLAnchorElement) => ({ name: a.textContent, homePage: a.href }));

        this.bookAlias = sanitizeFilename(this.title);

        progress.total = this.chapterElements.length;
        return pMap(
            this.chapterElements.map(a => a.href),
            async url => {
                try {
                    let { title, content: text } = await fetchJson(url.replace(/_new$/, '') + 'ajax?is_new=true', ctrl.signal);
                    text = text.split(/<div class="content-text" style="word-wrap: break-word;">|<p>https?:\/\/tl\.rulate\.ru\/book\//, 3)[1]
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
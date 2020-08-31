import dayjs from 'dayjs';
import pMap from 'p-map';
import { sanitizeFilename, concurrency, ImageInfoMap, downloadImage, parse, http } from '../utils';
import { Base } from './Base';

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

    async init(_: AbortController) {
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
        let dtext = '';
        let d = info.querySelector('.btn-toolbar + p');
        while (d) {
            dtext += d.outerHTML;
            d = d.nextElementSibling;
            if (d && d.tagName === 'H2') {
                d = null;
            }
        }
        this.description = dtext;
        //todo this.lang = undefined;
        this.authors = Array.from(document.getElementById('Info').querySelectorAll('a[href^="/search?from=book&t="]')).filter(e => e.parentElement.previousElementSibling.textContent === 'Автор:').map((a: HTMLAnchorElement) => ({ name: a.textContent, homePage: a.href }));

        this.bookAlias = sanitizeFilename(this.title);
    }

    async parts(ctrl: AbortController, cache: ImageInfoMap) {
        return pMap(
            this.chapterElements.map(a => a.href),
            async (url, i) => {
                try {
                    let { title, content } = await fetchJson(url.replace(/_new$/, '') + 'ajax?is_new=true', ctrl.signal);
                    content = content.split(/<div class="content-text" style="word-wrap: break-word;">|<p>https?:\/\/tl\.rulate\.ru\/book\//, 3)[1]
                    if (content.includes('<img ')) {
                        const doc = parse(content);
                        for (let img of Array.from(doc.getElementsByTagName('img'))) {
                            await downloadImage(title, img.src, cache, ctrl);
                        }
                        doc.open();
                    }
                    this.progress(i, this.chapterElements.length);
                    return { title, text: content };
                } catch (e) {
                    ctrl.abort();
                    throw e;
                }
            },
            { concurrency }
        );
    }
}
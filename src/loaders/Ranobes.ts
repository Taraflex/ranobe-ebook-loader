import dayjs from 'dayjs';
import pMap from 'p-map';
import { concurrency, loadDom, downloadImage, ImageInfoMap } from '../utils';
import { Base } from './Base';

export class Ranobes extends Base {

    public static readonly component = 'btn btn-block';
    public static readonly color = (a: number) => `rgba(149,172,124,${a})`;

    public static get injectTarget(): HTMLElement {
        return document.getElementById('mc-fs-rate');
    }

    async init(_: AbortController) {
        this.bookAlias = (document.querySelector('.r-fullstory-chapters-foot > a:nth-child(3n)') as HTMLAnchorElement).href.split('/', 5).slice(-1)[0];
        this.covers = [(document.querySelector('[itemprop="image"]') as HTMLAnchorElement).href];
        this.d = dayjs(document.querySelector('[itemprop="datePublished"]').getAttribute('content'));
        this.genres = Array.from(document.querySelectorAll('[itemprop="genre"] a'), a => a.textContent);
        this.keywords = Array.from(document.querySelectorAll('[itemprop="keywords"] a'), a => a.textContent).join(', ');
        this.title = this.extractTitle(document);
        this.subtitle = document.querySelector('[itemprop="alternateName"]').textContent;
        this.description = document.querySelector('[itemprop="description"]').innerHTML;
        //todo this.lang = undefined;
        this.authors = Array.from(document.querySelectorAll('[itemprop="creator"] a'), (a: HTMLAnchorElement) => ({ name: a.textContent, homePage: a.href }));
    }

    async parts(ctrl: AbortController, cache: ImageInfoMap) {
        const { bookAlias } = this;
        const items: string[] = [];

        for (let pageIndex = 1; ; ++pageIndex) {
            const doc = await loadDom(`https://ranobes.com/chapters/${bookAlias}/page/${pageIndex}/`, ctrl.signal);
            if (!doc) break;
            doc.querySelectorAll(`.cat_block a[href^="https://ranobes.com/chapters/${bookAlias}/"]`).forEach((a: HTMLAnchorElement) => items.push(a.href));
        }

        return pMap(
            items.reverse(),
            async (url, i) => {
                try {
                    let text = '';
                    let title = '';

                    const pages = [url];

                    for (let page of pages) {
                        const doc = await loadDom(page, ctrl.signal);
                        if (!doc) break;
                        const content = doc.getElementById('arrticle')
                        text += content.outerHTML;
                        if (!title) {
                            title = this.extractTitle(doc);
                            const nav = doc.querySelector('.splitnewsnavigation');
                            if (nav) {
                                nav.querySelectorAll(`a[href^="https://ranobes.com/chapters/${bookAlias}/"]`).forEach((a: HTMLAnchorElement) => pages.push(a.href));
                            }
                        }
                        for (let img of Array.from(content.getElementsByTagName('img'))) {
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
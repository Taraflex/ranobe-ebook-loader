import dayjs from 'dayjs';
import pMap from 'p-map';

import { concurrency, loadDom } from '../utils';
import { Base } from './Base';

export class RanobesCom extends Base {
    extractTitle(doc: Document) {
        return doc?.querySelector('h1').firstChild.textContent;
    }

    async init() {
        this.bookAlias = (document.querySelector('.r-fullstory-chapters-foot > a:nth-child(3n)') as HTMLAnchorElement).href.split('/', 5).slice(-1)[0];
        this.cover = (document.querySelector('[itemprop="image"]') as HTMLAnchorElement).href;
        this.d = dayjs(document.querySelector('[itemprop="datePublished"]').getAttribute('content'));
        this.genres = Array.from(document.querySelectorAll('[itemprop="genre"] a')).map(a => a.textContent);
        this.title = this.extractTitle(document);
        this.description = document.querySelector('[itemprop="description"]').innerHTML;
        this.lang = undefined;
        this.authors = Array.from(document.querySelectorAll('[itemprop="creator"] a'))
            .map((a: HTMLAnchorElement) => ({ name: a.textContent, homePage: a.href }))
    }

    get homePage() {
        return location.href;
    }

    async parts() {
        const { bookAlias } = this;

        const items: string[] = [];

        for (let pageIndex = 1; ; ++pageIndex) {
            const doc = await loadDom(`https://ranobes.com/chapters/${bookAlias}/page/${pageIndex}/`);
            if (!doc) break;
            doc.querySelectorAll(`.cat_block a[href^="https://ranobes.com/chapters/${bookAlias}/"]`).forEach((a: HTMLAnchorElement) => items.push(a.href));
        }

        return pMap(
            items.reverse(),
            async (url, i) => {
                let text = '';
                let title = '';

                const pages = [url];

                for (let page of pages) {
                    const doc = await loadDom(page);
                    if (!doc) break;
                    text += doc.getElementById('arrticle').outerHTML;
                    if (!title) {
                        title = this.extractTitle(doc);
                        const nav = doc.querySelector('.splitnewsnavigation');
                        if (nav) {
                            nav.querySelectorAll(`a[href^="https://ranobes.com/chapters/${this.bookAlias}/"]`).forEach((a: HTMLAnchorElement) => pages.push(a.href));
                        }
                    }
                }

                this.progress(i, items.length);
                return { title, text: { text } };
            },
            { concurrency }
        );
    }
}
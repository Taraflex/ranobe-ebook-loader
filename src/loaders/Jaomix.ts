import pMap from 'p-map';

import { progress } from '../stores';
import { sanitizeFilename } from '../string-utils';
import { downloadImage, getElements, ImageInfoMap, loadDom, parseRuDate } from '../utils';
import { Base, Chapter, concurrency } from './Base';

export class Jaomix extends Base {

    public static readonly component = 'lie-but';
    public static readonly color = (a: number) => `rgba(51,51,51,${a})`;

    public static get injectTarget(): HTMLElement {
        return document.getElementsByClassName('link-last-first-chapter')[0] as any;
    }

    async parts(ctrl: AbortController, cache: ImageInfoMap, mapper: (v: Chapter) => Promise<Chapter>) {

        const info = document.getElementsByClassName('box-book')[0];
        this.covers = Array.from(info.querySelectorAll('.img-book img') as NodeListOf<HTMLImageElement>, i => i.src);
        this.d = parseRuDate(info.querySelector('.date-home').textContent);
        const subInfo = Array.from(document.querySelectorAll('#info-book > p'), a => a.textContent);
        this.genres = subInfo.find(s => s.startsWith('Жанры: '))?.substr(7)?.split(', ') || [];
        this.keywords = '';
        this.title = this.extractTitle(document);
        this.subtitle = [this.title, subInfo.find(s => s.startsWith('Название: '))?.substr(10)].filter(Boolean).join(' • ');
        this.description = info.querySelector('#desc-tab').innerHTML;
        //todo this.lang = undefined;
        this.authors = subInfo.filter(s => s.startsWith('Автор: ')).map(a => ({ name: a.substr(7) }));

        this.bookAlias = sanitizeFilename(this.title);

        const termid = info.querySelector('.like-but').id;

        const toc = await loadDom('https://jaomix.ru/wp-admin/admin-ajax.php', ctrl.signal, 'POST', new URLSearchParams({
            action: 'toc',
            selectall: termid
        }).toString());

        const chapters = (await pMap(getElements(toc, 'option'), async ({ value }) => {
            if (value === '0') {
                return Array.from(document.getElementById('open-0').getElementsByTagName('a'), a => a.href);
            } else {
                const page = await loadDom('https://jaomix.ru/wp-admin/admin-ajax.php', ctrl.signal, 'POST', new URLSearchParams({
                    action: 'toc',
                    page: value,
                    termid
                }).toString());
                try {
                    return Array.from(page.getElementsByTagName('a'), a => a.href);
                } finally {
                    page.open();
                }
            }
        }, { concurrency })).flat().reverse();

        toc.open();

        progress.total = chapters.length;

        return pMap(
            chapters,
            async url => {
                try {
                    const doc = await loadDom(url, ctrl.signal);
                    const title = this.extractTitle(doc);
                    const entry = doc.getElementsByClassName('entry')[0] as HTMLElement;

                    for (const img of getElements(entry, 'img')) {
                        await downloadImage(title, img.src, cache, ctrl);
                    }

                    const text = entry.outerHTML;

                    doc.open();

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
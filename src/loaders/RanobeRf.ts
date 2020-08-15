import dayjs from 'dayjs';
import pMap from 'p-map';

import { concurrency, fetchJson } from '../utils';
import { Base } from './Base';

export class RanobeRf extends Base {
    async init() {
        this.bookAlias = location.pathname.split('/', 2).find(Boolean);
        const { genres, author, description, createTime, title, images, country } = await fetchJson(this.bookAlias);

        this.cover = images.vertical.find(b => b.processor === 'bookMain').url;
        this.d = dayjs(createTime);
        this.genres = genres.map(a => a.title);
        this.title = title;
        this.description = description;
        this.lang = country?.code;
        this.authors = [author].filter(Boolean);
    }

    get homePage() {
        return `https://xn--80ac9aeh6f.xn--p1ai/${this.bookAlias}/`;
    }

    async parts() {
        const { bookAlias } = this;
        const { items } = await fetchJson(bookAlias + '/chapters');

        return pMap(
            (items as { slug: string }[]).reverse(),
            async ({ slug }, i) => {
                try {
                    return await fetchJson(bookAlias + '/chapters/' + slug);
                } finally {
                    this.progress(i, items.length);
                }
            },
            { concurrency }
        );
    }
}
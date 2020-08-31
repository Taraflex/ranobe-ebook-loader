import type { Dayjs } from 'dayjs';
import type { ImageInfoMap } from '../utils';

export abstract class Base {
    protected readonly programName = APP_TITLE + ' ' + APP_VERSION;
    protected d: Dayjs;
    public readonly homePage = location.href;
    public bookAlias: string;
    public covers: string[];
    public title: string;
    public subtitle: string;
    public description: string;
    protected keywords: string;
    protected lang: string;
    protected authors: { name: string, homePage?: string }[];
    public genres: string[];

    constructor(protected readonly progress: (i: number, total: number) => void) { }

    date(f: string): string {
        return this.d.format(f);
    }

    get isoDate() {
        return this.d.toISOString().replace('.000', '');
    }

    extractTitle(doc: Document) {
        return doc.querySelector('h1').firstChild.textContent;
    }

    abstract async init(ctrl: AbortController): Promise<void>;
    abstract async parts(ctrl: AbortController, cache: ImageInfoMap): Promise<any[]>;
}
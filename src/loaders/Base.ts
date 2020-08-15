import type { Dayjs } from 'dayjs';

export abstract class Base {
    protected d: Dayjs;
    public bookAlias: string;
    public cover: string;
    public title: string;
    public description: string;
    public lang: string;
    public authors: { name: string, homePage?: string }[];
    public genres: string[];

    constructor(protected readonly progress: (i: number, total: number) => void) { }

    date(f: string): string {
        return this.d.format(f);
    }

    extractTitle(doc: Document) {
        return doc?.querySelector('h1').firstChild.textContent;
    }

    get homePage() {
        return location.href;
    }

    abstract async init(): Promise<void>;
    abstract async parts(): Promise<any[]>;
}
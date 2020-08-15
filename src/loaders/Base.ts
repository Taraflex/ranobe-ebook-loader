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

    abstract async init(): Promise<void>;
    abstract get homePage(): string;
    abstract async parts(): Promise<any[]>;
}
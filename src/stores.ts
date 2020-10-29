import { writable, Writable } from 'svelte/store';

import { stringify } from './string-utils';

function make<T, R>(def: T, cb: (w: Writable<T>) => R) {
    return cb(writable<T>(def));
}

export const notifications = make(new Set<string>(), ({ subscribe, update }) => ({
    subscribe,
    remove: (s: string) => update(n => (n.delete(s), n)),
    add: (s: any) => update(n => n.add(stringify(s))),
    clear: () => update(n => (n.clear(), n))
}));

export const progress = make(0, ({ subscribe, set }) => {
    let total = 0;
    let v = 0;

    return {
        subscribe,
        set total(t: number) {
            total = t;
        },
        inc: () => set((++v) * 100 / total | 0),
        clear: () => v && set(total = v = 0)
    };
});
import { defer } from './defer';

const onceParams = { once: true };
export default function <T>(...sourses: [EventTarget, ...string[]][]) {

    const def = defer<T>();

    function onResolve() {
        for (const [o, ...events] of sourses) {
            for (const e of events) {
                o.removeEventListener(e, onResolve);
            }
        }
        def.resolve(undefined);
    }

    for (const [o, ...events] of sourses) {
        for (const e of events) {
            o.addEventListener(e, onResolve, onceParams);
        }
    }

    return def;
}
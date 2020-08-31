import { defer } from './defer';

const onceParams = { once: true };
export default function <T>(...sourses: [EventTarget, ...string[]][]) {

    const def = defer<T>();

    function onResolve() {
        for (let [o, ...events] of sourses) {
            for (let e of events) {
                o.removeEventListener(e, onResolve);
            }
        }
        def.resolve(undefined);
    }

    for (let [o, ...events] of sourses) {
        for (let e of events) {
            o.addEventListener(e, onResolve, onceParams);
        }
    }

    return def;
}
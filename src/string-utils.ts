const map = {
    '&amp;': '＆',
    '&lt;': '＜',
    '&gt;': '＞',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
} as const;

// https://stackoverflow.com/a/46637835
export function unescapeUnsafe(doc: HTMLDocument, s: string) {
    let title: HTMLTitleElement;
    return s.replace(/&#?[\w\d]+;/g, (m: string) => {
        if (m in map) return map[m];
        if (m[1] === '#') {
            const code = parseInt(m.slice(2), m[2] === 'x' ? 16 : 10);
            switch (code) {
                case 38 /* &amp; */: return '＆';
                case 60 /* &lt; */: return '＜';
                case 62 /* &gt; */: return '＞';
                case 160 /* &nbsp; */: return ' ';
                default: if (code <= 0x10ffff) {
                    return String.fromCodePoint(code);
                }
            }
        }
        if (!title) {
            doc.title = '';
            title = doc.head.querySelector('title');
        }
        title.innerHTML = m;
        return title.innerText;
    });
}

export function lastMatch(s: string, re: RegExp) {
    const m = s && s.match(re);
    return m && m.length > 0 ? m[m.length - 1] : null;
}

export function stringify(o: any): string {
    if (!o || o === !!o || o === +o) return String(o);
    if (o.constructor === String) return o as string;
    if (o.hasOwnProperty('toString') || typeof o === 'symbol') return o.toString();
    if (o.hasOwnProperty('toJSON')) return JSON.stringify(o, null, '  ');
    const info = o.message ? stringify(o.message) : JSON.stringify(o, null, '  ');
    const name = o.name || o.constructor.name;
    return name && name != 'Object' && name != 'Error' ? name + ': ' + info : info;
}

// https://github.com/parshap/node-sanitize-filename/blob/master/index.js

const illegalRe = /[\/\?<>\\:\*\|"]/g;
const controlRe = /[\x00-\x1f\x80-\x9f]/g;
const reservedRe = /^\.+$/;
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const windowsTrailingRe = /[\. ]+$/;
const replacement = '-';

export function sanitizeFilename(input: string) {
    return input
        .replace(illegalRe, replacement)
        .replace(controlRe, replacement)
        .replace(reservedRe, replacement)
        .replace(windowsReservedRe, replacement)
        .replace(windowsTrailingRe, replacement);
}

export const utf8encoder = new TextEncoder();

export async function sha256(s: string | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer) {
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', s.constructor === String ? utf8encoder.encode(s) : s as Exclude<typeof s, string>));
    return '_' + btoa(String.fromCharCode.apply(null, b as any)).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
}
export const concurrency = 5;

const map = {
    //'&amp;': '&',
    '&#x22;': '"',
    '&#34;': '"',
    '&#034;': '"',
    '&quot;': '"',

    '&#x27;': "'",
    '&#39;': "'",
    '&#039;': "'",
    '&apos;': "'",

    // ['#x2F', '/'],
    // ['#47', '/'],
    '&#x60;': '`',
    '&nbsp;': ' ',
    '&#95;': '_'
} as const;

const replaceRegexp = RegExp('(?:' + Object.keys(map).join('|') + ')', 'g');

function unescape(s: string) {
    //@ts-ignore
    return s.replace(replaceRegexp, (m: keyof typeof map) => map[m]);
}

export async function fetchJson(url: string) {
    return (await fetch(
        `https://xn--80ac9aeh6f.xn--p1ai/api/v2/books/` + url,
        { credentials: 'include' }
    )).json();
}

function lastMatch(s: string, re: RegExp) {
    const m = s?.match(re);
    return m && m.length > 0 ? m[m.length - 1] : null;
}

const B64_RE = /^\s*data:([image\/jpnf]+);base64/;

function splitImageBase64(dataUrl: string, mime?: string) {
    return {
        mime: lastMatch(dataUrl, B64_RE) || mime,
        data: dataUrl.slice(dataUrl.indexOf(',') + 1)
    };
}

function toBase64(blob: Blob, mime: string): Promise<{ mime: string, data: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = function () {
            try {
                if (reader.readyState == /*FileReader.DONE*/ 2) {
                    //@ts-ignore
                    resolve(splitImageBase64(reader.result, mime));
                } else {
                    reject(reader.error);
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsDataURL(blob);
    });
}

export async function downloadImage(url: string) {
    if (B64_RE.test(url)) {
        return splitImageBase64(url);
    } else {
        const resp = await fetch(url);
        return toBase64(await resp.blob(), resp.headers.get('content-type') || '');
    }
}

export function parse(text: string, mime?: SupportedType) {
    const doc = new DOMParser().parseFromString(text, mime || 'text/html');
    const err = doc.querySelector('parsererror');
    if (err) {
        throw err.textContent;
    }
    return doc;
}

export async function loadDom(url: string) {
    const resp = await fetch(url, { credentials: 'include' });
    return resp.status === 200 ? parse(await resp.text()) : null;
}

export function replaceTag(doc: Document, elem: Element, tag: string, ns?: string) {
    const t = ns ? doc.createElementNS(ns, tag) : doc.createElement(tag);
    while (elem.firstChild) {
        t.appendChild(elem.firstChild);
    }
    elem.parentNode.replaceChild(t, elem);
    return t;
}

function rndHex() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16);
}

function unwrap(e: Element) {
    while (e.firstChild) {
        e.parentNode.insertBefore(e.firstChild, e);
    }
    e.remove();
}

export function processHtml(raw: string, images: { src: string, id: string }[]): string {
    raw = raw
        //.replace(/>(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '>')
        //.replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+<\//g, '</')
        .replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '</p><p>');

    let doc = parse(raw);

    doc.querySelectorAll('.message-delete,.splitnewsnavigation,script').forEach(e => e.remove());
    doc.querySelectorAll('i,em').forEach(e => replaceTag(doc, e, 'emphasis'));
    doc.querySelectorAll('b').forEach(e => replaceTag(doc, e, 'strong'));
    doc.querySelectorAll('s,strike').forEach(e => replaceTag(doc, e, 'strikethrough'));
    doc.querySelectorAll('.game-message,.quote').forEach(e => replaceTag(doc, e, 'blockquote'));

    doc.querySelectorAll('body :not(header):not(section):not(emphasis):not(strong):not(strikethrough):not(blockquote):not(empty-line):not(sub):not(sup):not(img)').forEach(e => {
        if (e.parentElement.tagName === 'SECTION' || !getComputedStyle(e).display.includes('inline')) {
            replaceTag(doc, e, 'div');
        } else {
            unwrap(e);
        }
    });

    doc = parse(doc.documentElement.outerHTML
        .replace(/<\/?div>/g, '</p><p>')
        .replace(/<(\/)?blockquote>/g, '</p><$1blockquote><p>')
    );

    doc.querySelectorAll('img').forEach(e => {
        const id = '_' + rndHex();
        images.push({ src: e.src, id });
        const i = doc.createElement('image');
        i.setAttribute('l:href', '#' + id);
        e.parentNode.replaceChild(i, e);
    });

    doc.querySelectorAll('blockquote').forEach(e => replaceTag(doc, e, 'cite'));

    doc.querySelectorAll('body :not(image)').forEach(e => {
        while (e.attributes.length > 0) {
            e.removeAttribute(e.attributes.item(0).name);
        }
    });

    return unescape(doc.body.innerHTML).replace(/><\/image>/g, '/>').replace(/(\s*<p>\s*<\/p>\s*)+/g, ' ');
}
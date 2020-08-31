import pMap from 'p-map';
import { writable } from 'svelte/store';

import { defer } from './defer';

export const concurrency = 5;

const { subscribe, update } = writable(new Set<string>());
export const notifications = {
    subscribe,
    remove: (s: string) => update(n => (n.delete(s), n)),
    add: (s: any) => update(n => n.add(stringify(s))),
    clear: () => update(n => (n.clear(), n))
}

export function patchApi(type: string) {
    const orig = history[type];
    return Object.assign(
        function () {
            const rv = orig.apply(this, arguments);
            window.dispatchEvent(new Event(type));
            return rv;
        },
        {
            destroy() {
                history[type] = orig;
            },
        }
    );
}

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
    return s.replace(replaceRegexp, (m: keyof typeof map) => map[m]);
}

export async function loadDom(url: string, signal: AbortSignal) {
    const resp = await fetch(url, { credentials: 'include', signal });
    return resp.status === 200 ? parse(await resp.text()) : null;
}

export async function fetchJson(url: string, signal: AbortSignal) {
    return (await fetch(
        `https://xn--80ac9aeh6f.xn--p1ai/api/v2/books/` + url,
        { credentials: 'include', signal }
    )).json();
}

function lastMatch(s: string, re: RegExp) {
    const m = s && s.match(re);
    return m && m.length > 0 ? m[m.length - 1] : null;
}

const B64_RE = /^\s*data:([image\/jpnfwbpsv]+);base64/;

export interface ImageInfo {
    readonly id: string;
    readonly url: string;
    readonly mime: string;
    readonly ext: string;
    readonly cachedB64: string;
    b64(): string | Promise<string>;
    data(): Uint8Array;
};
export type ImageInfoMap = Map<string, ImageInfo>;

const exts = {
    'image/gif': '.gif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/x-ms-bmp': '.bmp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'image/svg': '.svg',
    'image/webp': '.webp',
    'image/x-xbitmap': '.xbm',
    'image/x-xbm': '.xbm'
} as const;

function fixMime(m: string) {
    return m in exts ? m : 'image/jpeg';
}

async function processB64Url(url: string): Promise<ImageInfo> {
    const mime = fixMime(lastMatch(url, B64_RE));
    const id = await sha256(url);
    const _64 = url.slice(url.indexOf(',') + 1);
    return {
        ext: exts[mime],
        url,
        id,
        mime,
        get cachedB64() {
            return _64;
        },
        b64: () => _64,
        data() {
            const binary_string = atob(_64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; ++i) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes;
        }
    };
}

async function processBlob(url: string, blob: Blob): Promise<ImageInfo> {
    const mime = fixMime(blob.type);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let _64: string;
    return {
        url,
        ext: exts[mime],
        id: await sha256(buf),
        mime,
        get cachedB64() {
            return _64;
        },
        b64() {
            return _64 || new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = async function () {
                    try {
                        if (reader.readyState == /*FileReader.DONE*/ 2) {
                            const dataUrl = reader.result as string;
                            resolve(_64 = dataUrl.slice(dataUrl.indexOf(',') + 1));
                        } else {
                            reject(reader.error);
                        }
                    } catch (e) {
                        reject(e);
                    }
                };
                reader.readAsDataURL(blob);
            });
        },
        data: () => buf
    };
}

async function fetchImage(url: string, cache: ImageInfoMap, signal: AbortSignal): Promise<ImageInfo> {
    let breaker = new AbortController();
    const finallizer = () => {
        signal.removeEventListener('abort', finallizer);
        breaker.abort();
    };
    signal.addEventListener('abort', finallizer, { once: true });
    try {
        if (typeof GM_xmlhttpRequest === 'undefined' || location.host === new URL(url).host) {
            const response = await fetch(url, { credentials: 'include', cache: 'force-cache', referrer: location.href, signal: breaker.signal });
            if (cache.has(url)) return cache.get(url);
            if (response.status >= 400) {
                throw { name: response.statusText, message: response.status }
            }
            if (cache.has(response.url)) return cache.get(response.url);
            return await processBlob(response.url, await response.blob());
        } else {
            const def = defer<Tampermonkey.Response<any>>();

            function _abort(reason: any) {
                def.reject(reason);
                breaker.signal.removeEventListener('abort', abort);
                abort();
            }
            const { abort } = GM_xmlhttpRequest({
                url,
                method: 'GET',
                responseType: 'blob',
                headers: {
                    'Referer': location.href
                },
                onprogress(r) {
                    if (cache.has(url)) return _abort({ name: 'Exist', url });
                    if (cache.has(r.finalUrl)) return _abort({ name: 'Exist', url: r.finalUrl });
                },
                onabort() {
                    _abort({ name: 'AbortError' });
                },
                onerror(r) {
                    _abort(r.error);
                },
                onload(r) {
                    if (r.status >= 400) {
                        _abort({ name: r.statusText, message: r.status })
                    } else {
                        def.resolve(r);
                        breaker.signal.removeEventListener('abort', abort);
                    }
                }
            });

            breaker.signal.addEventListener('abort', abort, { once: true });

            const { finalUrl, response } = await def.promise;
            return await processBlob(finalUrl, response);
        }
    } catch (e) {
        if (e?.name === 'Exist') {
            return cache.get(e.url);
        }
        throw e;
    } finally {
        finallizer();
    }
}

export async function downloadImage(title: string, url: string, cache: ImageInfoMap, ctrl: AbortController) {
    try {
        if (cache.has(url)) return cache.get(url);

        title = (title || '').trim();

        const i = await (B64_RE.test(url) ? processB64Url(url) : fetchImage(url, cache, ctrl.signal));

        if (i) {
            cache.set(url, i);
            cache.set(i.id, i);
            cache.set(i.url, i);
            return i;
        } else if (cache.has(url)) {
            return cache.get(url);
        }
    } catch (e) {
        if (e?.name != 'AbortError') {
            console.error(e);
            notifications.add(`Ошибка загрузки изображения\n${url}\n${title ? `в главе\n"${title}"\n` : ''}${stringify(e)}`);
        }
    }
}

export function parse(text: string, mime?: 'text/html' | 'application/xml') {
    const doc = new DOMParser().parseFromString(text, mime || 'text/html');
    const e = doc.querySelector('parsererror');
    if (e) {
        throw e.textContent;
    }
    return doc;
}

export function replaceTag(doc: Document, elem: Element, tag: string) {
    const t = doc.createElementNS(elem.namespaceURI, tag);
    while (elem.firstChild) {
        t.appendChild(elem.firstChild);
    }
    elem.parentNode.replaceChild(t, elem);
    return t;
}

function unwrap(e: Element) {
    while (e.firstChild) {
        e.parentNode.insertBefore(e.firstChild, e);
    }
    e.remove();
}

function replaceTags(doc: Document, target: string, ...sources: string[]) {
    doc.querySelectorAll(sources.filter(s => s != target).join(',')).forEach(e => replaceTag(doc, e, target));
}

export const formats = {
    FB2: {
        image: 'image',
        emphasis: 'emphasis',
        strong: 'strong',
        strikethrough: 'strikethrough',
        underline: 'strong',
        blockquote: 'cite'
    } as const,
    EPUB: {
        image: 'img',
        emphasis: 'i',
        strong: 'b',
        strikethrough: 's',
        underline: 'u',
        blockquote: 'blockquote'
    } as const,
} as const;

export type EbookFormat = typeof formats.FB2 | typeof formats.EPUB;

export async function processHtml(raw: string, ctrl: AbortController, tags: EbookFormat, images?: ImageInfoMap): Promise<string> {
    raw = raw.replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '</p><p>');
    let doc = parse(raw);
    try {
        const { blockquote } = formats.EPUB;

        doc.querySelectorAll('.message-delete,.splitnewsnavigation,script' + (images ? '' : ',img')).forEach(e => e.remove());
        replaceTags(doc, tags.emphasis, 'i', 'em', 'dfn', 'var', 'q', 'dd', 'address');
        replaceTags(doc, tags.strong, 'b', 'strong', 'mark');
        replaceTags(doc, tags.strikethrough, 's', 'strike', 'del');
        replaceTags(doc, tags.underline, 'u', 'ins', 'abbr');
        doc.querySelectorAll('.game-message,.quote').forEach(e => replaceTag(doc, e, blockquote));

        doc.querySelectorAll(`body :not(header):not(section):not(${tags.emphasis}):not(${tags.strong}):not(${tags.strikethrough}):not(${tags.underline}):not(${blockquote}):not(sub):not(sup):not(img):not(h1)`).forEach(e => {
            if (e.parentElement.tagName === 'SECTION' || !getComputedStyle(e).display.includes('inline')) {
                replaceTag(doc, e, 'div');
            } else {
                unwrap(e);
            }
        });

        raw = doc.documentElement.outerHTML;
        doc.open();
        doc = parse(raw
            .replace(/<\/?div>/g, '</p><p>')
            .replace(/<(\/)?blockquote>/g, `</p><$1${blockquote}><p>`)
        );

        if (images) {
            await pMap(
                Array.from(doc.querySelectorAll('img')),
                async e => {
                    let i = await downloadImage(e.closest('section').querySelector('header').textContent, e.src, images, ctrl)
                    if (i) {
                        const { alt } = e;
                        if (tags === formats.FB2) {
                            await i.b64();
                            const image = doc.createElement(tags.image);
                            image.setAttribute('l:href', '#' + i.id);
                            if (alt) {
                                image.setAttribute('alt', alt)
                            }
                            e.parentNode.replaceChild(image, e);
                        } else if (tags === formats.EPUB) {
                            dropAttrs(e);
                            e.setAttribute('src', 'images/' + i.id + i.ext);
                            if (alt) {
                                e.setAttribute('alt', alt)
                            }
                        }
                    } else {
                        e.remove();
                    }
                },
                { concurrency }
            )
        }

        doc.querySelectorAll(`body :not(${tags.image})`).forEach(dropAttrs);

        if (tags.blockquote != blockquote) {
            doc.querySelectorAll(blockquote).forEach(e => replaceTag(doc, e, tags.blockquote));
        }

        raw = unescape(doc.body.innerHTML).replace(/(\s*<p>\s*<\/p>\s*)+/g, ' ');

        if (!images) {
            return raw;
        }

        if (tags === formats.FB2) {
            return raw.replace(/><\/image>/g, '/>');
        } else if (tags === formats.EPUB) {
            return raw.replace(/(<img[^>]+)>/gi, '$1/>');
        }
    } finally {
        doc.open();
    }
}

function dropAttrs(e: HTMLElement) {
    while (e.attributes.length > 0) {
        e.removeAttribute(e.attributes.item(0).name);
    }
}

export function inject(node: HTMLElement, parent: HTMLElement) {
    parent.appendChild(node);
    return {
        update(newParent: HTMLElement) {
            if (newParent != parent) {
                parent = newParent;
                parent.appendChild(node);
            }
        },
        destroy() {
            node.remove();
        }
    }
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

export function concatBuffers(a: Uint8Array, b: ArrayLike<number>) {
    const tmp = new Uint8Array(a.byteLength + b.length);
    tmp.set(a, 0);
    tmp.set(b, a.byteLength);
    return tmp;
}

const encoder = new TextEncoder();
export function utf8bytes(s: string) {
    return encoder.encode(s);
}

export async function sha256(s: string | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer) {
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', s.constructor === String ? encoder.encode(s) : s as Exclude<typeof s, string>));
    return '_' + btoa(String.fromCharCode.apply(null, b as any)).replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');
}
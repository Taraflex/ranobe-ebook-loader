import dayjs from 'dayjs';
import pMap from 'p-map';

import { decodeBase64, detectMime } from './mime';
import { notifications } from './stores';
import { sha256, stringify, unescapeUnsafe } from './string-utils';

/*
class SPromise<T> extends Promise<T>{
    notPending?: boolean;
}

export function mapper(concurrency = 5) {
    const wrap = async <T>(v: T) => v;
    return async function* parallelMap<T = any, R = any>(iter: AsyncIterable<T> | AsyncGenerator<T> | Generator<T> | Iterable<T>, f: (v: T) => R | PromiseLike<R>) {
        const t: SPromise<R>[] = [];
        for await (const item of iter) {
            while (t.length && t[0].notPending) {
                yield await t.shift();
            }
            const sp = new SPromise<R>((resolve, reject) => wrap(f(item)).then(v => {
                sp.notPending = true;
                return resolve(v);
            }, v => {
                sp.notPending = true;
                return reject(v);
            }));
            t.push(sp);
            const processed = t.filter(t => !t.notPending);
            if (processed.length >= concurrency) {
                await Promise.race(processed);
            }
            while (t.length && t[0].notPending) {
                yield await t.shift();
            }
        }
        for (const item of t) {
            yield await item;
        }
    }
}
*/

export function getElements<K extends keyof HTMLElementTagNameMap>(root: HTMLElement | Document, qualifiedName: K): Iterable<HTMLElementTagNameMap[K]> {
    const e = root.getElementsByTagName(qualifiedName);
    return e[Symbol.iterator] ? e as any : Array.from(e);
}

export function patchApi(type: string) {
    const orig = history[type];
    return Object.assign(
        function () {
            try {
                return orig.apply(this, arguments);
            } finally {
                window.dispatchEvent(new Event(type));
            }
        },
        {
            destroy() {
                history[type] = orig;
            },
        }
    );
}

export async function loadDom(url: string, signal: AbortSignal, method = 'GET', body?: any) {
    const resp = await fetch(url, {
        method,
        credentials: 'include',
        signal,
        body,
        headers: {
            'x-requested-with': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    });
    return resp.status === 200 ? parse(await resp.text()) : null;
}

export function response2err(r: { status: number, statusText: string }) {
    return { name: r.statusText, message: r.status };
}

export function http(baseurl: string) {
    return async function (url: string, signal: AbortSignal) {
        const response = await fetch(baseurl + url, { credentials: 'include', signal, headers: { 'x-requested-with': 'XMLHttpRequest' } });
        if (response.status >= 400) {
            throw response2err(response);
        }
        return response.json();
    }
}

export interface ImageInfo {
    readonly id: string;
    readonly url: string;
    readonly mime: string;
    readonly ext: string;
    b64(): string | Promise<string>;
    data(): Uint8Array;
};
export type ImageInfoMap = Map<string, ImageInfo>;

async function processB64Url(url: string): Promise<ImageInfo> {
    const _64 = url.slice(url.indexOf(',') + 1);
    return {
        ...detectMime(_64),
        url,
        id: await sha256(url),
        b64: () => _64,
        data: () => decodeBase64(_64)
    };
}

async function processBlob(url: string, blob: Blob): Promise<ImageInfo> {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let _64: Promise<string>;
    return {
        ...detectMime(buf),
        url,
        id: await sha256(buf),
        b64: () => _64 ||= new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = function () {
                try {
                    if (reader.readyState == /*FileReader.DONE*/ 2) {
                        const dataUrl = reader.result as string;
                        resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
                    } else {
                        reject(reader.error);
                    }
                } catch (e) {
                    reject(e);
                }
            };
            reader.readAsDataURL(blob);
        }),
        data: () => buf
    };
}

const corsRequest = typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : GM.xmlHttpRequest;

async function fetchImage(url: string, cache: ImageInfoMap, signal: AbortSignal): Promise<ImageInfo> {
    let breaker = new AbortController();
    const finallizer = () => {
        signal.removeEventListener('abort', finallizer);
        breaker.abort();
    };
    signal.addEventListener('abort', finallizer, { once: true });
    try {
        if (location.host === new URL(url).host || !corsRequest) {
            const response = await fetch(url, { credentials: 'include', cache: 'force-cache', referrer: location.href, signal: breaker.signal });
            if (cache.has(url)) return cache.get(url);
            if (response.status >= 400) {
                throw response2err(response);
            }
            if (cache.has(response.url)) return cache.get(response.url);
            return await processBlob(response.url, await response.blob());
        } else {
            const { finalUrl, response } = await new Promise<Tampermonkey.Response<any>>((resolve, reject) => {

                function _abort(reason: any) {
                    reject(reason);
                    breaker.signal.removeEventListener('abort', abort);
                    abort();
                }

                const { abort } = corsRequest({
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
                            _abort(response2err(r))
                        } else {
                            breaker.signal.removeEventListener('abort', abort);
                            resolve(r);
                        }
                    }
                });

                breaker.signal.addEventListener('abort', abort, { once: true });
            });

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

const B64_RE = /^\s*data:([image\/jpnfwbpsv]+);base64/;

export async function downloadImage(title: string, url: string, cache: ImageInfoMap, ctrl: AbortController) {
    try {
        if (cache.has(url)) return cache.get(url);

        title = (title || '').trim();

        let i = await (B64_RE.test(url) ? processB64Url(url) : fetchImage(url, cache, ctrl.signal));

        if (i) {
            i = cache.get(i.id) || i;
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
}

function unwrap(e: Element) {
    while (e.firstChild) {
        e.parentNode.insertBefore(e.firstChild, e);
    }
    e.remove();
}

function replaceTags(doc: Document, target: string, ...sources: string[]) {
    const selector = sources.filter(s => s != target).join(',');
    if (selector) {
        doc.querySelectorAll(selector).forEach(e => replaceTag(doc, e, target));
    }
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

function fixAttr(s: string) {
    return s ? s.replace(/"/g, "'") : null;
}

export async function processHtml(raw: string, ctrl: AbortController, tags: EbookFormat, concurrency: number, images?: ImageInfoMap): Promise<string> {
    raw = raw.replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '</p><p>');
    let doc = parse(raw);
    try {
        const { blockquote } = formats.EPUB;

        doc.querySelectorAll('.message-delete,.splitnewsnavigation,script,.adblock-service' + (images ? '' : ',img')).forEach(e => e.remove());
        replaceTags(doc, tags.emphasis, 'i', 'em', 'dfn', 'var', 'q', 'dd', 'address');
        replaceTags(doc, tags.strong, 'b', 'strong', 'mark', 'h2', 'h3', 'h4', 'h5', 'h6');
        replaceTags(doc, tags.strikethrough, 's', 'strike', 'del');
        replaceTags(doc, tags.underline, 'u', 'ins', 'abbr', 'a');
        doc.querySelectorAll('.game-message,.quote').forEach(e => replaceTag(doc, e, blockquote));

        doc.querySelectorAll('section section').forEach(unwrap);

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
            const chapterTitle = tags === formats.EPUB && doc.querySelector('header').textContent;
            await pMap(
                Array.from(doc.querySelectorAll('img')),
                async e => {
                    let i = await downloadImage(chapterTitle || e.closest('section').querySelector('header').textContent, e.src, images, ctrl)
                    if (i) {
                        const alt = fixAttr(e.alt);
                        const title = fixAttr(e.title);
                        const image = doc.createElement(tags.image);
                        if (alt) {
                            image.setAttribute('alt', alt)
                        }
                        if (tags === formats.FB2) {
                            await i.b64();
                            image.setAttribute('l:href', '#' + i.id);
                            e.parentNode.replaceChild(image, e);
                            if (image.parentElement.tagName === 'SECTION') {
                                if (title) {
                                    image.title = title;
                                }
                                image.id = i.id;
                            }
                        } else if (tags === formats.EPUB) {
                            image['src'] = 'images/' + i.id + i.ext;
                            if (title) {
                                image.title = title;
                            }
                            image.id = i.id;
                            e.parentNode.replaceChild(image, e);
                        }
                    } else {
                        e.remove();
                    }
                },
                { concurrency }
            )
        }

        doc.querySelectorAll(`body :not(${tags.image})`).forEach(dropAttrs);
        replaceTags(doc, tags.blockquote, blockquote);

        raw = doc.body.innerHTML;
        doc.open();
        raw = unescapeUnsafe(doc, raw);
        raw = raw.replace(/(\s*<p>\s*<\/p>\s*)+/g, ' ');

        if (tags === formats.FB2) {
            raw = raw.replace(/<(\/)?header>/g, '<$1title>');
            return images ? raw.replace(/><\/image>/g, '/>') : raw;
        } else if (tags === formats.EPUB) {
            return images ? raw.replace(/(<img[^>]+)>/gi, '$1/>') : raw;
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

export function* uniqValues(map: ImageInfoMap) {
    for (const [k, v] of map) {
        if (k === v.id) {
            yield v;
        }
    }
}

const trMonths = {
    'янв': 'jan',
    'фев': 'feb',
    'мар': 'mar',
    'апр': 'apr',
    'мая': 'may',
    'июн': 'jun',
    'июл': 'jul',
    'авг': 'aug',
    'сен': 'sep',
    'окт': 'oct',
    'ноя': 'nov',
    'дек': 'dec'
}

export function parseRuDate(s: string) {
    return dayjs(s.replace(/(янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)[а-я]*/i, (_, m) => trMonths[m]).replace(/[^\w:\+\s]+/g, '').replace(/\s+/g, ' '));
}
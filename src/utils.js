import 'nodelist-foreach-polyfill';
import * as rndHex from 'rnd-hex';
import lastMatch from 'last-match';

function createEscaper() {
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
    }
    // Regexes for identifying a key that needs to be escaped.
    const source = '(?:' + Object.keys(map).join('|') + ')';
    const replaceRegexp = RegExp(source, 'g');

    return (/** @type {String} */ s) => {
        return s.replace(replaceRegexp, match => map[match]);
    };
};

const unescape = createEscaper();

//todo подобрать лучшие соответствия http://www.fictionbook.org/index.php/%D0%96%D0%B0%D0%BD%D1%80%D1%8B_FictionBook_2.1
export const genresMap = {
    "Adult": "home_sex",
    "Josei": "sf_action",
    "Mature": "",
    "Shounen": "sf_action",
    "Xianxia": "sf_fantasy",
    "Xuanhuan": "sf_fantasy",
    "Боевик": "det_action",
    "Боевые Искусства": "fantasy_fight",
    "Вампиры": "vampire_book",
    "Виртуальный Мир": "sf",
    "Гарем": "",
    "Гендерная Интрига": "",
    "Героическое Фэнтези": "sf_heroic",
    "Детектив": "detective",
    "Дзёсэй": "sf_action",
    "Драма": "dramaturgy",
    "Игра": "sf",
    "История": "sci_history",
    "Комедия": "humor",
    "Меха": "sf",
    "Мистика": "sf_horror",
    "Научная Фантастика": "sf",
    "Оригинальный сюжет": "",
    "Повседневность": "",
    "Приключения": "adventure",
    "Психология": "sci_psychology",
    "Романтика": "",
    "Сверхъестественное": "sf_horror",
    "Смена Пола": "",
    "Спорт": "home_sport",
    "Сэйнэн": "sf_action",
    "Сёдзе": "",
    "Сёдзе-ай": "",
    "Сёнэн": "sf_action",
    "Трагедия": "",
    "Триллер": "thriller",
    "Ужасы": "sf_horror",
    "Уся": "fantasy_fight",
    "Фэнтези": "sf_fantasy",
    "Хентай": "home_sex",
    "Школьная Жизнь": "children",
    "Экшн": "sf_action",
    "Эротика": "love_erotica",
    "Этти": "love_erotica",
    "Юри": ""
}

/**
 * @param {string} url
 */
export async function fetchJson(url) {
    return (await fetch(
        `https://xn--80ac9aeh6f.xn--p1ai/api/v2/books/` + url,
        { credentials: 'include' }
    )).json();
}

const B64_RE = /^\s*data:([image\/jpnf]+);base64/;

/**
 * @param {string} dataUrl
 * @param {string} [mime]
 */
function splitImageBase64(dataUrl, mime) {
    return {
        mime: lastMatch(dataUrl, B64_RE) || mime,
        data: dataUrl.slice(dataUrl.indexOf(',') + 1)
    };
}

/**
 * @param {Blob} blob
 * @param {string} mime
 * @returns
 */
function toBase64(blob, mime) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = function (evt) {
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

/**
 * @export
 * @param {string} url
 */
export async function downloadImage(url) {
    if (B64_RE.test(url)) {
        return splitImageBase64(url);
    } else {
        const bookResp = await fetch(url);
        return toBase64(await bookResp.blob(), bookResp.headers.get('content-type'));
    }
}

/**
 * @export
 * @param {string} text
 * @param {SupportedType} mime
 * @returns {Document}
 */
export function parse(text, mime) {
    const doc = new DOMParser().parseFromString(text, mime);
    const err = doc.querySelector('parsererror');
    if (err) {
        throw err.textContent;
    }
    return doc;
}

/**
 * @export
 * @param {Document} doc
 * @param {Element} elem
 * @param {string} tag
 * @param {string} [ns]
 */
export function replaceTag(doc, elem, tag, ns) {
    const t = ns ? doc.createElementNS(ns, tag) : doc.createElement(tag);
    while (elem.firstChild) {
        t.appendChild(elem.firstChild);
    }
    elem.parentNode.replaceChild(t, elem);
}

/**
 * @export
 * @param {string} raw
 * @param {any[]} images
 * @returns
 */
export function processHtml(raw, images) {
    raw = raw
        .replace(/>(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '>')
        .replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+<\//g, '</')
        .replace(/(\s*<br(\s+[^\/<>]+)?\/?>\s*)+/g, '</p><p>');

    let doc = parse(raw, 'text/html');

    doc.querySelectorAll('.message-delete').forEach(e => {
       e.remove();
    });
    doc.querySelectorAll('i,em').forEach(e => {
        replaceTag(doc, e, 'emphasis');
    });
    doc.querySelectorAll('b').forEach(e => {
        replaceTag(doc, e, 'strong');
    });
    doc.querySelectorAll('s,strike').forEach(e => {
        replaceTag(doc, e, 'strikethrough');
    });
    doc.querySelectorAll('div').forEach(e => {
        replaceTag(doc, e, 'p');
    });
    
    doc.querySelectorAll('body :not(section):not(emphasis):not(code):not(header):not(strong):not(strikethrough):not(p):not(empty-line):not(sub):not(sup):not(img)').forEach(e => {
        replaceTag(doc, e, 'code');
    });

    //remove p > p
    doc = parse(doc.documentElement.outerHTML, 'text/html');

    doc.querySelectorAll('img').forEach(e => {
        const id = '_' + rndHex();
        images.push({ src: e.src, id });
        const i = doc.createElement('image');
        i.setAttribute('l:href', '#' + id);
        e.parentNode.replaceChild(i, e);
    });

    doc.querySelectorAll('body :not(image)').forEach(e => {
        if (e.attributes.length > 0) {
            Array.from(e.attributes).forEach(attr => e.removeAttribute(attr.name));
        }
    });

    return unescape(doc.body.innerHTML)
        .replace(/><\/image>/g, '/>')
        .replace(/(\s*<code>\s*<\/code>\s*)+/g, ' ')
        .replace(/(\s*<p>\s*<\/p>\s*)+/g, ' ');
}
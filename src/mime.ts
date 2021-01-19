// https://stackoverflow.com/a/58613321

interface Mime {
    mime: string;
    ext: string;
    pattern: (number | undefined)[];
}

const imageMimes: Mime[] = [
    {
        mime: 'image/webp',
        ext: '.webp',
        pattern: [0x52, 0x49, 0x46, 0x46, undefined, undefined, undefined, undefined, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50],
    },
    {
        mime: 'image/png',
        ext: '.png',
        pattern: [0x89, 0x50, 0x4e, 0x47]
    },
    {
        mime: 'image/gif',
        ext: '.gif',
        pattern: [0x47, 0x49, 0x46, 0x38]
    },
    {
        mime: 'image/jpeg',
        ext: '.jpg',
        pattern: [0xff, 0xd8, 0xff]
    },
    {
        mime: 'image/bmp',
        ext: '.bmp',
        pattern: [0x42, 0x4D]
    },
    /*{
        mime: ['image/svg+xml', 'image/svg'],
        ext: '.svg',
        pattern: []//todo
    }*/
    // You can expand this list @see https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
];
//export const numBytesRequired = Math.max(...imageMimes.map(m => m.pattern.length));

export function decodeBase64(s: string, size?: number) {
    const binary_string = atob(size ? s.substr(size) : s);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; ++i) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

export function detectMime(bytes: string | Uint8Array) {
    if (bytes.constructor === String) {
        bytes = decodeBase64(bytes, 19 /* numBytesRequired / 3 * 4 */);
    }
    const m = imageMimes.find(mime => mime.pattern.every((p, i) => !p || bytes[i] === p));
    if (!m) {
        throw 'Unsupported image type';
    }
    return m;
}
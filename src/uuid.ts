// browser version of https://www.npmjs.com/package/uuidv5

import { utf8encoder } from './string-utils';

const NAMESPACE_NULL = new Uint8Array(16);

async function createUUIDv5Binary(name: Uint8Array, namespace: Uint8Array) {
    const c = new Uint8Array(namespace.byteLength + name.length);
    c.set(namespace, 0);
    c.set(name, namespace.byteLength);

    const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', c));
    const uuid = new Uint8Array(16);

    // bbbb - bb - bb - bb - bbbbbb
    uuid.set(digest.subarray(0, 0 + 4), 0);  // digest.copy(uuid, 0, 0, 4); // time_low
    uuid.set(digest.subarray(4, 4 + 6), 4); // digest.copy(uuid, 4, 4, 6); // time_mid
    uuid.set(digest.subarray(6, 6 + 8), 6); // digest.copy(uuid, 6, 6, 8); // time_hi_and_version
    uuid[6] = (uuid[6] & 0x0f) | 0x50; // version, 4 most significant bits are set to version 5 (0101)
    uuid[8] = (digest[8] & 0x3f) | 0x80; // clock_seq_hi_and_reserved, 2msb are set to 10
    uuid[9] = digest[9];
    uuid.set(digest.subarray(10, 10 + 6), 10);// digest.copy(uuid, 10, 10, 16);

    return uuid;
}

function uuidToString(uuid: Uint8Array) {
    let raw = '';
    for (let i = 0; i < 16; ++i) {
        raw += uuid[i].toString(16).padStart(2, '0');
    }
    return formatUUIDString(raw);
}

function formatUUIDString(uuidStr: string) {
    return [
        uuidStr.slice(0, 0 + 8),
        uuidStr.slice(8, 8 + 4),
        uuidStr.slice(12, 12 + 4),
        uuidStr.slice(16, 16 + 4),
        uuidStr.slice(20)
    ].join('-');
}

let NAMESPACE_APP: Uint8Array = null;
export async function createUUIDv5(name: string) {
    NAMESPACE_APP || (NAMESPACE_APP = await createUUIDv5Binary(utf8encoder.encode(APP_TITLE), NAMESPACE_NULL));
    return uuidToString(await createUUIDv5Binary(utf8encoder.encode(name), NAMESPACE_APP));
}
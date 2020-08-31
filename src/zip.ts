import { utf8bytes } from './utils';

const crc32table = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32table[n] = c;
}

function crc32(bytes: Uint8Array) {
    let sum = -1;
    for (const byte of bytes) {
        sum = (sum >>> 8) ^ crc32table[(sum ^ byte) & 0xFF];
    }
    return sum ^ -1;
}

function int(n: number, length: number) {
    const out = [];
    while (length--) {
        out.push(n & 0xFF);
        n >>>= 8;
    }
    return out;
}

export function* zip(files: Iterable<{ path: string, data: string | Uint8Array }>) {
    let fileDataLen = 0;
    const centralDirectory: number[] = [];
    let filesCount = 0;
    for (const { path, data } of files) {
        const dataBytes = data instanceof Uint8Array ? data : utf8bytes(data);
        const pathBytes = utf8bytes(path);

        const commonHeader = [0x0A, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...int(crc32(dataBytes), 4), ...int(dataBytes.length, 4), ...int(dataBytes.length, 4), ...int(pathBytes.length, 2), 0x00, 0x00];

        centralDirectory.push(0x50, 0x4B, 0x01, 0x02, 0x14, 0x00, ...commonHeader, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, ...int(fileDataLen, 4), ...pathBytes);

        const header = new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...commonHeader]);
        fileDataLen += header.byteLength + dataBytes.byteLength + pathBytes.byteLength;
        ++filesCount;
        yield header;
        yield pathBytes;
        yield dataBytes;
    }

    centralDirectory.push(0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, ...int(filesCount, 2), ...int(filesCount, 2), ...int(centralDirectory.length, 4), ...int(fileDataLen, 4), 0x00, 0x00);

    yield new Uint8Array(centralDirectory);
}
declare const APP_ICON: string;
declare const APP_VERSION: string;
declare const APP_TITLE: string;

declare module '*.static.pug' {
    const S: string;
    export default S;
}

declare module '*.pug' {
    export default function (locals?: Record<string, any>): string;
}

declare const GM: {
    readonly xmlHttpRequest: typeof GM_xmlhttpRequest
};
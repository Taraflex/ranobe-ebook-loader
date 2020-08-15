declare const APP_TITLE:string;
declare const APP_VERSION:string;

declare module '*.pug' {
    export default function (locals?: Record): string;
}
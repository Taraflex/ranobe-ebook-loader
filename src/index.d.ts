declare const APP_ICON: string;
declare const APP_VERSION: string;
declare const APP_TITLE: string;

declare module '*.pug' {
    export default function (locals?: Record<string, any>): string;
}
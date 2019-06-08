//@ts-ignore
import App from './App.svelte';
import ready from 'when-dom-ready';

ready(() => {
    const target = document.createElement('div');
    target.style.zIndex = '16777270';
    target.style.position = 'fixed';
    target.style.top = '0';
    target.style.left = '0';

    document.body.appendChild(target);

    new App({ target });
});
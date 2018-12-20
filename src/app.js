//@ts-ignore
import App from './App.svelte.html';
import ready from 'when-dom-ready';

ready(() => {
    const container = document.createElement('div');
    container.style.zIndex = '16777270';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';

    document.body.appendChild(container);

    new App({ target: container });
})
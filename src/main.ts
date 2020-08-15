import 'nodelist-foreach-polyfill';

import App from './App.svelte';

let f = () => {
    document.removeEventListener('DOMContentLoaded', f);

    const target = document.createElement('div');
    target.style.zIndex = '16777270';
    target.style.position = 'fixed';
    target.style.top = '0';
    target.style.left = '0';

    document.body.appendChild(target);

    new App({ target });
};
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    f();
} else {
    document.addEventListener('DOMContentLoaded', f);
}

const f = () => {
    document.removeEventListener('DOMContentLoaded', f);

    const target = document.createElement('div');
    target.id = APP_TITLE;

    document.body.appendChild(target);

    import('./App.svelte').then(o => new o.default({ target }));
};
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    f();
} else {
    document.addEventListener('DOMContentLoaded', f);
}

<script lang="ts">
    import fb2BookTpl from './templates/fb2/book.pug';
    import fb2ContentTpl from './templates/fb2/content.pug';

    import epubToc from './templates/epub/toc.pug';
    import epubNav from './templates/epub/nav.pug';
    import epubOpf from './templates/epub/opf.pug';
    import epubChapter from './templates/epub/chapter.pug';
    import epubPage from './templates/epub/page.pug';
    import epubContainer from './templates/epub/container.pug';
    import epubApple from './templates/epub/apple.pug';

    import Window from './Window.svelte';
    import Preloader from './Preloader.svelte';
    import ContextMenu from './ContextMenu.svelte';
    import ContextMenuItem from './ContextMenuItem.svelte';
    import NotificationsDisplay from './NotificationsDisplay.svelte';
    import { saveAs } from 'file-saver';
    import { onMount, onDestroy, tick } from 'svelte';
    import { processHtml, parse, downloadImage, replaceTag, inject, patchApi, notifications, formats, concurrency, sha256 } from './utils';
    import waitEvents from './wait-events';
    import { createUUIDv5 } from './uuid';
    import type { ImageInfoMap, EbookFormat } from './utils';

    import type { Base } from './loaders/Base';
    import { Ranobe } from './loaders/Ranobe';
    import { Ranobes } from './loaders/Ranobes';
    import { Rulate } from './loaders/Rulate';
    import { zip } from './zip';
    import pMap from 'p-map';

    const MENU_TITLE_FB2 = 'Скачать *.fb2';
    const MENU_TITLE_EPUB = 'Скачать *.epub';
    const Loader = {
        'ранобэ.рф': Ranobe,
        'xn--80ac9aeh6f.xn--p1ai': Ranobe,
        'ranobes.com': Ranobes,
        'tl.rulate.ru': Rulate,
    }[location.hostname];

    let loading = false;
    let percent = 0;
    let ctrl: AbortController;
    let injectTarget: HTMLElement = null;

    function abort() {
        if (ctrl) {
            ctrl.abort();
            ctrl = null;
        }
        if (loading) {
            loading = false;
        }
        if (percent) {
            percent = 0;
        }
    }

    const c = new AbortController();

    onMount(async () => {
        if (Loader.spa) {
            history.pushState = patchApi('pushState');
            history.replaceState = patchApi('replaceState');

            const tm = resolve => setTimeout(resolve, 2000);

            while (!c.signal.aborted) {
                while (!(injectTarget = Loader.injectTarget())) {
                    await new Promise(tm);
                    if (c.signal.aborted) return;
                }
                await waitEvents([c.signal, 'abort'], [window, 'pushState', 'replaceState', 'popstate']).promise;
                abort();
                await new Promise(tm);
            }
        } else {
            injectTarget = await Loader.injectTarget();
        }
    });

    onDestroy(() => {
        c.abort();
        abort();
        if (Loader.spa) {
            history.pushState['destroy']?.();
            history.replaceState['destroy']?.();
        }
    });

    const loadFB2 = loadBook.bind(null, formats.FB2);
    const loadEPUB = loadBook.bind(null, formats.EPUB);

    async function loadBook(format: EbookFormat) {
        if (loading || !injectTarget) return;
        try {
            abort();
            loading = true;
            notifications.clear();

            await tick();

            ctrl = new AbortController();

            const loader: Base = new Loader((i: number, total: number) => (percent = Math.max(percent, (((i + 1) * 100) / total) | 0)));
            await loader.init(ctrl);

            if (loader.genres.length < 1) {
                loader.genres.push('unrecognised');
            }

            const attaches: ImageInfoMap = new Map();
            const parts = await loader.parts(ctrl, attaches);

            switch (format) {
                case formats.EPUB:
                    parts.unshift({ title: 'Аннотация', text: loader.covers.map(c => loader.description + `<p><img src="${c}"/></p>`).join('') });
                    const chapters = await pMap(
                        parts,
                        async part => {
                            part.id = await sha256(part.title);
                            part.text = await processHtml(epubChapter(part), ctrl, format, attaches);
                            part.text = epubPage(part);
                            return part;
                        },
                        { concurrency }
                    );

                    const images = Array.from(new Set(attaches.values()));

                    const annotation = parse(chapters[0].text);
                    const renderInfo = {
                        ...loader,
                        cover: attaches.get(loader.covers[0]),
                        isoDate: loader.isoDate,
                        uuid: 'urn:uuid:' + (await createUUIDv5(loader.title + loader.subtitle)),
                        annotation: annotation.body.innerText,
                        chapters,
                        images,
                    };
                    annotation.open();

                    attaches.clear();

                    const epubMime = 'application/epub+zip';
                    const epub = new Blob(
                        Array.from(
                            zip([
                                //
                                { path: 'mimetype', data: epubMime },
                                { path: 'META-INF/container.xml', data: epubContainer() },
                                { path: 'META-INF/com.apple.ibooks.display-options.xml', data: epubApple() },
                                { path: 'OEBPS/toc.ncx', data: epubToc(renderInfo) },
                                { path: 'OEBPS/nav.xhtml', data: epubNav(renderInfo) },
                                { path: 'OEBPS/content.opf', data: epubOpf(renderInfo) },
                                ...images.map(a => ({ path: 'OEBPS/images/' + a.id + a.ext, data: a.data() })),
                                ...chapters.map(a => ({ path: `OEBPS/${a.id}.xhtml`, data: a.text })),
                            ])
                        ),
                        { type: epubMime }
                    );
                    return saveAs(epub, loader.bookAlias + '.epub');
                case formats.FB2:
                    const cover = await (loader.covers[0] && downloadImage('Обложка', loader.covers[0], attaches, ctrl));
                    await cover?.b64();
                    const doc = parse(
                        fb2BookTpl({
                            ...loader,
                            cover,
                            body: await processHtml(fb2ContentTpl({ title: loader.title, parts }), ctrl, format, attaches),
                            annotation: await processHtml('<div>' + loader.description + '</div>', ctrl, format),
                            images: Array.from(new Set(attaches.values())),
                            shortDate: loader.date('YYYY-MM-DD'),
                            fullDate: loader.date('DD.MM.YYYY'),
                        }),
                        'application/xml'
                    );
                    attaches.clear();
                    //todo optimize
                    doc.querySelectorAll('header').forEach(e => replaceTag(doc, e, 'title'));

                    const fb2 = new Blob(
                        [
                            new XMLSerializer().serializeToString(doc),
                            // '<?xml version="1.0" encoding="utf-8" ?>' + doc.documentElement.outerHTML
                        ],
                        { type: 'application/x-fictionbook+xml;charset=utf-8' }
                    );
                    return saveAs(fb2, loader.bookAlias + '.fb2');
            }
        } catch (e) {
            if (e?.name != 'AbortError') {
                console.error(e);
                notifications.add(e);
            }
        } finally {
            abort();
        }
    }

    console.log(APP_TITLE + ' ' + APP_VERSION);
</script>

<style type="text/scss" global>
    @import './_mixins.scss';
    #APP_TITLE_noquotes {
        @include overlay;
    }
</style>

{#if loading}
    <Preloader {percent} on:cancel={abort} color={Loader.color} />
{:else if injectTarget}
    <Window on:save={loadFB2} />
    <ContextMenu>
        <ContextMenuItem label={MENU_TITLE_FB2} on:trigger={loadFB2} />
        <ContextMenuItem label={MENU_TITLE_EPUB} on:trigger={loadEPUB} />
    </ContextMenu>
    <button class={Loader.component} on:click={loadFB2} use:inject={injectTarget}>{MENU_TITLE_FB2}</button>
    <button class={Loader.component} on:click={loadEPUB} use:inject={injectTarget}>{MENU_TITLE_EPUB}</button>
{/if}
<NotificationsDisplay />

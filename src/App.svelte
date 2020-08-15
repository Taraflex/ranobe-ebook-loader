<script lang="ts">
    import pMap from 'p-map';
    import { saveAs } from 'file-saver';
    import { RanobeRf } from './loaders/RanobeRf';
    import { RanobesCom } from './loaders/RanobesCom';
    import hotkeys from 'hotkeys-js';
    import fb2Template from './fb2.pug';
    import pageTemplate from './page.pug';
    import { onMount } from 'svelte';
    import { processHtml, parse, downloadImage, replaceTag, concurrency } from './utils.js';
    import type { Base } from './loaders/Base';

    const NS = 'http://www.gribuser.ru/xml/fictionbook/2.0';

    let loading = false;
    let percent = 0;

    onMount(() => {
        hotkeys('ctrl+s', event => {
            event.stopImmediatePropagation();
            event.preventDefault();
            if (!loading) {
                load();
            }
        });
        console.log(APP_TITLE + ' ' + APP_VERSION);
    });

    const loaders = {
        'ранобэ.рф': RanobeRf,
        'xn--80ac9aeh6f.xn--p1ai': RanobeRf,
        'ranobes.com': RanobesCom,
    } as const;

    async function load() {
        try {
            loading = true;
            percent = 0;

            const loader: Base = new loaders[location.hostname]((i: number, total: number) => (percent = Math.max(percent, (((i + 1) * 100) / total) | 0)));
            await loader.init();

            if (loader.genres.length < 1) {
                loader.genres.push('unrecognised');
            }

            const parts = await loader.parts();
            const images = [{ id: 'cover', src: loader.cover }];

            const doc = parse(
                fb2Template({
                    ...loader,
                    NS,
                    body: processHtml(pageTemplate({ title: loader.title, parts }), images),
                    annotation: processHtml('<div>' + loader.description + '</div>', images),
                    programName: APP_TITLE,
                    shortDate: loader.date('YYYY-MM-DD'),
                    fullDate: loader.date('DD.MM.YYYY'),
                    attaches: await pMap(images, async i => Object.assign(i, await downloadImage(i.src)), { concurrency }),
                }),
                'application/xml'
            );

            doc.querySelectorAll('header').forEach(e => replaceTag(doc, e, 'title', NS));

            saveAs(new Blob(['<?xml version="1.0" encoding="utf-8" ?>' + doc.documentElement.outerHTML], { type: 'text/xml;charset=utf-8' }), loader.bookAlias + '.fb2');
        } catch (e) {
            console.error(e);
            //todo better message
            alert('Ошибка загрузки. Попробуйте снова.');
        } finally {
            loading = false;
            percent = 0;
        }
    }
</script>

<style type="text/scss">
    .c {
        margin: auto;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        position: absolute;
        pointer-events: none;
        width: 100px;
        height: 100px;
    }

    .h {
        width: 100%;
        height: 100%;
        position: absolute;
        left: 0;
        top: 0;
        &:before {
            content: '';
            display: block;
            margin: 0 auto;
            width: 15%;
            height: 15%;
            background-color: #303745;
            border-radius: 100%;
            animation: sk-circleBounceDelay 1.2s infinite ease-in-out both;
        }
    }

    @for $i from 2 through 12 {
        .c#{$i} {
            transform: rotate(($i - 1) * 30deg);
            &:before {
                animation-delay: ($i - 2) * 0.1 - 1.1s;
            }
        }
    }

    @keyframes sk-circleBounceDelay {
        0%,
        80%,
        100% {
            transform: scale(0);
        }

        40% {
            transform: scale(1);
        }
    }

    .bg {
        background: rgba(255, 255, 255, 0.8);
        width: 100vw;
        height: 100vh;
        line-height: 100vh;
        display: block;
        position: fixed;
        top: 0;
        left: 0;
        text-align: center;
        font-size: 16px;
        color: #303745;
        -moz-user-select: none;
        -webkit-user-select: none;
        user-select: none;
    }
</style>

{#if loading}
    <div class="bg">
        <div class="c">
            <div class="c1 h" />
            <div class="c2 h" />
            <div class="c3 h" />
            <div class="c4 h" />
            <div class="c5 h" />
            <div class="c6 h" />
            <div class="c7 h" />
            <div class="c8 h" />
            <div class="c9 h" />
            <div class="c10 h" />
            <div class="c11 h" />
            <div class="c12 h" />
        </div>
        {percent}%
    </div>
{/if}

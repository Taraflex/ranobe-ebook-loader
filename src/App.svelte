<style>
	.sk-circle {
		margin: auto;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		position: absolute;
		pointer-events: none;
	}

	.sk-circle {
		width: 100px;
		height: 100px;
	}

	.sk-circle .sk-child {
		width: 100%;
		height: 100%;
		position: absolute;
		left: 0;
		top: 0;
	}

	.sk-circle .sk-child:before {
		content: '';
		display: block;
		margin: 0 auto;
		width: 15%;
		height: 15%;
		background-color: #303745;
		border-radius: 100%;
		-webkit-animation: sk-circleBounceDelay 1.2s infinite ease-in-out both;
		animation: sk-circleBounceDelay 1.2s infinite ease-in-out both;
	}

	.sk-circle .sk-circle2 {
		-webkit-transform: rotate(30deg);
		transform: rotate(30deg);
	}

	.sk-circle .sk-circle3 {
		-webkit-transform: rotate(60deg);
		transform: rotate(60deg);
	}

	.sk-circle .sk-circle4 {
		-webkit-transform: rotate(90deg);
		
		transform: rotate(90deg);
	}

	.sk-circle .sk-circle5 {
		-webkit-transform: rotate(120deg);
		
		transform: rotate(120deg);
	}

	.sk-circle .sk-circle6 {
		-webkit-transform: rotate(150deg);
		
		transform: rotate(150deg);
	}

	.sk-circle .sk-circle7 {
		-webkit-transform: rotate(180deg);
		
		transform: rotate(180deg);
	}

	.sk-circle .sk-circle8 {
		-webkit-transform: rotate(210deg);
		
		transform: rotate(210deg);
	}

	.sk-circle .sk-circle9 {
		-webkit-transform: rotate(240deg);
		
		transform: rotate(240deg);
	}

	.sk-circle .sk-circle10 {
		-webkit-transform: rotate(270deg);
		
		transform: rotate(270deg);
	}

	.sk-circle .sk-circle11 {
		-webkit-transform: rotate(300deg);
		
		transform: rotate(300deg);
	}

	.sk-circle .sk-circle12 {
		-webkit-transform: rotate(330deg);
		
		transform: rotate(330deg);
	}

	.sk-circle .sk-circle2:before {
		-webkit-animation-delay: -1.1s;
		animation-delay: -1.1s;
	}

	.sk-circle .sk-circle3:before {
		-webkit-animation-delay: -1s;
		animation-delay: -1s;
	}

	.sk-circle .sk-circle4:before {
		-webkit-animation-delay: -0.9s;
		animation-delay: -0.9s;
	}

	.sk-circle .sk-circle5:before {
		-webkit-animation-delay: -0.8s;
		animation-delay: -0.8s;
	}

	.sk-circle .sk-circle6:before {
		-webkit-animation-delay: -0.7s;
		animation-delay: -0.7s;
	}

	.sk-circle .sk-circle7:before {
		-webkit-animation-delay: -0.6s;
		animation-delay: -0.6s;
	}

	.sk-circle .sk-circle8:before {
		-webkit-animation-delay: -0.5s;
		animation-delay: -0.5s;
	}

	.sk-circle .sk-circle9:before {
		-webkit-animation-delay: -0.4s;
		animation-delay: -0.4s;
	}

	.sk-circle .sk-circle10:before {
		-webkit-animation-delay: -0.3s;
		animation-delay: -0.3s;
	}

	.sk-circle .sk-circle11:before {
		-webkit-animation-delay: -0.2s;
		animation-delay: -0.2s;
	}

	.sk-circle .sk-circle12:before {
		-webkit-animation-delay: -0.1s;
		animation-delay: -0.1s;
	}

	@-webkit-keyframes sk-circleBounceDelay {

		0%,
		80%,
		100% {
			-webkit-transform: scale(0);
			transform: scale(0);
		}

		40% {
			-webkit-transform: scale(1);
			transform: scale(1);
		}
	}

	@keyframes sk-circleBounceDelay {

		0%,
		80%,
		100% {
			-webkit-transform: scale(0);
			transform: scale(0);
		}

		40% {
			-webkit-transform: scale(1);
			transform: scale(1);
		}
	}

	.rg-loader-bg {
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
	<div class="rg-loader-bg">
		<div class="sk-circle">
			<div class="sk-circle1 sk-child"></div>
			<div class="sk-circle2 sk-child"></div>
			<div class="sk-circle3 sk-child"></div>
			<div class="sk-circle4 sk-child"></div>
			<div class="sk-circle5 sk-child"></div>
			<div class="sk-circle6 sk-child"></div>
			<div class="sk-circle7 sk-child"></div>
			<div class="sk-circle8 sk-child"></div>
			<div class="sk-circle9 sk-child"></div>
			<div class="sk-circle10 sk-child"></div>
			<div class="sk-circle11 sk-child"></div>
			<div class="sk-circle12 sk-child"></div>
		</div>
		{percent}%
	</div>
{/if}
<script>
	import pMap from 'p-map';
	import saveAs from 'file-saver';
	import dayjs from 'dayjs';
	import hotkeys from 'hotkeys-js';
	import * as fb2Template from './fb2.pug';
	import * as pageTemplate from './page.pug';
	import { onMount } from 'svelte';
	import { fetchJson, processHtml, parse, downloadImage, genresMap, replaceTag } from './utils.js';

	const NS = "http://www.gribuser.ru/xml/fictionbook/2.0";

	let loading = false;
	let percent = 0;

	onMount(() => {
		hotkeys('ctrl+s', event => {
			event.stopPropagation();
			event.preventDefault();
			if (!loading) {
				load();
			}
		});
		console.log(APP_TITLE + ' loaded');
	});

	async function load() {
		try {
			loading = true;
			percent = 0;

			const bookAlias = location.pathname.split('/', 2).find(Boolean);
			const { genres, chapters, author, description, createTime, title, images, country } = await fetchJson( bookAlias );
			const d = dayjs(createTime);

			const g = new Set(genres.map(g => genresMap[g.title]));
			g.delete(undefined);
			g.delete('');
			if (g.size < 1) {
				g.add('unrecognised');
			}

			const { mime, data } = await downloadImage(images[0].url);

			const concurrency = 5;

			const parts = await pMap(chapters.reverse(), async ({ slug }, i) => {
				try {
					return fetchJson(bookAlias + `/chapters/` +  slug );
				} catch (_) {
					return fetchJson(bookAlias + `/chapters/` +  slug );
				} finally {
					percent = Math.max(percent, ((i + 1) * 100 / chapters.length) | 0);
				}
			}, { concurrency });

			const assets = [];

			const body = processHtml(pageTemplate({	title, parts}), assets);//.replace(/<\/(section|header)><section><header><p>(.*?)\s+\(часть\s*(\d+)\)<\/p><\/header>/g, (_, tagBefore, title, chapter) => +chapter === 1 ? `<\/${tagBefore}><section><header><p>${title}<\/p><\/header>` : '');

			const annotation = processHtml(description, assets);

			const doc = parse(fb2Template({
				NS,
				genres: Array.from(g),
				title,
				annotation,
				lang: country ? country.code : undefined,
				author: author ? author.name : undefined,
				programName: APP_TITLE,
				bookAlias,
				shortDate: d.format('YYYY-MM-DD'),
				fullDate: d.format('DD.MM.YYYY'),
				body,
				attaches: [
					{ id: 'cover', mime, data },
					... await pMap(assets, async image => Object.assign(image, await downloadImage(image.src)), { concurrency })
				]
			}), 'application/xml');

			doc.querySelectorAll('header').forEach(e => replaceTag(doc, e, 'title', NS));

			saveAs(new Blob(['<?xml version="1.0" encoding="utf-8" ?>' + doc.documentElement.outerHTML], { type: "text/xml;charset=utf-8" }), bookAlias + '.fb2');
		} catch (e) {
			console.error(e);
			//todo better message
			alert('Ошибка загрузки. Попробуйте снова.');
		} finally {
			loading = false;
		}
	}
</script>
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import pug from 'rollup-plugin-pug';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';

const sourceMap = false;
const { name: APP_TITLE, version: APP_VERSION, description: APP_DESCRIPTION } = require('./package.json');

export default {
	input: 'src/main.ts',
	output: {
		sourcemap: sourceMap,
		format: 'iife',
		name: 'app',
		file: 'build/ranobe-rf-fb2-loader.user.js'
	},
	plugins: [
		svelte({ dev: sourceMap, preprocess: sveltePreprocess() }),
		resolve({ dedupe: ['svelte'] }),
		commonjs({ sourceMap }),
		typescript({ sourceMap }),
		replace({
			include: /\.svelte$/,
			values: { APP_VERSION: JSON.stringify(APP_VERSION), APP_TITLE: JSON.stringify(APP_TITLE) }
		}),
		terser({
			ecma: 2018,
			module: true,
			format: {
				//beautify: true,
				comments: /^\s+[=@]+(?!t)/,
				preamble: `// ==UserScript==
// @name         ${APP_TITLE}
// @namespace    taraflex
// @version      ${APP_VERSION}
// @description  ${APP_DESCRIPTION}
// @author       taraflex.red@gmail.com
// @downloadURL  https://raw.githubusercontent.com/Taraflex/ranobe-rf-fb2-loader/master/build/ranobe-rf-fb2-loader.user.js
// @match        https://xn--80ac9aeh6f.xn--p1ai/*
// @match        https://ranobes.com/ranobe/*
// @run-at       document-body
// @homepageURL  https://github.com/Taraflex/ranobe-rf-fb2-loader
// @supportURL   https://github.com/Taraflex/ranobe-rf-fb2-loader/issues
// @noframes
// ==/UserScript==`
			}
		}),
		pug({ sourceMap, pretty: true })
	]
};

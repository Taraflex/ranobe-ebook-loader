import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import sveltePreprocess from 'svelte-preprocess';
import pug from 'rollup-plugin-pug';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import userscript from './rollup-plugin-userscript';

const { name: APP_TITLE, version: APP_VERSION } = require('./package.json');
const APP_ICON = 'https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/icons/32.png';
const dev = !!process.env.ROLLUP_WATCH

export default {
	input: 'src/main.ts',
	preserveEntrySignatures: false,
	strictDeprecations: true,
	output: {
		dir: 'build',
		sourcemap: dev && 'inline'
	},
	plugins: [
		svelte({
			dev,
			//@ts-ignore
			preprocess: sveltePreprocess({
				sourceMap: false,
				typescript: {
					compilerOptions: {
						sourceMap: false
					}
				},
				//babel: { sourceMaps: false },
				scss: { sourceMap: false },
				sass: { sourceMap: false },
				stylus: { sourcemap: false },
				coffeescript: { sourceMap: false },
				postcss: dev ? {
					map: false,
					plugins: [
						require('autoprefixer')
					]
				} : {
						map: false,
						plugins: [
							require('postcss-flexbugs-fixes'),
							require('autoprefixer'),
							require('cssnano')
						]
					}
			})
		}),
		resolve({ dedupe: ['svelte'] }),
		commonjs({ sourceMap: dev }),
		typescript({
			inlineSourceMap: dev,
			inlineSources: dev,
		}),
		replace({
			include: /\.(ts|svelte)$/,
			values: {
				APP_TITLE_noquotes: APP_TITLE,
				APP_ICON: `"${APP_ICON}"`,
				APP_VERSION: `"${APP_VERSION}"`,
				APP_TITLE: `"${APP_TITLE}"`,
			}
		}),
		dev ? 0 : terser({
			ecma: 2018,
			module: true,
			format: {
				comments: /^\s+[=@][^t]/
			}
		}),
		pug({ sourceMap: dev, pretty: true }),
		userscript({
			meta: {
				downloadURL: 'https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/build/ranobe-ebook-loader.user.js',
				icon: APP_ICON,
				icon64: APP_ICON.replace('32.png', '64.png'),
				match: [
					'https://ранобэ.рф/*',
					'https://xn--80ac9aeh6f.xn--p1ai/*',
					'https://ranobes.com/ranobe/*',
					'https://tl.rulate.ru/book/*'
				],
				'run-at': 'document-idle',
				grant: ['GM_registerMenuCommand', 'GM_unregisterMenuCommand', 'GM_xmlhttpRequest'],
				connect: '*',
				noframes: ''
			},
			hot: dev && 'patch'
		})
	].filter(Boolean),
	watch: {
		clearScreen: false
	}
};
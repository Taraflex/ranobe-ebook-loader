const TerserPlugin = require('terser-webpack-plugin');
const { BannerPlugin } = require('webpack');
const path = require('path');
const { DefinePlugin } = require('webpack');

//@ts-ignore
const { name: APP_TITLE, version: APP_VERSION, description: APP_DESCRIPTION } = require('./package.json');

module.exports = {
	entry: {
		[`${APP_TITLE}.user`]: './src/app.js'
	},
	resolve: {
		extensions: ['.js', '.html']
	},
	output: {
		path: path.resolve(__dirname, './build'),
		filename: "[name].js",
	},
	node: false,
	optimization: {
		minimizer: [new TerserPlugin({
			terserOptions: {
				ecma: 7,
				compress: {
					collapse_vars: false
				},
				output: { comments: /^\s+[=@]+/ },
			}
		})],
	},
	module: {
		rules: [
			{
				test: /\.svelte\.html$/,
				exclude: /node_modules/,
				use: {
					loader: 'svelte-loader',
					options: {
						emitCss: false,
						hotReload: false
					}
				}
			}, {
				test: /\.(jpe?g|png|ttf|eot|svg|woff2?)(\?[a-z0-9=&.]+)?$/,
				use: 'base64-inline-loader'
			}, {
				test: /\.pug$/,
				use: {
					loader: 'pug-loader',
					options: {
						pretty: false
					}
				}
			}
		]
	},
	mode: 'production',
	plugins: [
		new DefinePlugin({
			'process.env.NODE_ENV': '"production"',
			DEBUG: 'false',
			APP_TITLE: "'" + APP_TITLE + "'"
		}),
		new BannerPlugin({
			banner: `// ==UserScript==
// @name         ${APP_TITLE}
// @namespace    taraflex
// @version      ${APP_VERSION}
// @description  ${APP_DESCRIPTION}
// @author       taraflex.red@gmail.com
// @downloadURL  https://raw.githubusercontent.com/Taraflex/ranobe-rf-fb2-loader/master/build/ranobe-rf-fb2-loader.user.js
// @updateURL    https://raw.githubusercontent.com/Taraflex/ranobe-rf-fb2-loader/master/build/ranobe-rf-fb2-loader.user.js
// @match        https://xn--80ac9aeh6f.xn--p1ai/*
// ==/UserScript==
`,
			raw: true,
			test: /\.user\./
		})
	]
};

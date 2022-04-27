import { resolve } from 'path';
import { promises as fs, readFileSync } from 'fs';
import { createServer } from 'http';

function g(k) { return global['__userscript_' + k]; }

function s(k, v) { global['__userscript_' + k] = v; }

function formatAuthor(author) {
    return author && [author.name || '', author.email ? `<${author.email}>` : '', author.url ? `(${author.url})` : ''].filter(Boolean).join(' ') || author;
}

function findUrl(o) {
    return o && (o.url || (o.email && ('mailto:' + o.email))) || o;
}

function fillPackageMeta(meta) {
    const {
        name,
        version,
        description,
        homepage,
        bugs,
        author,
        contributors,
        license
    } = JSON.parse(readFileSync('./package.json', 'utf-8'))

    const namespace = findUrl(author) || findUrl(contributors && contributors[0]);
    const supportURL = findUrl(bugs) || namespace;

    return Object.assign({
        name,
        namespace,
        author: formatAuthor(author) || formatAuthor(contributors && contributors[0]),
        version,
        description,
        supportURL,
        homepageURL: homepage || supportURL,
        license,
        updateURL: meta.downloadURL && meta.downloadURL.replace(/\.user\.js$/, '.meta.js'),
    }, meta)
}

const metaKeys = [
    "name",
    "namespace",
    "version",
    "author",
    "description",
    "license",
    "homepage",
    "homepageURL",
    "website",
    "source",
    "icon",
    "iconURL",
    "defaulticon",
    "icon64",
    "icon64URL",
    "downloadURL",
    "updateURL",
    "supportURL",
    "match",
    "include",
    "exclude",
    "require",
    "resource",
    "connect",
    "inject-into",
    "run-at",
    "grant",
    "noframes",
    "unwrap",
    "nocompat"
].reverse();
function banner(params) {
    const t = [];
    let maxLen = 0;
    for (let [k, v] of Object.entries(params).sort((a, b) => metaKeys.indexOf(b[0]) - metaKeys.indexOf(a[0]))) {
        if (Array.isArray(v)) {
            v.forEach(e => e && t.push([k, e]));
        } else {
            t.push([k, v || '']);
        }
        maxLen = Math.max(maxLen, k.length)
    }
    maxLen += 2;
    return [
        '// ==UserScript==',
        ...t.map(row => '// @' + row[0].padEnd(maxLen) + row[1]),
        '// ==/UserScript=='
    ].join('\n');
}

const reloadWrapper = '(' + ((props, port, path) => ({
    patchedImport: new Function('path', 'return import(path);'),
    then(cb) {
        for (let k in props) {
            Object.defineProperty(unsafeWindow, k, {
                value: props[k],
                enumerable: true
            });
        }
        let lastComp = null;
        const reload = async function (o) {
            lastComp && (lastComp.$destroy /*|| lastComp.dispose || lastComp.destroy*/)();
            lastComp = await cb(o);
            console.log(`[${new Date().toTimeString().split(' ')[0]}] ${path} reloaded`);
        }
        //@ts-ignore
        const source = new unsafeWindow.EventSource(`http://localhost:${port}/${encodeURIComponent(path)}`);
        //@ts-ignore
        source.addEventListener('patch', e => this.patchedImport('data:application/javascript;charset=utf-8;base64,' + e.data).then(reload));
        source.addEventListener('reload', () => { source.close(); location.reload() });
    }
})).toString() + ')';

function clientsStore(f, def) {
    return g('clients')[f] || (g('clients')[f] = def);
}

function send(reply, buf) {
    reply.write(`retry: ${g('reconnect_timeout')}\nevent: patch\ndata: ${buf.toString('base64')}\nid: ${Date.now()}\n\n`);
}

const stopServer = () => {
    const server = g('server_' + g('server_port'));
    server && server.close();
    s('server_' + g('server_port'), undefined);
    s('server_port', undefined);
}
[`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`].forEach(e => process.on(e, stopServer));

export default function (params) {
    let { meta, hot, port, reconnectTimeout } = params || {};
    port || (port = 9623);
    meta = fillPackageMeta(meta);
    if (hot) {
        (meta.grant || (meta.grant = [])).push('unsafeWindow')
    }

    s('reconnect_timeout', reconnectTimeout || 2000);
    s('allowed_origins', new Set((meta.match || []).map(u => new URL(u).origin)));

    const _banner = banner(meta);

    return {
        name: 'userscript-import-patcher',
        banner: () => _banner,
        outputOptions: o => Object.assign(o, {
            minifyInternalExports: false,
            generatedCode: {constBindings: true},
            freeze: false,
            inlineDynamicImports: !hot,
            format: 'es',
            chunkFileNames: '[name].js',
            sourcemap: o.sourcemap && 'inline',
            entryFileNames: meta.name + '.user.js'
        }),
        generateBundle() {
            //@ts-ignore
            this.emitFile({ type: 'asset', fileName: meta.name + '.meta.js', source: _banner });
        },
        ...(hot ? {
            renderStart({ dir }) {
                s('last_dir', dir);
            },
            renderDynamicImport: function ({ moduleId, format }) {
                return format === 'es' && this.getModuleInfo(moduleId).isEntry ? {
                    //todo optimize
                    left: reloadWrapper + '({\n' + [...meta.grant.filter(g => g && !g.includes('.')), 'CDATA', 'uneval', 'define', 'module', 'exports', 'context', 'unsafeWindow', 'cloneInto', 'exportFunction', 'createObjectIn', 'GM', 'GM_info'].map(p => `"${p}": typeof ${p} !== 'undefined' ? ${p} : undefined`).join(',\n') + `\n}, ${port}, `,
                    right: ')'
                } : null
            },
            renderChunk(code, { fileName, isDynamicEntry }, { dir }) {
                s('last_dir', dir);
                setImmediate(() => {
                    if (g('server_port') !== port) {
                        s('clients', Object.create(null));
                        stopServer();
                        if (hot) {
                            const server = createServer(async (request, reply) => {
                                try {
                                    console.log(request.headers);
                                    if (request.headers.origin && !g('allowed_origins').has(request.headers.origin)) {
                                        throw 'Invalid origin: ' + request.headers.origin;
                                    }
                                    const f = resolve(g('last_dir') + '/' + decodeURIComponent(request.url));
                                    const data = await fs.readFile(f);

                                    reply.socket.setTimeout(0);
                                    reply.socket.setNoDelay(true);
                                    reply.socket.setKeepAlive(true);

                                    reply.writeHead(200, '', Object.assign({
                                        "Content-Type": "text/event-stream",
                                        "Cache-Control": "no-cache, no-store, must-revalidate",
                                        "Connection": "keep-alive",
                                        "Vary": "Origin"
                                    }, (request.headers.origin ? {
                                        "Access-Control-Allow-Origin": request.headers.origin
                                    } : {})));
                                    reply.flushHeaders();
                                    const lastId = request.headers['last-event-id'];
                                    //todo check hash
                                    //if (lastId !== lastHash) {
                                    if (hot === 'patch' || !lastId) {
                                        send(reply, data);
                                    } else {
                                        reply.write(`event: reload\nid: ${Date.now()}\n\n`);
                                        console.log('after send reload');
                                    }

                                    clientsStore(f, []).push(reply);
                                } catch (e) {
                                    this.warn(e);
                                    reply.writeHead(404, e && (e.message || e.name) || undefined);
                                    reply.end();
                                }
                            });
                            server.timeout = 0;
                            server.on('error', e => this.warn(e))
                            server.listen({ port, hostname: '::' })
                            server.unref();
                            s('server_' + port, server);
                            s('server_port', port);
                        }
                    }
                    const c = isDynamicEntry && clientsStore(resolve(dir + '/' + fileName));
                    c && c.forEach((reply, i) => {
                        if (reply.finished || reply.destroyed || reply.socket.destroyed) {
                            c.splice(i, 1);
                            reply.destroy();
                        } else {
                            if (hot == 'patch') {
                                send(reply, Buffer.from(code));
                            } else {
                                reply.write(`event: reload\nid:${Date.now()}\n\n`);
                            }
                        }
                    });
                }).unref();
                return null;
            }
        } : {})
    }
}


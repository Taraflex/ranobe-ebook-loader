import assertNever from 'assert-never';
import { ancestor as walk } from 'babel-walk';
import fg from 'fast-glob';
import { readFileSync, writeFileSync } from 'fs';
import { basename, resolve } from 'path';
import { CodeGenerator } from 'pug-code-gen';
import lex from 'pug-lexer';
import pugparse from 'pug-parser';
import pug from 'pug-runtime';

import { parse } from '@babel/parser';
import * as t from '@babel/types';

function isReferenced(node: t.Node, parent: t.Node) {
    switch (parent.type) {
        // yes: { [NODE]: '' }
        // yes: { NODE }
        // no: { NODE: '' }
        case 'ObjectProperty':
            return parent.value === node || parent.computed;

        // no: break NODE;
        // no: continue NODE;
        case 'BreakStatement':
        case 'ContinueStatement':
            return false;

        // yes: left = NODE;
        // yes: NODE = right;
        case 'AssignmentExpression':
            return true;
    }

    return t.isReferenced(node, parent);
}

const isScope = (node: t.Node) => t.isFunctionParent(node) || t.isProgram(node);
const isBlockScope = (node: t.Node) =>
    t.isBlockStatement(node) || isScope(node);

const declaresArguments = (node: t.Node) =>
    t.isFunction(node) && !t.isArrowFunctionExpression(node);

const declaresThis = declaresArguments;

const LOCALS_SYMBOL = Symbol('locals');

const getLocals = (node: t.Node): Set<string> | undefined =>
    (node as any)[LOCALS_SYMBOL];
const declareLocals = (node: t.Node): Set<string> =>
    ((node as any)[LOCALS_SYMBOL] = (node as any)[LOCALS_SYMBOL] || new Set());

const setLocal = (node: t.Node, name: string) => declareLocals(node).add(name);

// First pass

function declareFunction(node: t.Function) {
    for (const param of node.params) {
        declarePattern(param, node);
    }
    const id = (node as t.FunctionDeclaration).id;
    if (id) {
        setLocal(node, id.name);
    }
}

function declarePattern(node: t.LVal, parent: t.Node) {
    switch (node.type) {
        case 'Identifier':
            setLocal(parent, node.name);
            break;
        case 'ObjectPattern':
            for (const prop of node.properties) {
                switch (prop.type) {
                    case 'RestElement':
                        declarePattern(prop.argument, parent);
                        break;
                    case 'ObjectProperty':
                        declarePattern(prop.value as t.LVal, parent);
                        break;
                    default:
                        assertNever(prop);
                        break;
                }
            }
            break;
        case 'ArrayPattern':
            for (const element of node.elements) {
                if (element) declarePattern(element, parent);
            }
            break;
        case 'RestElement':
            declarePattern(node.argument, parent);
            break;
        case 'AssignmentPattern':
            declarePattern(node.left, parent);
            break;
        // istanbul ignore next
        default:
            throw new Error('Unrecognized pattern type: ' + node.type);
    }
}

function declareModuleSpecifier(
    node:
        | t.ImportSpecifier
        | t.ImportDefaultSpecifier
        | t.ImportNamespaceSpecifier,
    _state: unknown,
    parents: t.Node[],
) {
    for (let i = parents.length - 2; i >= 0; i--) {
        if (isScope(parents[i])) {
            setLocal(parents[i], node.local.name);
            return;
        }
    }
}

const firstPass = walk({
    VariableDeclaration(node, _state, parents) {
        for (let i = parents.length - 2; i >= 0; i--) {
            if (
                node.kind === 'var'
                    ? t.isFunctionParent(parents[i])
                    : isBlockScope(parents[i])
            ) {
                for (const declaration of node.declarations) {
                    declarePattern(declaration.id, parents[i]);
                }
                return;
            }
        }
    },
    FunctionDeclaration(node, _state, parents) {
        if (node.id) {
            for (let i = parents.length - 2; i >= 0; i--) {
                if (isScope(parents[i])) {
                    setLocal(parents[i], node.id.name);
                    return;
                }
            }
        }
    },
    Function: declareFunction,
    ClassDeclaration(node, _state, parents) {
        for (let i = parents.length - 2; i >= 0; i--) {
            if (isScope(parents[i])) {
                setLocal(parents[i], node.id.name);
                return;
            }
        }
    },
    TryStatement(node) {
        if (node.handler === null) return;
        if (node.handler.param === null) return;
        declarePattern(node.handler.param, node.handler);
    },
    ImportDefaultSpecifier: declareModuleSpecifier,
    ImportSpecifier: declareModuleSpecifier,
    ImportNamespaceSpecifier: declareModuleSpecifier,
});

// Second pass

const secondPass = walk<{
    globals: (t.Identifier | t.ThisExpression)[];
}>({
    Identifier(node, state, parents) {
        const name = node.name;
        if (name === 'undefined') return;

        const lastParent = parents[parents.length - 2];
        if (lastParent) {
            if (!isReferenced(node, lastParent)) return;

            for (const parent of parents) {
                if (name === 'arguments' && declaresArguments(parent)) {
                    return;
                }
                if (getLocals(parent)?.has(name)) {
                    return;
                }
            }
        }

        state.globals.push(node);
    },

    ThisExpression(node, state, parents) {
        for (const parent of parents) {
            if (declaresThis(parent)) {
                return;
            }
        }

        state.globals.push(node);
    },
});

function findGlobals(ast: t.Node) {
    const globals: (t.Identifier | t.ThisExpression)[] = [];

    // istanbul ignore if
    if (!t.isNode(ast)) {
        throw new TypeError('Source must be a Babylon AST');
    }

    firstPass(ast, undefined);
    secondPass(ast, { globals });

    const groupedGlobals = new Map<string, (t.Identifier | t.ThisExpression)[]>();
    for (const node of globals) {
        const name: string = node.type === 'ThisExpression' ? 'this' : node.name;
        const existing = groupedGlobals.get(name);
        if (existing) {
            existing.push(node);
        } else {
            groupedGlobals.set(name, [node]);
        }
    }

    return [...groupedGlobals]
        .map(([name, nodes]) => ({ name, nodes }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * @param obj The object part of a with expression
 * @param src The body of the with expression
 * @param exclude A list of variable names to explicitly exclude
 */
function addWith(
    src: string,
    excludeSet: Set<string>,
) {
    let ast;
    try {
        ast = parse(src, {
            allowReturnOutsideFunction: true,
            allowImportExportEverywhere: true,
        });
    } catch (e) {
        throw Object.assign(
            new Error('Error parsing body of the with expression'),
            {
                component: 'src',
                babylonError: e,
            },
        );
    }

    const vars = new Set(
        findGlobals(ast).map((global) => global.name).filter((v) => !excludeSet.has(v)),
    );

    return Array.from(vars);
}

const pugfns = Object.values(pug);

for await (const entry of fg.stream(['./src/templates/**/*.pug'], { absolute: true })) {
    const filename = entry as string;
    const ast = pugparse(lex(readFileSync(filename, 'utf-8'), { filename }), { filename });

    const runtimeFunctionsUsed = new Set();
    CodeGenerator.prototype.runtime = function (name: string) {
        runtimeFunctionsUsed.add(name);
        return 'pug_' + name;
    };

    CodeGenerator.prototype.visitEach = function (each) {
        let indexVarName = each.key || 'pug_index' + this.eachCount;
        this.eachCount++;

        this.buf.push(
            '' +
            '// iterate ' +
            each.obj +
            '\n' +
            ';(function(){\n' +
            '  let $$obj = ' +
            each.obj +
            ';\n' +
            "  if ('number' == typeof $$obj.length) {"
        );

        if (each.alternate) {
            this.buf.push('    if ($$obj.length) {');
        }

        this.buf.push(
            '' +
            '      for (let ' +
            indexVarName +
            ' = 0, $$l = $$obj.length; ' +
            indexVarName +
            ' < $$l; ' +
            indexVarName +
            '++) {\n' +
            '        let ' +
            each.val +
            ' = $$obj[' +
            indexVarName +
            '];'
        );

        this.visit(each.block, each);

        this.buf.push('      }');

        if (each.alternate) {
            this.buf.push('    } else {');
            this.visit(each.alternate, each);
            this.buf.push('    }');
        }

        this.buf.push(
            '' +
            '  } else {\n' +
            '    let $$l = 0;\n' +
            '    for (let ' +
            indexVarName +
            ' in $$obj) {\n' +
            '      $$l++;\n' +
            '      let ' +
            each.val +
            ' = $$obj[' +
            indexVarName +
            '];'
        );

        this.visit(each.block, each);

        this.buf.push('    }');
        if (each.alternate) {
            this.buf.push('    if ($$l === 0) {');
            this.visit(each.alternate, each);
            this.buf.push('    }');
        }
        this.buf.push('  }\n}).call(this);\n');
    };

    const cc = new CodeGenerator(ast, {
        compileDebug: false,
        pretty: true,
        inlineRuntimeFunctions: false,
        self: true,
        templateName: '_'
    });

    const js = cc.compile().slice(20 /*'function _(locals) {'.length*/, -1).replace('var self = locals || {};', '');

    const vars = addWith(js, new Set([
        'clearInterval',
        'clearTimeout',
        'setInterval',
        'setTimeout',
        'queueMicrotask',
        'clearImmediate',
        'setImmediate',
        'eval',
        'isFinite',
        'isNaN',
        'parseFloat',
        'parseInt',
        'decodeURI',
        'decodeURIComponent',
        'encodeURI',
        'encodeURIComponent',
        'escape',
        'unescape',
        'JSON',
        'Math',
        'Object',
        'Function',
        'Boolean',
        'Symbol',
        'Error',
        'EvalError',
        'RangeError',
        'ReferenceError',
        'SyntaxError',
        'TypeError',
        'URIError',
        'Number',
        'Date',
        'URL',
        'String',
        'RegExp',
        'Array',
        'Int8Array',
        'Uint8Array',
        'Uint8ClampedArray',
        'Int16Array',
        'Uint16Array',
        'Int32Array',
        'Uint32Array',
        'Float32Array',
        'Float64Array',
        'ArrayBuffer',
        'DataView',
        'Map',
        'Set',
        'WeakMap',
        'WeakSet',
        'Promise',
        'Proxy',
        'SharedArrayBuffer',
        'Blob',
        'Intl',
        'NaN',
        'Infinity',
        'arguments',
        'undefined',
        'this',
        'locals',
        'pug',
        'pug_mixins',
        'pug_interp',
        'pug_debug_filename',
        'pug_debug_line',
        'pug_debug_sources',
        'pug_html',
    ].concat(Array.from(runtimeFunctionsUsed, n => 'pug_' + n))));

    const content = vars.length ?
        (
            runtimeFunctionsUsed.size ?
                `import {${Array.from(runtimeFunctionsUsed, r => `${r} as pug_${r}`).join(', ')}} from 'pug-runtime';\n\n` :
                ''
        ) + `export default function ({ ${vars.join(', ')} }:{ [_ in ${vars.map(v => `'${v}'`).join(' | ')}]: any } & { [_: string]: any }) {
${js}
}`:
        "export default `" + new Function(...pugfns.map(f => f['name']), js)(...pugfns) + "`;";

    writeFileSync(resolve(filename, '..', basename(filename, '.pug') + '.ts'), content);
}
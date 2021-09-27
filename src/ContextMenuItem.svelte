<script lang="ts" context="module">
    function inject(node: HTMLElement, parent: HTMLElement) {
        parent.appendChild(node);
        return {
            update(newParent: HTMLElement) {
                if (newParent != parent) {
                    parent = newParent;
                    parent.appendChild(node);
                }
            },
            destroy() {
                node.remove();
            },
        };
    }
</script>

<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let label = APP_TITLE;
    export let icon = APP_ICON;
    export let target: HTMLElement = null;
    export let klass = '';
    export let asBut = false;

    const emit = createEventDispatcher();
    function trigger() {
        emit('trigger');
    }

    function gm(_: HTMLElement, title: string) {
        let gmMenuId = typeof GM_registerMenuCommand !== 'undefined' && GM_registerMenuCommand(title, trigger);
        function destroy() {
            gmMenuId && GM_unregisterMenuCommand(gmMenuId);
        }
        return {
            destroy,
            update(title: string) {
                destroy();
                gmMenuId = typeof GM_registerMenuCommand !== 'undefined' && GM_registerMenuCommand(title, trigger);
            },
        };
    }
</script>

<menuitem {label} {icon} on:click={trigger} use:gm={label} />
{#if asBut}<button class={klass} on:click|preventDefault={trigger} use:inject={target}>{label}</button>{:else}<a href="#_" class={klass} on:click|preventDefault={trigger} use:inject={target}>{label}</a>{/if}

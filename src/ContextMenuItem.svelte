<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let label = APP_TITLE;
    export let icon = APP_ICON;

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

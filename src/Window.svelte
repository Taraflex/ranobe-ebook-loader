<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import hotkeys from 'hotkeys-js';

    function ctrlS(_: HTMLElement, cb: () => void) {
        hotkeys('ctrl+s', event => {
            event.stopImmediatePropagation();
            event.preventDefault();
            cb();
        });
        return {
            destroy() {
                hotkeys.unbind('ctrl+s');
            },
        };
    }

    const emit = createEventDispatcher();
    function dispatchSave() {
        emit('save');
    }
</script>

<svelte:window use:ctrlS={dispatchSave} />

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    const id = '_menu_' + APP_TITLE + '_' + Math.random().toString(16).replace('.', '');

    onMount(() => document.body.setAttribute('contextmenu', id));
    onDestroy(() => document.body.removeAttribute('contextmenu'));
</script>

<menu type="context" {id}>
    <slot />
</menu>

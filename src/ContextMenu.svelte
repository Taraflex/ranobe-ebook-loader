<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    const id = '_menu_' + APP_TITLE;
    export let label = '';
    export let icon = APP_ICON;
    onMount(() => document.body.setAttribute('contextmenu', id));
    onDestroy(() => document.body.removeAttribute('contextmenu'));
</script>

<menu type="context" {id}>
    <menuitem {label} {icon} on:click />
</menu>

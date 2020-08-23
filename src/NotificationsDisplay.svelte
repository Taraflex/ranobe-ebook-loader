<script lang="ts">
    let notifications = new Set<string>();
    export function add(s: string) {
        if (notifications.size !== notifications.add(s).size) {
            notifications = notifications;
        }
    }
    export function clear() {
        if (notifications.size > 0) {
            notifications.clear();
            notifications = notifications;
        }
    }
    function remove(id: string) {
        if (notifications.delete(id)) {
            notifications = notifications;
        }
    }
</script>

<style type="text/scss">
    @import './_mixins.scss';
    $bg-color: rgba(#d50000, 0.85);
    .u_d {
        @include overlay;
        bottom: $pad;
        right: $pad;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        color: white;
        pointer-events: none;
    }
    .u_n {
        margin: $pad;
        display: flex;
        pointer-events: auto;
    }
    .u_m {
        flex-grow: 1;
        background-color: $bg-color;
        padding: $pad * 2 $pad * 3 $pad * 2;
        border-top-left-radius: $pad;
        border-bottom-left-radius: $pad;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-width: calc(100vw - 70px);
        @include font;
    }
    .u_x {
        margin-left: 1px;
        background-color: $bg-color;
        padding: $pad * 2;
        border: 0;
        border-top-right-radius: $pad;
        border-bottom-right-radius: $pad;
        user-select: none;
        color: white;
        text-align: center;
        cursor: pointer;
        @include font;
    }
</style>

<div class="u_d">
    {#each Array.from(notifications.values()) as n (n)}
        <div class="u_n">
            <div class="u_m">{n}</div>
            <button class="u_x" on:click={() => remove(n)}>🞩</button>
        </div>
    {/each}
</div>

<script lang="ts" context="module">
    import { slide } from 'svelte/transition';
    import { notifications } from './stores';

    function copy(s: string, e: MouseEvent) {
        navigator.clipboard
            .writeText(s)
            .then(() => {
                const card = (e.target as HTMLElement).closest('.u_n') as HTMLElement;
                card.style.animation = null;
                card.getBoundingClientRect(); // https://gist.github.com/paulirish/5d52fb081b3570c81e3a
                card.style.animation = 'u_shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97)';
            })
            .catch(notifications.add);
    }
</script>

<style type="text/scss" global>
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

        transform: translate3d(0, 0, 0);
        backface-visibility: hidden;
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
    .u_r {
        display: flex;
        flex-direction: column;
        background-color: $bg-color;
        border-top-right-radius: $pad;
        border-bottom-right-radius: $pad;
        margin-left: 1px;
    }
    .u_b {
        background-color: transparent;
        padding: $pad * 2;
        border: 0;
        user-select: none;
        color: white;
        text-align: center;
        cursor: pointer;
        @include font;
    }
    .u_bf {
        @extend .u_b;
        padding-bottom: 0;
    }
    .u_bl {
        @extend .u_b;
        padding-top: 0;
    }
    .u_bb {
        @extend .u_n;
        @extend .u_b;
        background-color: $bg-color;
        border-radius: $pad;
    }
    @keyframes u_shake {
        10%,
        90% {
            transform: translate3d(-1px, 0, 0);
        }

        20%,
        80% {
            transform: translate3d(2px, 0, 0);
        }

        30%,
        50%,
        70% {
            transform: translate3d(-4px, 0, 0);
        }

        40%,
        60% {
            transform: translate3d(4px, 0, 0);
        }
    }
</style>

<div class="u_d">
    {#each Array.from($notifications) as n (n)}
        <div class="u_n" transition:slide|local>
            <div class="u_m">{n}</div>
            <div class="u_r">
                <button class="u_bf" on:click={() => notifications.remove(n)}>🞩</button>
                <button class="u_bl" title="Click to copy" on:click={e => copy(n, e)}>⎀</button>
            </div>
        </div>
    {/each}
    {#if $notifications.size > 2}
        <button class="u_bb" transition:slide|local on:click={notifications.clear}>Close all</button>
    {/if}
</div>

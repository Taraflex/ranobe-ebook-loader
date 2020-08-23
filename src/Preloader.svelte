<script>
    import { createEventDispatcher } from 'svelte';

    const dispatch = createEventDispatcher();

    export let percent = 0;
</script>

<style type="text/scss">
    @import './_mixins.scss';
    
    .u_b {
        @include overlay;
        background: rgba(255, 255, 255, 0.8);
        width: 100vw;
        height: 100vh;
        user-select: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .u_cancel {
        margin-top: 5%;
        @include fluid-type(240px, 960px, 16px, round(16px * 1.5));
        border: 0;
        background-color: $darkBlue;
        color: white;
        padding: 0 2em 0;
        line-height: 3em;
        border-radius: $pad;
        cursor: pointer;
        box-shadow: 0 0 0 $pad * 2 rgba($darkBlue, 0);
        transition: box-shadow 0.1s;
        &:hover,
        &:focus,
        &:active {
            outline: 0;
            box-shadow: 0 0 0 $pad * 2 rgba($darkBlue, 0.5);
        }
    }

    .u_c {
        position: relative;
        pointer-events: none;
        width: 100px;
        height: 100px;
        line-height: 100px;
        text-align: center;
        color: $darkBlue;
        @include fluid-type(240px, 960px, 14px, round(14px * 1.5));
        > * {
            width: 100%;
            height: 100%;
            position: absolute;
            &:before {
                content: '';
                display: block;
                margin: 0 auto;
                width: 15%;
                height: 15%;
                background-color: $darkBlue;
                border-radius: 100%;
                animation: u_a 1.2s infinite ease-in-out both;
            }
        }
    }

    @for $i from 2 through 12 {
        .u_c#{$i} {
            transform: rotate(($i - 1) * 30deg);
            &:before {
                animation-delay: ($i - 2) * 0.1 - 1.1s;
            }
        }
    }

    @keyframes u_a {
        0%,
        80%,
        100% {
            transform: scale(0);
        }

        40% {
            transform: scale(1);
        }
    }
</style>

<div class="u_b">
    <div class="u_c">
        <div class="u_c1" />
        <div class="u_c2" />
        <div class="u_c3" />
        <div class="u_c4" />
        <div class="u_c5" />
        <div class="u_c6" />
        <div class="u_c7" />
        <div class="u_c8" />
        <div class="u_c9" />
        <div class="u_c10" />
        <div class="u_c11" />
        <div class="u_c12" />
        {@html percent + '%'}
    </div>
    <button class="u_cancel" on:click={() => dispatch('cancel')}>Cancel</button>
</div>

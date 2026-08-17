<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// If this page is ever the one that gets launched — an installed icon on
	// iOS < 16.4 ignores start_url and opens whatever URL A2HS was triggered
	// from — bounce straight into the app so the installed icon never shows
	// marketing. Ordinary browser tabs never match any of these checks.
	onMount(() => {
		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: fullscreen)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
		if (standalone) window.location.replace(resolve('/today'));
	});
</script>

<svelte:head>
	<title>MedsAssist — Know what to take, right now</title>
	<meta
		name="description"
		content="MedsAssist tells you what to take right now, with a photo of the actual pill — so there's never any guessing."
	/>
</svelte:head>

<div class="site">
	<header class="site-header">
		<div class="wrap header-row">
			<span class="wordmark">MedsAssist</span>
			<a class="btn-text" href={resolve('/sign-in')}>Log in</a>
		</div>
	</header>

	<main>
		<section class="hero">
			<div class="wrap hero-row">
				<div class="hero-copy">
					<h1 class="t-display">What to take, right now.</h1>
					<p class="t-body-lg hero-sub">
						MedsAssist shows today's doses with a photo of the actual pill — so you're never
						guessing which one, or whether you already took it.
					</p>
					<a class="btn btn-primary hero-cta" href={resolve(data.signedIn ? '/today' : '/sign-in')}>
						{data.signedIn ? 'Open app' : 'Get started'}
					</a>
				</div>
			</div>
		</section>

		<section class="how">
			<div class="wrap">
				<h2 class="t-h2">How it works</h2>
				<div class="how-grid">
					<div class="how-card">
						<h3 class="t-label">1. Add your medicines</h3>
						<p class="t-body">Snap a photo of the label and pill — MedsAssist fills in the rest.</p>
					</div>
					<div class="how-card">
						<h3 class="t-label">2. See today's schedule</h3>
						<p class="t-body">
							One clear list of what's due now, what's upcoming, and what's missed.
						</p>
					</div>
					<div class="how-card">
						<h3 class="t-label">3. Never guess again</h3>
						<p class="t-body">Every dose shows the actual pill photo, right when you need it.</p>
					</div>
				</div>
			</div>
		</section>
	</main>

	<footer class="site-footer">
		<div class="wrap">
			<p class="t-caption">© {new Date().getFullYear()} MedsAssist</p>
		</div>
	</footer>
</div>

<style>
	.wrap {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 var(--sp-6);
	}

	.site-header {
		border-bottom: 1px solid rgba(20, 32, 28, 0.08);
	}

	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 72px;
	}

	.wordmark {
		font-family: var(--font-sans);
		font-weight: 700;
		font-size: 1.25rem;
		color: var(--sage-700);
	}

	.hero {
		padding: var(--sp-16) 0;
	}

	.hero-row {
		display: flex;
		justify-content: center;
	}

	.hero-copy {
		max-width: 640px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-6);
	}

	.hero-sub {
		color: var(--ink-2);
	}

	.hero-cta {
		margin-top: var(--sp-2);
	}

	.how {
		padding: var(--sp-16) 0;
		background: rgba(15, 93, 78, 0.04);
	}

	.how-grid {
		margin-top: var(--sp-8);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: var(--sp-6);
	}

	.how-card {
		background: var(--ground);
		border-radius: var(--r-card);
		box-shadow: var(--shadow-1);
		padding: var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}

	.how-card h3 {
		color: var(--sage-700);
	}

	.how-card p {
		color: var(--ink-2);
	}

	.site-footer {
		padding: var(--sp-8) 0;
		border-top: 1px solid rgba(20, 32, 28, 0.08);
	}

	.site-footer p {
		color: var(--ink-3);
	}

	@media (max-width: 640px) {
		.hero {
			padding: var(--sp-12) 0;
		}
		.how {
			padding: var(--sp-12) 0;
		}
	}
</style>

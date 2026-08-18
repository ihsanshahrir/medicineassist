<!--
  Public marketing page — the one screen a visitor sees before signing in, so
  it carries the whole credibility burden for a health app.

  Specimen: design/preview/screens-landing.html. Everything here composes from
  design/colors_and_type.css; the layout is scoped rather than promoted to
  global classes because only this page and /sign-in use it.

  Claims in the Trust section are all verifiable in this codebase (export via
  /api/me/export, delete in Settings, offline caching in src/sw.ts) — a health
  product that overstates is the fastest way to look less official, not more.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { isStandalone } from '$lib/client/platform';
	import InstallAction from '$lib/components/InstallAction.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// If this page is ever the one that gets launched — an installed icon on
	// iOS < 16.4 ignores start_url and opens whatever URL A2HS was triggered
	// from — bounce straight into the app so the installed icon never shows
	// marketing. Ordinary browser tabs never match any of these checks.
	onMount(() => {
		if (isStandalone()) window.location.replace(resolve('/today'));
	});

	const HOW = [
		{
			n: '1',
			title: 'Add your medicines',
			body: 'Photograph the label and the pill. MedsAssist reads the label and fills in the rest — you just confirm it.'
		},
		{
			n: '2',
			title: "See today's schedule",
			body: "One clear list: what's due now, what's coming later, and what was missed. No hunting through a calendar."
		},
		{
			n: '3',
			title: 'Never guess again',
			body: 'Every dose shows a photo of the actual pill, at the moment you need it — not a stock image of a generic tablet.'
		}
	];

	const TRUST = [
		{
			title: 'Your records stay yours',
			body: 'Export everything you have entered at any time, and delete your account and its data outright from Settings.'
		},
		{
			title: 'Works without a signal',
			body: "Today's doses stay readable offline, so a dead zone or an expired data plan never hides your schedule."
		},
		{
			title: 'No ads, nothing sold',
			body: 'MedsAssist does not sell or share your medicine list. There is no advertising anywhere in the app.'
		},
		{
			title: 'Not a substitute for your doctor',
			body: 'MedsAssist helps you follow the plan you were given. It does not diagnose, prescribe, or change a dose.'
		}
	];
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
			<a class="brand" href={resolve('/')}>
				<img src="/icons/icon-192.png" alt="" width="36" height="36" />
				<span class="wordmark">MedsAssist</span>
			</a>
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
					<div class="hero-actions">
						<a
							class="btn btn-primary hero-cta"
							href={resolve(data.signedIn ? '/today' : '/sign-in')}
						>
							{data.signedIn ? 'Open app' : 'Get started'}
						</a>
						<InstallAction class="btn btn-secondary hero-install" />
					</div>
					<p class="t-caption hero-note">Free to use. No password to remember.</p>
				</div>

				<div class="hero-shot">
					<img
						src="/marketing/today-hero.png"
						alt="The MedsAssist Today screen: an 8:00 AM morning dose card showing Metformin and Amlodipine with pill photos and a Taken all button, above a timeline of the rest of the day."
						width="446"
						height="900"
					/>
				</div>
			</div>
		</section>

		<section class="how">
			<div class="wrap">
				<h2 class="t-title">How it works</h2>
				<div class="how-grid">
					{#each HOW as step (step.n)}
						<div class="how-card">
							<span class="step-num" aria-hidden="true">{step.n}</span>
							<h3 class="t-h2">{step.title}</h3>
							<p class="t-body">{step.body}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<section class="trust">
			<div class="wrap">
				<h2 class="t-title">Built to be trusted with this</h2>
				<p class="t-body-lg trust-lede">
					A medicine list is sensitive. Here is exactly how MedsAssist treats it.
				</p>
				<div class="trust-grid">
					{#each TRUST as item (item.title)}
						<div class="trust-item">
							<h3 class="t-h2">{item.title}</h3>
							<p class="t-body">{item.body}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>
	</main>

	<footer class="site-footer">
		<div class="wrap footer-inner">
			<span class="wordmark footer-mark">MedsAssist</span>
			<p class="t-caption disclaimer">
				MedsAssist is a medicine reminder and comprehension tool. It is not medical advice — always
				follow the instructions from your doctor or pharmacist.
			</p>
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

	/* ---------- Header ---------- */
	.site-header {
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}
	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		/* Wraps rather than overflowing: at 200% OS text scale the wordmark and
		   "Log in" together exceed a 390px screen, and the PRD's acceptance
		   criterion is no horizontal scroll at that size. */
		flex-wrap: wrap;
		min-height: 72px;
		gap: var(--sp-2) var(--sp-4);
		padding-block: var(--sp-2);
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		text-decoration: none;
		min-height: var(--tap-min);
	}
	.brand img {
		border-radius: var(--r-chip);
		display: block;
	}
	.wordmark {
		font-weight: 700;
		font-size: var(--t-h2-size);
		line-height: var(--t-h2-line);
		color: var(--sage-700);
		letter-spacing: -0.01em;
	}

	/* ---------- Hero ---------- */
	.hero {
		background: var(--surface);
		padding: var(--sp-16) 0;
		border-bottom: 1px solid var(--line);
	}
	.hero-row {
		display: flex;
		align-items: center;
		gap: var(--sp-16);
	}
	.hero-copy {
		flex: 1 1 480px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-5);
	}
	.hero-sub {
		color: var(--ink-2);
		margin: 0;
		max-width: 34em;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--tap-gap);
		width: 100%;
	}
	/* .btn-primary is width:100% by default — right for a phone form, wrong
	   for a hero sitting next to a second action. */
	.hero-actions :global(.hero-cta),
	.hero-actions :global(.hero-install) {
		width: auto;
		min-height: var(--tap-primary);
		padding: 0 var(--sp-8);
	}
	.hero-note {
		margin: 0;
	}
	.hero-shot {
		flex: 0 1 auto;
		display: flex;
		justify-content: center;
	}
	.hero-shot img {
		width: 100%;
		max-width: 300px;
		height: auto;
		display: block;
	}

	/* ---------- How it works ---------- */
	.how {
		padding: var(--sp-16) 0;
	}
	.how-grid {
		margin-top: var(--sp-8);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
		gap: var(--sp-6);
	}
	.how-card {
		background: var(--surface);
		border-radius: var(--r-card);
		box-shadow: var(--shadow-2);
		padding: var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: var(--r-pill);
		background: var(--sage-100);
		color: var(--sage-800);
		font-size: var(--t-h2-size);
		font-weight: 700;
	}
	.how-card h3 {
		margin: 0;
	}
	.how-card p {
		margin: 0;
		color: var(--ink-2);
	}

	/* ---------- Trust ---------- */
	.trust {
		background: var(--sage-100);
		padding: var(--sp-16) 0;
	}
	.trust-lede {
		color: var(--ink-2);
		margin: var(--sp-3) 0 0;
		max-width: 40em;
	}
	/* Four items, so a 3-up grid would strand one alone on a second row.
	   420px forces 2-up at the 1080px wrap and 1-up on a phone. The min()
	   matters: a bare minmax(420px, 1fr) keeps its 420px floor even when the
	   container is only 342px wide, which overflows the screen. */
	.trust-grid {
		margin-top: var(--sp-8);
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
		gap: var(--sp-6);
	}
	.trust-item {
		background: var(--surface);
		border-radius: var(--r-card);
		padding: var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.trust-item h3 {
		margin: 0;
		color: var(--sage-800);
	}
	.trust-item p {
		margin: 0;
		color: var(--ink-2);
	}

	/* ---------- Footer ---------- */
	.site-footer {
		background: var(--surface);
		border-top: 1px solid var(--line);
		padding: var(--sp-10) 0;
	}
	.footer-inner {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.footer-mark {
		font-size: var(--t-body-lg-size);
	}
	.footer-inner p {
		margin: 0;
	}
	.disclaimer {
		max-width: 52em;
	}

	@media (max-width: 900px) {
		.hero-row {
			flex-direction: column;
			gap: var(--sp-10);
			text-align: left;
		}
		.hero {
			padding: var(--sp-12) 0;
		}
		.how,
		.trust {
			padding: var(--sp-12) 0;
		}
	}

	@media (max-width: 520px) {
		/* Below this the two hero actions can't sit side by side without one
		   of them dropping under the 48px target floor. */
		.hero-actions {
			flex-direction: column;
			align-items: stretch;
		}
		.hero-actions :global(.hero-cta),
		.hero-actions :global(.hero-install) {
			width: 100%;
		}
	}
</style>

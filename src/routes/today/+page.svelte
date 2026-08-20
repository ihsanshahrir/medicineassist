<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import DoseCard from '$lib/components/DoseCard.svelte';
	import MedicineRow from '$lib/components/MedicineRow.svelte';
	import Pictogram from '$lib/components/Pictogram.svelte';
	import { apiFetch } from '$lib/client/api';
	import { resolve } from '$app/paths';
	import { anchorText, formatTimeLabel, resolveAnchor } from '$lib/shared/formatTime';
	import {
		deriveDoseState,
		formatLateBy,
		isActionableNow,
		SNOOZE_MAX,
		UNDO_GRACE_MS,
		type DoseDisplayState
	} from '$lib/shared/doseState';
	import { enableReminders, getPushStatus, type PushStatus } from '$lib/client/push';
	import type { TodayOccurrence, TodayResponse } from '$lib/shared/types';

	let loading = $state(true);
	let data = $state<TodayResponse | null>(null);
	let loadError = $state('');
	let actionError = $state('');
	let pendingKeys = new SvelteSet<string>(); // in-flight actions, disables their controls

	// The page must advance state on its own: a dose crosses upcoming -> due ->
	// overdue purely by the clock moving, and before this the page only ever
	// evaluated once on mount, so a dose left on screen stayed "Upcoming"
	// forever. nowMs ticks locally and every derived group recomputes from it.
	// skewMs corrects a device clock that disagrees with the server, since the
	// scheduled times were computed server-side.
	let skewMs = $state(0);
	let nowMs = $state(Date.now());

	const key = (o: Pick<TodayOccurrence, 'medicineId' | 'scheduledAt'>) =>
		`${o.medicineId}::${o.scheduledAt}`;

	async function load(silent = false) {
		if (!silent) loading = true;
		loadError = '';
		try {
			const res = await apiFetch<TodayResponse>('/api/today');
			data = res;
			skewMs = new Date(res.serverNow).getTime() - Date.now();
			nowMs = Date.now() + skewMs;
		} catch (err) {
			if (!silent) loadError = err instanceof Error ? err.message : 'Could not load today.';
		} finally {
			loading = false;
		}
	}

	// ---- derived view model -------------------------------------------------

	let tz = $derived(data?.tzOffsetMinutes);

	interface Entry {
		o: TodayOccurrence;
		state: DoseDisplayState;
		lateByMs: number;
		returnsAtMs: number | null;
	}
	interface Group {
		scheduledAt: string;
		entries: Entry[];
	}

	let entries = $derived<Entry[]>(
		(data?.occurrences ?? []).map((o) => ({ o, ...deriveDoseState(o, nowMs) }))
	);

	/** Doses sharing a scheduled time are one card — Rahman on nine medicines
	 *  must not face nine cards at breakfast (PRD §F3). Grouping by the time
	 *  itself, rather than by "everything near the clock", is what stops two
	 *  different times merging under a single header. */
	let groups = $derived<Group[]>(groupByScheduledAt(entries));

	// A run-length scan rather than Map.groupBy: /api/today already returns
	// occurrences sorted by scheduledAt, so equal times are always adjacent, and
	// Map.groupBy needs Chrome 117+ / Safari 17.4+ — too new for the low-end SEA
	// handsets this PWA targets.
	function groupByScheduledAt(list: Entry[]): Group[] {
		const out: Group[] = [];
		for (const e of list) {
			const last = out[out.length - 1];
			if (last && last.scheduledAt === e.o.scheduledAt) last.entries.push(e);
			else out.push({ scheduledAt: e.o.scheduledAt, entries: [e] });
		}
		return out;
	}

	/** A group is still on the Now card while anything in it needs an answer, and
	 *  for a grace window after it was answered so Undo has somewhere to live. */
	function isActiveGroup(g: Group): boolean {
		if (g.entries.some((e) => isActionableNow(e.state))) return true;
		return g.entries.some(
			(e) => e.o.takenAt && nowMs - new Date(e.o.takenAt).getTime() < UNDO_GRACE_MS
		);
	}

	let activeGroups = $derived(groups.filter(isActiveGroup));

	/** When nothing is due, the card shows the next dose read-only rather than
	 *  vanishing — the Today screen should never be a blank between windows. */
	let nextUpGroup = $derived(
		activeGroups.length > 0
			? null
			: (groups.find((g) => g.entries.every((e) => e.state === 'upcoming')) ?? null)
	);

	let cardKeys = $derived(
		new Set([...activeGroups, ...(nextUpGroup ? [nextUpGroup] : [])].map((g) => g.scheduledAt))
	);
	let timeline = $derived(entries.filter((e) => !cardKeys.has(e.o.scheduledAt)));

	function groupBusy(g: Group): boolean {
		return g.entries.some((e) => pendingKeys.has(key(e.o)));
	}
	function groupCanSnooze(g: Group): boolean {
		return snoozable(g).length > 0;
	}
	function groupUndoable(g: Group): Entry[] {
		return g.entries.filter(
			(e) =>
				e.state === 'taken' &&
				e.o.takenAt &&
				nowMs - new Date(e.o.takenAt).getTime() < UNDO_GRACE_MS
		);
	}

	function subtitleFor(e: Entry): string {
		switch (e.state) {
			case 'taken':
				return e.o.takenAt ? `Taken at ${formatTimeLabel(e.o.takenAt, tz)}` : 'Taken';
			case 'skipped':
				return 'Skipped by you';
			case 'missed':
				return 'Not marked';
			case 'snoozed':
				return e.returnsAtMs
					? `Back at ${formatTimeLabel(new Date(e.returnsAtMs).toISOString(), tz)}`
					: 'Snoozed';
			case 'overdue':
				return formatLateBy(e.lateByMs);
			default:
				return `${e.o.doseAmount} ${e.o.doseUnit}${e.o.doseAmount === 1 ? '' : 's'}`;
		}
	}

	// ---- actions ------------------------------------------------------------

	type Action = 'take' | 'skip' | 'snooze' | 'undo';

	/** One request per dose, then ONE reload. The previous version awaited a full
	 *  /api/today inside each action, so "Taken all" on nine medicines fired nine
	 *  POSTs and nine GETs racing each other, and the snooze/skip paths used an
	 *  un-awaited forEach whose rejections were never surfaced at all — a snooze
	 *  refused for hitting the limit looked exactly like nothing happening. */
	async function act(targets: TodayOccurrence[], action: Action) {
		if (targets.length === 0) return;
		actionError = '';
		const keys = targets.map(key);
		keys.forEach((k) => pendingKeys.add(k));
		try {
			const results = await Promise.allSettled(
				targets.map((o) =>
					apiFetch('/api/dose-logs', {
						method: 'POST',
						body: JSON.stringify({ medicineId: o.medicineId, scheduledAt: o.scheduledAt, action })
					})
				)
			);
			const failure = results.find((r) => r.status === 'rejected');
			if (failure && failure.status === 'rejected') {
				actionError = messageFor(failure.reason, action);
			}
		} finally {
			keys.forEach((k) => pendingKeys.delete(k));
			await load(true);
		}
	}

	function messageFor(reason: unknown, action: Action): string {
		const raw = reason instanceof Error ? reason.message : String(reason);
		if (raw === 'snooze_limit_reached') {
			return `Snoozed twice already — please take or skip this dose.`;
		}
		if (raw === 'undo_window_expired') {
			return 'That was too long ago to undo.';
		}
		return `Could not ${action} that dose. Please try again.`;
	}

	/** Take/Skip apply to everything still open in the group, including a dose
	 *  that is currently snoozed. */
	const unresolved = (g: Group) =>
		g.entries.filter((e) => e.state !== 'taken' && e.state !== 'skipped').map((e) => e.o);

	/** Snooze applies only to what is actually due — re-snoozing an already
	 *  snoozed dose would burn a second one of its two allowed snoozes. */
	const snoozable = (g: Group) =>
		g.entries
			.filter((e) => isActionableNow(e.state) && e.o.snoozeCount < SNOOZE_MAX)
			.map((e) => e.o);

	function toggleOne(g: Group, k: string) {
		const e = g.entries.find((x) => key(x.o) === k);
		if (!e) return;
		act([e.o], e.state === 'taken' ? 'undo' : 'take');
	}

	// ---- push ---------------------------------------------------------------

	let pushStatus = $state<PushStatus | 'checking'>('checking');
	let enablingPush = $state(false);
	let pushError = $state('');

	async function turnOnReminders() {
		pushError = '';
		enablingPush = true;
		try {
			await enableReminders();
			pushStatus = 'subscribed';
		} catch (err) {
			pushError = err instanceof Error ? err.message : 'Could not turn on reminders.';
		} finally {
			enablingPush = false;
		}
	}

	onMount(() => {
		load();
		getPushStatus().then((s) => (pushStatus = s));

		const tick = setInterval(() => (nowMs = Date.now() + skewMs), 30_000);
		// The local clock advances display state, but the DB still owns snooze
		// wake-ups and the missed sweep, so refetch periodically and whenever the
		// user comes back to the tab (which is when a stale screen is most visible).
		const refetch = setInterval(() => load(true), 5 * 60_000);
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				nowMs = Date.now() + skewMs;
				load(true);
			}
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			clearInterval(tick);
			clearInterval(refetch);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<svelte:head>
	<title>Today · MedsAssist</title>
</svelte:head>

<main>
	<div class="header">
		<h1 class="t-title">Today</h1>
	</div>

	{#if loading}
		<p class="t-body loading">Loading…</p>
	{:else if loadError}
		<div class="load-error">
			<p class="t-body">{loadError}</p>
			<button class="btn btn-secondary" onclick={() => load()}>Try again</button>
		</div>
	{:else if data}
		{#if pushStatus === 'unsubscribed'}
			<div class="push-banner">
				<div>
					<b>Turn on reminders</b>
					<span>MedsAssist can only remind you at the right time if notifications are on.</span>
					{#if pushError}<span class="push-error">{pushError}</span>{/if}
				</div>
				<button
					class="btn btn-secondary push-btn"
					onclick={turnOnReminders}
					disabled={enablingPush}
				>
					{enablingPush ? 'Turning on…' : 'Turn on'}
				</button>
			</div>
		{:else if pushStatus === 'denied'}
			<div class="push-banner">
				<div>
					<b>Reminders are blocked</b>
					<span
						>Notifications were denied for this site — enable them in your browser settings.</span
					>
				</div>
			</div>
		{/if}

		{#if actionError}
			<div class="action-error" role="alert">{actionError}</div>
		{/if}

		{#each activeGroups as g (g.scheduledAt)}
			{@const anchor = resolveAnchor(g.entries[0].o.anchorLabel, g.scheduledAt, tz)}
			{@const late = g.entries.find((e) => e.state === 'overdue')}
			{@const undoable = groupUndoable(g)}
			<div class="card-slot">
				<DoseCard
					timeLabel={formatTimeLabel(g.scheduledAt, tz)}
					anchorLabel={anchor}
					anchorText={anchorText(anchor)}
					lateLabel={late ? formatLateBy(late.lateByMs) : null}
					busy={groupBusy(g)}
					canSnooze={groupCanSnooze(g)}
					medicines={g.entries.map((e) => ({
						doseLogId: key(e.o),
						medicineId: e.o.medicineId,
						name: e.o.medicineName,
						strength: e.o.medicineStrength,
						accentIndex: e.o.accentIndex,
						doseAmount: e.o.doseAmount,
						doseUnit: e.o.doseUnit,
						state: e.state
					}))}
					onTakeAll={() => act(unresolved(g), 'take')}
					onToggleOne={(k) => toggleOne(g, k)}
					onSnooze={() => act(snoozable(g), 'snooze')}
					onSkip={() => act(unresolved(g), 'skip')}
					onUndoAll={undoable.length > 0
						? () =>
								act(
									undoable.map((e) => e.o),
									'undo'
								)
						: undefined}
				/>
			</div>
		{/each}

		{#if nextUpGroup}
			{@const anchor = resolveAnchor(
				nextUpGroup.entries[0].o.anchorLabel,
				nextUpGroup.scheduledAt,
				tz
			)}
			<div class="card-slot">
				<DoseCard
					variant="next-up"
					timeLabel={formatTimeLabel(nextUpGroup.scheduledAt, tz)}
					anchorLabel={anchor}
					anchorText={anchorText(anchor)}
					medicines={nextUpGroup.entries.map((e) => ({
						doseLogId: key(e.o),
						medicineId: e.o.medicineId,
						name: e.o.medicineName,
						strength: e.o.medicineStrength,
						accentIndex: e.o.accentIndex,
						doseAmount: e.o.doseAmount,
						doseUnit: e.o.doseUnit,
						state: e.state
					}))}
				/>
			</div>
		{/if}

		{#if timeline.length > 0}
			<h2 class="t-h2 section-title">Today</h2>
			{#each timeline as e (key(e.o))}
				{@const busy = pendingKeys.has(key(e.o))}
				<MedicineRow
					state={e.state}
					title="{formatTimeLabel(e.o.scheduledAt, tz)} · {e.o.medicineName}"
					subtitle={subtitleFor(e)}
					{busy}
					onTake={e.state === 'missed' || e.state === 'skipped'
						? () => act([e.o], 'take')
						: undefined}
					onSkip={e.state === 'missed' ? () => act([e.o], 'skip') : undefined}
					onUndo={e.state === 'taken' &&
					e.o.takenAt &&
					nowMs - new Date(e.o.takenAt).getTime() < UNDO_GRACE_MS
						? () => act([e.o], 'undo')
						: undefined}
				/>
			{/each}
		{/if}

		{#each data.supplyWarnings as w (w.medicineId)}
			<div class="warn-banner">
				<Pictogram id="pic-keep-refrigerated" label="Low supply" size={22} />
				<div>
					<b>{w.medicineName} running low</b>
					<span>{w.daysRemaining} days remaining</span>
				</div>
			</div>
		{/each}

		{#if groups.length === 0}
			<div class="empty">
				<p class="t-body-lg">No medicines yet.</p>
				<a class="btn btn-primary" href={resolve('/medicines/add')}>Add your first medicine</a>
			</div>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 460px;
		margin: 0 auto;
		padding: var(--sp-5) var(--sp-4) var(--sp-10);
	}
	.header {
		margin-bottom: var(--sp-4);
	}
	.loading {
		text-align: center;
		color: var(--ink-2);
		padding: var(--sp-10) 0;
	}
	.load-error {
		text-align: center;
		padding: var(--sp-10) var(--sp-4);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
	}
	.load-error p {
		color: var(--ink-2);
	}
	.load-error .btn {
		width: auto;
		padding: 0 var(--sp-6);
	}
	.card-slot + .card-slot {
		margin-top: var(--sp-3);
	}
	.section-title {
		margin: var(--sp-6) 0 var(--sp-2);
	}
	.action-error {
		background: var(--warn-bg);
		border: 1px solid var(--warn-border);
		color: var(--warn-text);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-4);
		margin-bottom: var(--sp-3);
		font-size: var(--t-body-size);
	}
	.push-banner {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--surface);
		box-shadow: var(--shadow-1);
		border-radius: var(--r-card);
		padding: var(--sp-4);
		margin-bottom: var(--sp-4);
	}
	.push-banner b {
		display: block;
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
	}
	.push-banner span {
		display: block;
		font-size: var(--t-caption-size);
		color: var(--ink-2);
		margin-top: 2px;
	}
	.push-error {
		color: var(--danger-text) !important;
	}
	.push-btn {
		flex: 0 0 auto;
		min-height: var(--tap-min);
		padding: 0 var(--sp-4);
	}
	.warn-banner {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		background: var(--warn-bg);
		border: 1px solid var(--warn-border);
		border-radius: var(--r-inner);
		padding: var(--sp-3) var(--sp-4);
		color: var(--warn-text);
		margin-top: var(--sp-3);
	}
	.warn-banner b {
		display: block;
		font-size: var(--t-body-size);
		line-height: var(--t-body-line);
	}
	.warn-banner span {
		font-size: var(--t-caption-size);
		color: var(--ink-2);
	}
	.empty {
		text-align: center;
		padding: var(--sp-16) var(--sp-4);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
	}
	.empty p {
		color: var(--ink-2);
	}
	.empty .btn-primary {
		width: auto;
		display: inline-flex;
		text-decoration: none;
		padding: 0 var(--sp-6);
	}
</style>

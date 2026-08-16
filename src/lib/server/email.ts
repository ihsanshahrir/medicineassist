// Thin Resend wrapper — no SDK dependency, it's one endpoint. Without a
// RESEND_API_KEY (local dev without one configured — see .dev.vars.example)
// this logs the code instead of sending, so the whole OTP flow is testable
// end-to-end with zero external credentials. Production always has the key
// set via `wrangler secret put RESEND_API_KEY`, so this fallback never fires
// there.
export async function sendOtpEmail(
	env: { RESEND_API_KEY?: string },
	to: string,
	code: string
): Promise<void> {
	if (!env.RESEND_API_KEY) {
		console.log(`[dev-only, no RESEND_API_KEY set] OTP for ${to}: ${code}`);
		return;
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			// TODO once a real sending domain is verified in Resend, swap this
			// for e.g. "MedsAssist <noreply@medsassist.app>".
			from: 'MedsAssist <onboarding@resend.dev>',
			to,
			subject: 'Your MedsAssist sign-in code',
			text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`
		})
	});

	if (!res.ok) {
		throw new Error(`Resend API error ${res.status}: ${await res.text()}`);
	}
}

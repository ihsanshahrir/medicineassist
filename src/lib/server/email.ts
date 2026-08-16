// Thin SendGrid wrapper — no SDK dependency, it's one endpoint. Without a
// SENDGRID_API_KEY (local dev without one configured — see
// .dev.vars.example) this logs the code instead of sending, so the whole
// OTP flow is testable end-to-end with zero external credentials.
// Production always has the key set via `wrangler secret put
// SENDGRID_API_KEY`, so this fallback never fires there.
//
// SENDGRID_FROM_EMAIL must be a Single Sender verified in SendGrid's
// dashboard (Settings > Sender Authentication) — no domain/DNS needed for
// that, unlike full domain authentication. Verification only restricts the
// *from* address; once verified, mail can go to any recipient.
export async function sendOtpEmail(
	env: { SENDGRID_API_KEY?: string; SENDGRID_FROM_EMAIL?: string },
	to: string,
	code: string
): Promise<void> {
	if (!env.SENDGRID_API_KEY) {
		console.log(`[dev-only, no SENDGRID_API_KEY set] OTP for ${to}: ${code}`);
		return;
	}

	const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			personalizations: [{ to: [{ email: to }] }],
			from: { email: env.SENDGRID_FROM_EMAIL, name: 'MedsAssist' },
			subject: 'Your MedsAssist sign-in code',
			content: [
				{
					type: 'text/plain',
					value: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`
				}
			]
		})
	});

	if (!res.ok) {
		throw new Error(`SendGrid API error ${res.status}: ${await res.text()}`);
	}
}

import crypto from 'crypto';

// Lazy-initialized Resend client (ESM import hoisting means env vars are undefined at module level)
let resend;
async function getResend() {
  if (!resend) {
    const { Resend } = await import('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendMagicLinkCode(email, code) {
  // In dev mode, just log the code
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Magic link code for ${email}: ${code}`);
    return true;
  }

  try {
    const client = await getResend();
    await client.emails.send({
      from: 'AI Notecards <noreply@mail.ainotecards.com>',
      to: email,
      subject: `${code} is your AI Notecards code`,
      headers: {
        'X-Entity-Ref-ID': crypto.randomUUID(),
      },
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1A1614; margin-bottom: 8px;">AI Notecards</h2>
          <p style="color: #6B635A; margin-bottom: 24px;">Enter this code to sign in:</p>
          <div style="background: #F5F5F5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1614;">${code}</span>
          </div>
          <p style="color: #6B635A; font-size: 14px;">This code expires in 10 minutes.</p>
          <p style="color: #6B635A; font-size: 14px;">If you didn't request this code, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send magic link email:', err);
    return false;
  }
}

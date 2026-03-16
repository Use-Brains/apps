import crypto from 'crypto';
import he from 'he';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@ai-notecards.com';
const FROM_HEADER = `AI Notecards <${FROM_EMAIL}>`;

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
      from: FROM_HEADER,
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

const EMAIL_WRAPPER = (content) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <h2 style="color: #1A1614; margin-bottom: 24px;">AI Notecards</h2>
    ${content}
    <p style="color: #6B635A; font-size: 12px; margin-top: 32px; border-top: 1px solid #E8E4DF; padding-top: 16px;">
      This is a transactional email from AI Notecards. You're receiving this because of activity on your account.
    </p>
  </div>
`;

const TEMPLATES = {
  sale_notification: (data) => ({
    subject: `You sold ${data.title} for $${(data.earnings / 100).toFixed(2)}!`,
    html: EMAIL_WRAPPER(`
      <p style="color: #1A1614; font-size: 16px; margin-bottom: 8px;">You made a sale!</p>
      <div style="background: #E8F5F0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #1B6B5A; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">${he.encode(data.title)}</p>
        <p style="color: #1B6B5A; font-size: 24px; font-weight: bold; margin: 0;">+$${(data.earnings / 100).toFixed(2)}</p>
      </div>
      <p style="color: #6B635A; font-size: 14px;">Your earnings will be available in your Stripe dashboard.</p>
    `),
    text: `You sold "${data.title}" and earned $${(data.earnings / 100).toFixed(2)}!\n\nYour earnings will be available in your Stripe dashboard.`,
  }),

  purchase_confirmation: (data) => ({
    subject: `Your purchase: ${data.title}`,
    html: EMAIL_WRAPPER(`
      <p style="color: #1A1614; font-size: 16px; margin-bottom: 8px;">Purchase confirmed!</p>
      <div style="background: #F5F5F5; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #1A1614; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">${he.encode(data.title)}</p>
        <p style="color: #6B635A; font-size: 14px; margin: 0;">$${(data.price / 100).toFixed(2)}</p>
      </div>
      <p style="color: #6B635A; font-size: 14px;">The deck has been added to your library. Head to your dashboard to start studying!</p>
      <a href="${process.env.CLIENT_URL}/dashboard" style="display: inline-block; background: #1B6B5A; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px;">Start Studying</a>
    `),
    text: `Purchase confirmed: "${data.title}" for $${(data.price / 100).toFixed(2)}.\n\nThe deck has been added to your library. Head to your dashboard to start studying!\n\n${process.env.CLIENT_URL}/dashboard`,
  }),

  subscription_confirmed: (data) => ({
    subject: 'Welcome to AI Notecards Pro!',
    html: EMAIL_WRAPPER(`
      <p style="color: #1A1614; font-size: 16px; margin-bottom: 8px;">You're now a Pro member!</p>
      <div style="background: #E8F5F0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #1B6B5A; font-size: 14px; margin: 0 0 8px 0;">Your Pro benefits:</p>
        <ul style="color: #1A1614; font-size: 14px; margin: 0; padding-left: 20px;">
          <li>10 AI generations per day</li>
          <li>Unlimited decks</li>
          <li>Sell decks on the marketplace</li>
        </ul>
      </div>
      <a href="${process.env.CLIENT_URL}/dashboard" style="display: inline-block; background: #1B6B5A; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Go to Dashboard</a>
    `),
    text: `Welcome to AI Notecards Pro!\n\nYour Pro benefits:\n- 10 AI generations per day\n- Unlimited decks\n- Sell decks on the marketplace\n\n${process.env.CLIENT_URL}/dashboard`,
  }),

  subscription_cancelling: (data) => ({
    subject: 'Your Pro subscription is ending',
    html: EMAIL_WRAPPER(`
      <p style="color: #1A1614; font-size: 16px; margin-bottom: 8px;">Your Pro subscription will end soon</p>
      <div style="background: #F5F5F5; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <p style="color: #1A1614; font-size: 14px; margin: 0;">Your access continues until <strong>${data.cancelAt}</strong>. After that, you'll be downgraded to the free plan.</p>
      </div>
      <p style="color: #6B635A; font-size: 14px;">Changed your mind? You can resubscribe anytime from your settings.</p>
      <a href="${process.env.CLIENT_URL}/settings" style="display: inline-block; background: #1B6B5A; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px;">Manage Subscription</a>
    `),
    text: `Your Pro subscription will end on ${data.cancelAt}. After that, you'll be downgraded to the free plan.\n\nChanged your mind? Resubscribe anytime: ${process.env.CLIENT_URL}/settings`,
  }),
};

export async function sendTransactionalEmail(type, to, data) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Email (${type}) to ${to}:`, data);
    return true;
  }
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown email template: ${type}`);
  const { subject, html, text } = template(data);
  try {
    const client = await getResend();
    await client.emails.send({
      from: FROM_HEADER,
      to,
      subject,
      html,
      text,
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    });
    return true;
  } catch (err) {
    console.error(`Failed to send ${type} email to ${to}:`, err);
    return false;
  }
}

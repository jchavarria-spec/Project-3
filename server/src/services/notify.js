import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import { query } from '../db.js';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
} = process.env;

const smsEnabled = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
const emailEnabled = Boolean(SENDGRID_API_KEY && SENDGRID_FROM_EMAIL);

const twilioClient = smsEnabled ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
if (emailEnabled) sgMail.setApiKey(SENDGRID_API_KEY);

async function log({ businessId, jobId, customerId, channel, type, recipient, status, detail = '' }) {
  await query(
    `INSERT INTO messages_log (business_id, job_id, customer_id, channel, type, recipient, status, detail)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [businessId, jobId || null, customerId || null, channel, type, recipient || '', status, detail]
  ).catch((e) => console.error('message log failed:', e.message));
}

export async function sendSMS({ to, body, businessId, jobId, customerId, type }) {
  const meta = { businessId, jobId, customerId, channel: 'sms', type, recipient: to };
  if (!to) return log({ ...meta, status: 'skipped', detail: 'no phone on file' });
  if (!smsEnabled) return log({ ...meta, status: 'skipped', detail: 'Twilio not configured' });
  try {
    await twilioClient.messages.create({ to, from: TWILIO_FROM_NUMBER, body });
    await log({ ...meta, status: 'sent' });
  } catch (err) {
    console.error('SMS send failed:', err.message);
    await log({ ...meta, status: 'failed', detail: err.message });
  }
}

export async function sendEmail({ to, subject, html, businessId, jobId, customerId, type }) {
  const meta = { businessId, jobId, customerId, channel: 'email', type, recipient: to };
  if (!to) return log({ ...meta, status: 'skipped', detail: 'no email on file' });
  if (!emailEnabled) return log({ ...meta, status: 'skipped', detail: 'SendGrid not configured' });
  try {
    await sgMail.send({ to, from: SENDGRID_FROM_EMAIL, subject, html });
    await log({ ...meta, status: 'sent' });
  } catch (err) {
    console.error('Email send failed:', err.message);
    await log({ ...meta, status: 'failed', detail: err.message });
  }
}

export function formatWhen(date, timezone) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: timezone || 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const emailShell = (business, inner) => `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
    ${business.logo_url ? `<img src="${business.logo_url}" alt="${business.name}" style="max-height:56px;margin-bottom:16px;" />` : ''}
    <h2 style="margin:0 0 8px;">${business.name}</h2>
    ${inner}
    <p style="color:#6b7280;font-size:13px;margin-top:24px;">
      ${business.phone ? `Questions? Call us at ${business.phone}.` : ''}
    </p>
  </div>`;

export async function sendConfirmation({ business, customer, job, serviceName }) {
  const when = formatWhen(job.scheduled_at, business.timezone);
  const smsBody = `${business.name}: your ${serviceName || 'appointment'} is confirmed for ${when}. Reply or call ${business.phone || 'us'} to make changes.`;
  const html = emailShell(business, `
    <p>Hi ${customer.name.split(' ')[0]},</p>
    <p>Your appointment is <strong>confirmed</strong>:</p>
    <p style="background:#f3f4f6;border-radius:8px;padding:12px 16px;">
      <strong>${serviceName || 'Service visit'}</strong><br/>${when}${job.address ? `<br/>${job.address}` : ''}
    </p>
    <p>We look forward to seeing you!</p>`);
  const common = { businessId: business.id, jobId: job.id, customerId: customer.id, type: 'confirmation' };
  await Promise.all([
    business.sms_reminders_enabled ? sendSMS({ to: customer.phone, body: smsBody, ...common }) : null,
    business.email_reminders_enabled
      ? sendEmail({ to: customer.email, subject: `Appointment confirmed — ${business.name}`, html, ...common })
      : null,
  ]);
}

export async function sendReminder({ business, customer, job, serviceName }) {
  const when = formatWhen(job.scheduled_at, business.timezone);
  const smsBody = `Reminder from ${business.name}: your ${serviceName || 'appointment'} is scheduled for ${when}. Call ${business.phone || 'us'} if you need to reschedule.`;
  const html = emailShell(business, `
    <p>Hi ${customer.name.split(' ')[0]},</p>
    <p>This is a friendly reminder about your upcoming appointment:</p>
    <p style="background:#f3f4f6;border-radius:8px;padding:12px 16px;">
      <strong>${serviceName || 'Service visit'}</strong><br/>${when}${job.address ? `<br/>${job.address}` : ''}
    </p>
    <p>See you soon!</p>`);
  const common = { businessId: business.id, jobId: job.id, customerId: customer.id, type: 'reminder' };
  await Promise.all([
    business.sms_reminders_enabled ? sendSMS({ to: customer.phone, body: smsBody, ...common }) : null,
    business.email_reminders_enabled
      ? sendEmail({ to: customer.email, subject: `Reminder: appointment ${when} — ${business.name}`, html, ...common })
      : null,
  ]);
}

export async function sendReviewRequest({ business, customer, job }) {
  const links = [];
  if (business.google_review_url) links.push({ label: 'Google', url: business.google_review_url });
  if (business.yelp_review_url) links.push({ label: 'Yelp', url: business.yelp_review_url });
  if (!links.length) return; // nothing to link to

  const smsLinks = links.map((l) => `${l.label}: ${l.url}`).join(' | ');
  const smsBody = `Thanks for choosing ${business.name}! If you were happy with our work, a quick review means the world to us. ${smsLinks}`;
  const html = emailShell(business, `
    <p>Hi ${customer.name.split(' ')[0]},</p>
    <p>Thanks for choosing ${business.name} — we hope everything went great!</p>
    <p>If you have a minute, a quick review helps our small business more than you know:</p>
    <p>
      ${links
        .map(
          (l) =>
            `<a href="${l.url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;margin-right:8px;">Review us on ${l.label}</a>`
        )
        .join('')}
    </p>
    <p>Thank you!</p>`);
  const common = { businessId: business.id, jobId: job.id, customerId: customer.id, type: 'review_request' };
  await Promise.all([
    sendSMS({ to: customer.phone, body: smsBody, ...common }),
    sendEmail({ to: customer.email, subject: `How did we do? — ${business.name}`, html, ...common }),
  ]);
}

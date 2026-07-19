import cron from 'node-cron';
import { query } from '../db.js';
import { sendReminder } from './notify.js';

// Every 5 minutes, send reminders for confirmed jobs entering their
// business-configured reminder window (default 24h before start).
export async function runReminderPass() {
  const { rows } = await query(`
    SELECT j.id AS job_id, j.scheduled_at, j.duration_min, j.address AS job_address,
           s.name AS service_name,
           c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
           b.*
    FROM jobs j
    JOIN businesses b ON b.id = j.business_id
    JOIN customers c ON c.id = j.customer_id
    LEFT JOIN services s ON s.id = j.service_id
    WHERE j.status = 'confirmed'
      AND j.reminder_sent = FALSE
      AND j.scheduled_at > NOW()
      AND j.scheduled_at <= NOW() + (b.reminder_hours_before || ' hours')::interval
      AND (b.sms_reminders_enabled OR b.email_reminders_enabled)
  `);

  for (const row of rows) {
    const claimed = await query(
      `UPDATE jobs SET reminder_sent = TRUE WHERE id = $1 AND reminder_sent = FALSE RETURNING id`,
      [row.job_id]
    );
    if (!claimed.rowCount) continue; // another worker got it

    const business = row; // business columns are spread on the row via b.*
    const customer = {
      id: row.customer_id,
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
    };
    const job = { id: row.job_id, scheduled_at: row.scheduled_at, address: row.job_address };
    try {
      await sendReminder({ business, customer, job, serviceName: row.service_name });
    } catch (err) {
      console.error(`Reminder failed for job ${row.job_id}:`, err.message);
    }
  }
}

export function startScheduler() {
  cron.schedule('*/5 * * * *', () => {
    runReminderPass().catch((err) => console.error('Reminder pass failed:', err.message));
  });
  console.log('Reminder scheduler started (every 5 minutes)');
}

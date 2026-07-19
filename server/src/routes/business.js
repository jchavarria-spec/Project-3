import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const EDITABLE = [
  'name', 'phone', 'email', 'address', 'logo_url', 'timezone', 'booking_intro',
  'open_time', 'close_time', 'google_review_url', 'yelp_review_url',
  'sms_reminders_enabled', 'email_reminders_enabled', 'review_requests_enabled',
  'reminder_hours_before', 'slug',
];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM businesses WHERE id = $1', [req.user.business_id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/', requireOwner, async (req, res, next) => {
  try {
    const updates = Object.entries(req.body || {}).filter(([k]) => EDITABLE.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    if (req.body.slug !== undefined) {
      const slug = String(req.body.slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (slug.length < 3) return res.status(400).json({ error: 'Booking link must be at least 3 characters' });
      const clash = await query('SELECT 1 FROM businesses WHERE slug = $1 AND id != $2', [slug, req.user.business_id]);
      if (clash.rows.length) return res.status(409).json({ error: 'That booking link is already taken' });
      req.body.slug = slug;
    }
    if (req.body.reminder_hours_before !== undefined) {
      const h = parseInt(req.body.reminder_hours_before, 10);
      if (!Number.isInteger(h) || h < 1 || h > 168) {
        return res.status(400).json({ error: 'Reminder must be between 1 and 168 hours before' });
      }
    }

    const sets = updates.map(([k], i) => `${k} = $${i + 1}`);
    const values = updates.map(([k]) => req.body[k]);
    const { rows } = await query(
      `UPDATE businesses SET ${sets.join(', ')} WHERE id = $${updates.length + 1} RETURNING *`,
      [...values, req.user.business_id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Recent message activity (reminders / review requests) for transparency
router.get('/messages', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT m.*, c.name AS customer_name
       FROM messages_log m LEFT JOIN customers c ON c.id = m.customer_id
       WHERE m.business_id = $1 ORDER BY m.created_at DESC LIMIT 100`,
      [req.user.business_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

export default router;

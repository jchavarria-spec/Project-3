import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { sendConfirmation, sendReviewRequest } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

const JOB_SELECT = `
  SELECT j.*, s.name AS service_name,
         c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
         u.name AS technician_name, u.color AS technician_color
  FROM jobs j
  LEFT JOIN services s ON s.id = j.service_id
  LEFT JOIN customers c ON c.id = j.customer_id
  LEFT JOIN users u ON u.id = j.technician_id`;

async function loadJob(id, businessId) {
  const { rows } = await query(`${JOB_SELECT} WHERE j.id = $1 AND j.business_id = $2`, [id, businessId]);
  return rows[0] || null;
}

async function notifyConfirmation(job, businessId) {
  const biz = await query('SELECT * FROM businesses WHERE id = $1', [businessId]);
  const cust = await query('SELECT * FROM customers WHERE id = $1', [job.customer_id]);
  if (!biz.rows[0] || !cust.rows[0]) return;
  sendConfirmation({
    business: biz.rows[0],
    customer: cust.rows[0],
    job,
    serviceName: job.service_name,
  }).catch((e) => console.error('confirmation failed:', e.message));
}

// GET /api/jobs?from=&to=&status=&technician_id=&customer_id=
router.get('/', async (req, res, next) => {
  try {
    const params = [req.user.business_id];
    const where = ['j.business_id = $1'];
    const { from, to, status, technician_id, customer_id } = req.query;
    if (from) {
      params.push(from);
      where.push(`j.scheduled_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`j.scheduled_at < $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`j.status = $${params.length}`);
    }
    if (technician_id) {
      params.push(technician_id);
      where.push(`j.technician_id = $${params.length}`);
    }
    if (customer_id) {
      params.push(customer_id);
      where.push(`j.customer_id = $${params.length}`);
    }
    const { rows } = await query(
      `${JOB_SELECT} WHERE ${where.join(' AND ')} ORDER BY j.scheduled_at LIMIT 1000`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/jobs — create a job; accepts customer_id OR inline new_customer {name, phone, email, address}
router.post('/', async (req, res, next) => {
  try {
    const {
      customer_id,
      new_customer,
      service_id = null,
      technician_id = null,
      scheduled_at,
      duration_min,
      address = '',
      notes = '',
      price_cents,
      status = 'confirmed',
    } = req.body || {};
    if (!scheduled_at) return res.status(400).json({ error: 'A date and time is required' });

    let customerId = customer_id;
    if (!customerId) {
      if (!new_customer?.name) return res.status(400).json({ error: 'A customer is required' });
      const c = await query(
        `INSERT INTO customers (business_id, name, phone, email, address)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          req.user.business_id,
          new_customer.name,
          new_customer.phone || '',
          (new_customer.email || '').toLowerCase(),
          new_customer.address || '',
        ]
      );
      customerId = c.rows[0].id;
    }

    // Default duration and price from the service if not provided
    let dur = parseInt(duration_min, 10);
    let price = price_cents;
    if (service_id && (!dur || price === undefined)) {
      const s = await query('SELECT duration_min, price_cents FROM services WHERE id = $1 AND business_id = $2', [
        service_id,
        req.user.business_id,
      ]);
      if (s.rows[0]) {
        if (!dur) dur = s.rows[0].duration_min;
        if (price === undefined) price = s.rows[0].price_cents;
      }
    }

    const { rows } = await query(
      `INSERT INTO jobs (business_id, customer_id, service_id, technician_id, status, scheduled_at, duration_min, address, notes, price_cents, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual') RETURNING id`,
      [
        req.user.business_id,
        customerId,
        service_id || null,
        technician_id || null,
        ['pending', 'confirmed'].includes(status) ? status : 'confirmed',
        scheduled_at,
        dur || 60,
        address,
        notes,
        parseInt(price, 10) || 0,
      ]
    );
    const job = await loadJob(rows[0].id, req.user.business_id);
    if (job.status === 'confirmed') notifyConfirmation(job, req.user.business_id);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const job = await loadJob(req.params.id, req.user.business_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/jobs/:id — edit / reschedule / assign / change status
router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await loadJob(req.params.id, req.user.business_id);
    if (!existing) return res.status(404).json({ error: 'Job not found' });

    const allowed = [
      'service_id', 'technician_id', 'status', 'scheduled_at',
      'duration_min', 'address', 'notes', 'price_cents',
    ];
    const body = req.body || {};
    if (body.status && !['pending', 'confirmed', 'completed', 'cancelled'].includes(body.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updates = Object.entries(body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    const sets = updates.map(([k], i) => `${k} = $${i + 1}`);
    const values = updates.map(([, v]) => (v === '' ? null : v));
    let extra = '';
    const nowCompleting = body.status === 'completed' && existing.status !== 'completed';
    if (nowCompleting) extra = ', completed_at = NOW()';
    // Rescheduling re-arms the reminder
    if (body.scheduled_at && new Date(body.scheduled_at).getTime() !== new Date(existing.scheduled_at).getTime()) {
      extra += ', reminder_sent = FALSE';
    }

    await query(
      `UPDATE jobs SET ${sets.join(', ')}${extra} WHERE id = $${updates.length + 1} AND business_id = $${updates.length + 2}`,
      [...values, req.params.id, req.user.business_id]
    );
    const job = await loadJob(req.params.id, req.user.business_id);

    // Confirming a pending request (or rescheduling a confirmed job) notifies the customer
    const nowConfirming = body.status === 'confirmed' && existing.status === 'pending';
    const rescheduledConfirmed =
      job.status === 'confirmed' &&
      body.scheduled_at &&
      new Date(body.scheduled_at).getTime() !== new Date(existing.scheduled_at).getTime();
    if (nowConfirming || rescheduledConfirmed) notifyConfirmation(job, req.user.business_id);

    // Completing a job fires the review request
    if (nowCompleting && !existing.review_request_sent) {
      const biz = await query('SELECT * FROM businesses WHERE id = $1', [req.user.business_id]);
      const cust = await query('SELECT * FROM customers WHERE id = $1', [job.customer_id]);
      if (biz.rows[0]?.review_requests_enabled && cust.rows[0]) {
        await query('UPDATE jobs SET review_request_sent = TRUE WHERE id = $1', [job.id]);
        sendReviewRequest({ business: biz.rows[0], customer: cust.rows[0], job }).catch((e) =>
          console.error('review request failed:', e.message)
        );
      }
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM jobs WHERE id = $1 AND business_id = $2 RETURNING id', [
      req.params.id,
      req.user.business_id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

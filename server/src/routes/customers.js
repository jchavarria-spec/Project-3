import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const params = [req.user.business_id];
    let where = 'c.business_id = $1';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.email ILIKE $2 OR c.address ILIKE $2)`;
    }
    const { rows } = await query(
      `SELECT c.*,
              COUNT(j.id)::int AS job_count,
              MAX(j.scheduled_at) AS last_job_at,
              COALESCE(SUM(j.price_cents) FILTER (WHERE j.status = 'completed'), 0)::bigint AS lifetime_cents
       FROM customers c LEFT JOIN jobs j ON j.customer_id = c.id
       WHERE ${where}
       GROUP BY c.id
       ORDER BY c.name
       LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone = '', email = '', address = '', notes = '' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    const { rows } = await query(
      `INSERT INTO customers (business_id, name, phone, email, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.business_id, name, phone, email.toLowerCase(), address, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM customers WHERE id = $1 AND business_id = $2', [
      req.params.id,
      req.user.business_id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    const jobs = await query(
      `SELECT j.*, s.name AS service_name, u.name AS technician_name
       FROM jobs j
       LEFT JOIN services s ON s.id = j.service_id
       LEFT JOIN users u ON u.id = j.technician_id
       WHERE j.customer_id = $1 AND j.business_id = $2
       ORDER BY j.scheduled_at DESC`,
      [req.params.id, req.user.business_id]
    );
    res.json({ ...rows[0], jobs: jobs.rows });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'email', 'address', 'notes'];
    const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    const sets = updates.map(([k], i) => `${k} = $${i + 1}`);
    const values = updates.map(([, v]) => v);
    const { rows } = await query(
      `UPDATE customers SET ${sets.join(', ')} WHERE id = $${updates.length + 1} AND business_id = $${updates.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM customers WHERE id = $1 AND business_id = $2 RETURNING id', [
      req.params.id,
      req.user.business_id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

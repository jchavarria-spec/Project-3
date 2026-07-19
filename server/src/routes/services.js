import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM services WHERE business_id = $1 ORDER BY active DESC, sort, id',
      [req.user.business_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { name, description = '', duration_min = 60, price_cents = 0 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Service name is required' });
    const { rows } = await query(
      `INSERT INTO services (business_id, name, description, duration_min, price_cents)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.business_id, name, description, parseInt(duration_min, 10) || 60, parseInt(price_cents, 10) || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireOwner, async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'duration_min', 'price_cents', 'active', 'sort'];
    const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    const sets = updates.map(([k], i) => `${k} = $${i + 1}`);
    const values = updates.map(([, v]) => v);
    const { rows } = await query(
      `UPDATE services SET ${sets.join(', ')} WHERE id = $${updates.length + 1} AND business_id = $${updates.length + 2} RETURNING *`,
      [...values, req.params.id, req.user.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    // Soft-delete keeps history on old jobs intact
    const { rows } = await query(
      'UPDATE services SET active = FALSE WHERE id = $1 AND business_id = $2 RETURNING id',
      [req.params.id, req.user.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

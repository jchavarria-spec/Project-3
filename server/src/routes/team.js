import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, phone, role, color, active, created_at
       FROM users WHERE business_id = $1 ORDER BY role = 'owner' DESC, name`,
      [req.user.business_id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireOwner, async (req, res, next) => {
  try {
    const { name, email, phone = '', password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and a password are required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const clash = await query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (clash.rows.length) return res.status(409).json({ error: 'An account with that email already exists' });

    const count = await query('SELECT COUNT(*)::int AS n FROM users WHERE business_id = $1', [req.user.business_id]);
    const color = COLORS[count.rows[0].n % COLORS.length];
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (business_id, name, email, phone, password_hash, role, color)
       VALUES ($1,$2,$3,$4,$5,'tech',$6)
       RETURNING id, name, email, phone, role, color, active, created_at`,
      [req.user.business_id, name, email.toLowerCase(), phone, hash, color]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireOwner, async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'color', 'active'];
    const updates = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
    if (req.body.password) {
      updates.push(['password_hash', await bcrypt.hash(req.body.password, 10)]);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    const sets = updates.map(([k], i) => `${k} = $${i + 1}`);
    const values = updates.map(([, v]) => v);
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${updates.length + 1} AND business_id = $${updates.length + 2}
       RETURNING id, name, email, phone, role, color, active`,
      [...values, req.params.id, req.user.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Team member not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireOwner, async (req, res, next) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ error: "You can't remove your own account" });
    }
    const { rows } = await query(
      `UPDATE users SET active = FALSE WHERE id = $1 AND business_id = $2 AND role != 'owner' RETURNING id`,
      [req.params.id, req.user.business_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Team member not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'my-business';
}

async function uniqueSlug(base) {
  let slug = base;
  for (let i = 0; i < 50; i++) {
    const { rows } = await query('SELECT 1 FROM businesses WHERE slug = $1', [slug]);
    if (!rows.length) return slug;
    slug = `${base}-${Math.floor(Math.random() * 9000) + 1000}`;
  }
  return `${base}-${Date.now()}`;
}

// POST /api/auth/register — create business + owner in one step
router.post('/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { businessName, name, email, password, phone = '', trade = '' } = req.body || {};
    if (!businessName || !name || !email || !password) {
      return res.status(400).json({ error: 'Business name, your name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists' });

    const slug = await uniqueSlug(slugify(businessName));
    await client.query('BEGIN');
    const bizRes = await client.query(
      `INSERT INTO businesses (name, slug, phone, email) VALUES ($1,$2,$3,$4) RETURNING *`,
      [businessName, slug, phone, email.toLowerCase()]
    );
    const business = bizRes.rows[0];
    const hash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (business_id, name, email, phone, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,'owner') RETURNING id, business_id, name, email, phone, role, color`,
      [business.id, name, email.toLowerCase(), phone, hash]
    );

    // Seed starter services by trade so setup takes minutes, not hours
    const starters = {
      plumbing: [
        ['Drain cleaning', 90, 22500],
        ['Leak repair', 60, 17500],
        ['Water heater service', 120, 35000],
      ],
      hvac: [
        ['AC tune-up', 90, 15900],
        ['Furnace repair', 120, 32500],
        ['System inspection', 60, 9900],
      ],
      electrical: [
        ['Outlet / switch repair', 60, 14500],
        ['Panel inspection', 90, 19900],
        ['Fixture installation', 90, 22500],
      ],
      cleaning: [
        ['Standard home cleaning', 120, 16000],
        ['Deep cleaning', 240, 32000],
        ['Move-out cleaning', 240, 38000],
      ],
      other: [['Service call', 60, 12500]],
    };
    const seed = starters[trade] || starters.other;
    for (let i = 0; i < seed.length; i++) {
      const [sname, dur, price] = seed[i];
      await client.query(
        `INSERT INTO services (business_id, name, duration_min, price_cents, sort) VALUES ($1,$2,$3,$4,$5)`,
        [business.id, sname, dur, price, i]
      );
    }
    await client.query('COMMIT');

    const user = userRes.rows[0];
    res.status(201).json({ token: signToken(user), user, business });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND active = TRUE', [email.toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const biz = await query('SELECT * FROM businesses WHERE id = $1', [user.business_id]);
    delete user.password_hash;
    res.json({ token: signToken(user), user, business: biz.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, business_id, name, email, phone, role, color FROM users WHERE id = $1 AND active = TRUE',
      [req.user.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'Account not found' });
    const biz = await query('SELECT * FROM businesses WHERE id = $1', [rows[0].business_id]);
    res.json({ user: rows[0], business: biz.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;

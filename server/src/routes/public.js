import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

async function loadBusiness(slug) {
  const { rows } = await query('SELECT * FROM businesses WHERE slug = $1', [slug]);
  return rows[0] || null;
}

// GET /api/public/:slug — booking page data
router.get('/:slug', async (req, res, next) => {
  try {
    const biz = await loadBusiness(req.params.slug);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    const services = await query(
      `SELECT id, name, description, duration_min, price_cents
       FROM services WHERE business_id = $1 AND active = TRUE ORDER BY sort, id`,
      [biz.id]
    );
    res.json({
      business: {
        name: biz.name,
        slug: biz.slug,
        phone: biz.phone,
        address: biz.address,
        logo_url: biz.logo_url,
        booking_intro: biz.booking_intro,
        open_time: biz.open_time,
        close_time: biz.close_time,
        timezone: biz.timezone,
      },
      services: services.rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/public/:slug/slots?date=YYYY-MM-DD&service_id=N
// Returns available start times (HH:MM, business-local) for the given day.
router.get('/:slug/slots', async (req, res, next) => {
  try {
    const biz = await loadBusiness(req.params.slug);
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    const date = req.query.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Invalid date' });

    let duration = 60;
    if (req.query.service_id) {
      const s = await query('SELECT duration_min FROM services WHERE id = $1 AND business_id = $2', [
        req.query.service_id,
        biz.id,
      ]);
      if (s.rows[0]) duration = s.rows[0].duration_min;
    }

    // Capacity = number of active field staff
    const staff = await query('SELECT COUNT(*)::int AS n FROM users WHERE business_id = $1 AND active = TRUE', [
      biz.id,
    ]);
    const capacity = Math.max(1, staff.rows[0].n);

    // Jobs that day (pending + confirmed), in business-local time
    const jobs = await query(
      `SELECT scheduled_at, duration_min FROM jobs
       WHERE business_id = $1 AND status IN ('pending','confirmed')
         AND (scheduled_at AT TIME ZONE $2)::date = $3::date`,
      [biz.id, biz.timezone, date]
    );

    // Convert booked jobs to minutes-of-day in business tz
    const toLocalMinutes = (d) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: biz.timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(new Date(d));
      const h = parseInt(parts.find((p) => p.type === 'hour').value, 10) % 24;
      const m = parseInt(parts.find((p) => p.type === 'minute').value, 10);
      return h * 60 + m;
    };
    const booked = jobs.rows.map((j) => ({
      start: toLocalMinutes(j.scheduled_at),
      end: toLocalMinutes(j.scheduled_at) + j.duration_min,
    }));

    const [oh, om] = (biz.open_time || '08:00').split(':').map(Number);
    const [ch, cm] = (biz.close_time || '18:00').split(':').map(Number);
    const openMin = oh * 60 + (om || 0);
    const closeMin = ch * 60 + (cm || 0);

    // Don't offer slots in the past (compare against "now" in business tz)
    const nowParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: biz.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => nowParts.find((p) => p.type === t).value;
    const todayLocal = `${get('year')}-${get('month')}-${get('day')}`;
    const nowMinutes = parseInt(get('hour'), 10) % 24 * 60 + parseInt(get('minute'), 10);

    const slots = [];
    for (let t = openMin; t + duration <= closeMin; t += 30) {
      if (date === todayLocal && t <= nowMinutes) continue;
      if (date < todayLocal) continue;
      const overlapping = booked.filter((b) => t < b.end && t + duration > b.start).length;
      if (overlapping >= capacity) continue;
      slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    }
    res.json({ date, duration_min: duration, slots });
  } catch (err) {
    next(err);
  }
});

// POST /api/public/:slug/book — customer submits a booking request
router.post('/:slug/book', async (req, res, next) => {
  try {
    const biz = await loadBusiness(req.params.slug);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    const { service_id, date, time, name, phone, email = '', address = '', notes = '' } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: 'Your name and phone number are required' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) {
      return res.status(400).json({ error: 'Please pick a date and time' });
    }

    let service = null;
    if (service_id) {
      const s = await query('SELECT * FROM services WHERE id = $1 AND business_id = $2 AND active = TRUE', [
        service_id,
        biz.id,
      ]);
      service = s.rows[0] || null;
    }

    // Find or create the customer by phone (then email) so job history accrues
    let customer;
    const normPhone = String(phone).replace(/[^\d+]/g, '');
    const found = await query(
      `SELECT * FROM customers
       WHERE business_id = $1 AND (regexp_replace(phone, '[^0-9+]', '', 'g') = $2 OR (email != '' AND email = $3))
       ORDER BY id LIMIT 1`,
      [biz.id, normPhone, email.toLowerCase()]
    );
    if (found.rows.length) {
      customer = found.rows[0];
      // Backfill missing contact info
      await query(
        `UPDATE customers SET email = COALESCE(NULLIF(email, ''), $1), address = COALESCE(NULLIF(address, ''), $2) WHERE id = $3`,
        [email.toLowerCase(), address, customer.id]
      );
    } else {
      const c = await query(
        `INSERT INTO customers (business_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [biz.id, name, phone, email.toLowerCase(), address]
      );
      customer = c.rows[0];
    }

    // Interpret date+time in the business's timezone.
    // Compute the tz offset for that wall-clock instant, then build a UTC timestamp.
    const guessUtc = new Date(`${date}T${time}:00Z`);
    const tzParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: biz.timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(guessUtc);
    const g = (t) => parseInt(tzParts.find((p) => p.type === t).value, 10);
    const localAsUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'));
    const offsetMs = localAsUtc - guessUtc.getTime();
    const scheduledAt = new Date(guessUtc.getTime() - offsetMs);

    const jobRes = await query(
      `INSERT INTO jobs (business_id, customer_id, service_id, status, scheduled_at, duration_min, address, notes, price_cents, source)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,'online') RETURNING *`,
      [
        biz.id,
        customer.id,
        service ? service.id : null,
        scheduledAt.toISOString(),
        service ? service.duration_min : 60,
        address || customer.address || '',
        notes,
        service ? service.price_cents : 0,
      ]
    );

    res.status(201).json({
      ok: true,
      message: `Thanks ${name.split(' ')[0]}! Your request was sent to ${biz.name}. They'll confirm your appointment shortly.`,
      job_id: jobRes.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

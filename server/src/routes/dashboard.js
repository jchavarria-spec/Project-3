import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard — everything the home screen needs in one call
router.get('/', async (req, res, next) => {
  try {
    const bizId = req.user.business_id;
    const biz = await query('SELECT timezone FROM businesses WHERE id = $1', [bizId]);
    const tz = biz.rows[0]?.timezone || 'America/New_York';

    const jobCols = `
      SELECT j.*, s.name AS service_name,
             c.name AS customer_name, c.phone AS customer_phone,
             u.name AS technician_name, u.color AS technician_color
      FROM jobs j
      LEFT JOIN services s ON s.id = j.service_id
      LEFT JOIN customers c ON c.id = j.customer_id
      LEFT JOIN users u ON u.id = j.technician_id`;

    const [today, upcoming, pending, stats] = await Promise.all([
      query(
        `${jobCols}
         WHERE j.business_id = $1 AND j.status IN ('pending','confirmed','completed')
           AND (j.scheduled_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
         ORDER BY j.scheduled_at`,
        [bizId, tz]
      ),
      query(
        `${jobCols}
         WHERE j.business_id = $1 AND j.status IN ('pending','confirmed')
           AND (j.scheduled_at AT TIME ZONE $2)::date > (NOW() AT TIME ZONE $2)::date
           AND j.scheduled_at < NOW() + INTERVAL '14 days'
         ORDER BY j.scheduled_at LIMIT 25`,
        [bizId, tz]
      ),
      query(
        `${jobCols}
         WHERE j.business_id = $1 AND j.status = 'pending'
         ORDER BY j.created_at DESC LIMIT 25`,
        [bizId]
      ),
      query(
        `SELECT
           (SELECT COUNT(*) FROM jobs WHERE business_id = $1 AND status IN ('pending','confirmed')
              AND (scheduled_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date)::int AS jobs_today,
           (SELECT COUNT(*) FROM jobs WHERE business_id = $1 AND status = 'pending')::int AS pending_requests,
           (SELECT COUNT(*) FROM jobs WHERE business_id = $1 AND status = 'completed'
              AND completed_at >= date_trunc('week', NOW()))::int AS completed_this_week,
           (SELECT COALESCE(SUM(price_cents), 0) FROM jobs WHERE business_id = $1 AND status = 'completed'
              AND completed_at >= date_trunc('month', NOW()))::bigint AS revenue_month_cents`,
        [bizId, tz]
      ),
    ]);

    res.json({
      today: today.rows,
      upcoming: upcoming.rows,
      pending: pending.rows,
      stats: stats.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

export default router;

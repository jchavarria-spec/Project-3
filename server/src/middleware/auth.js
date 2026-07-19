import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, business_id: user.business_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

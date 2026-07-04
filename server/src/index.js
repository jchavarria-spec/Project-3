import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from './db.js';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/business.js';
import serviceRoutes from './routes/services.js';
import customerRoutes from './routes/customers.js';
import jobRoutes from './routes/jobs.js';
import teamRoutes from './routes/team.js';
import publicRoutes from './routes/public.js';
import dashboardRoutes from './routes/dashboard.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve the built frontend in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next());
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 4000;
migrate()
  .then(() => {
    app.listen(port, () => console.log(`FieldBook API listening on :${port}`));
    startScheduler();
  })
  .catch((err) => {
    console.error('Failed to run migrations:', err);
    process.exit(1);
  });

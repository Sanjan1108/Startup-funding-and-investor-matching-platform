import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import healthRoutes from './routes/health';
import matchRoutes from './routes/match';
import negotiationsRoutes from './routes/negotiations';
import pitchDecksRoutes from './routes/pitchDecks';
import preferencesRoutes from './routes/preferences';
import dashboardRoutes from './routes/dashboard';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/negotiations', negotiationsRoutes);
app.use('/api/pitch-decks', pitchDecksRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Root health & status check
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    service: 'VentureLink Backend REST API',
    endpoints: [
      '/api/auth',
      '/api/data',
      '/api/health',
      '/api/match',
      '/api/negotiations',
      '/api/pitch-decks',
      '/api/preferences',
      '/api/dashboard'
    ]
  });
});

app.listen(port, () => {
  console.log(`[VentureLink Backend] Server running on http://localhost:${port}`);
});

export default app;

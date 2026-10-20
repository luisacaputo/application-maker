import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import { router } from './routes';
import { Request, Response, NextFunction } from 'express';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'Application Maker API is running' });
});

app.use(router);

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  if (err instanceof Error) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(5002, () => console.log('Application Maker API running on port 5002'));
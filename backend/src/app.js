import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import transactionRoutes from './routes/transactionRoutes.js';
import summaryRoutes from './routes/summaryRoutes.js';
import ApiError from './utils/ApiError.js';

const app = express();

function isLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase())
      && parsed.origin === origin;
  } catch {
    return false;
  }
}

const defaultClientOrigin = 'http://localhost:5173';
const configuredClientOrigin = process.env.CLIENT_ORIGIN || defaultClientOrigin;
const allowedClientOrigins = new Set([defaultClientOrigin]);
if (isLoopbackOrigin(configuredClientOrigin)) allowedClientOrigins.add(configuredClientOrigin);

app.use(cors({
  origin: (origin, callback) => callback(null, origin === undefined || allowedClientOrigins.has(origin)),
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Limit', 'X-Total-Pages'],
}));
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.use('/api/transactions', transactionRoutes);
app.use('/api/summary', summaryRoutes);

app.use((_request, _response, next) => {
  next(new ApiError(404, 'Route not found.'));
});

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ message: 'Request body cannot exceed 16 KB.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ message: 'Request body must contain valid JSON.' });
  }
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(' ');
    return response.status(400).json({ message });
  }
  if (error.name === 'CastError') {
    return response.status(400).json({ message: 'Invalid transaction ID.' });
  }
  if (error.status) {
    return response.status(error.status).json({ message: error.message });
  }

  console.error(error);
  return response.status(500).json({ message: 'An unexpected server error occurred.' });
});

export default app;

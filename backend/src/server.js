import 'dotenv/config';
import app from './app.js';
import { connectToDatabase } from './config/db.js';

const port = Number(process.env.PORT) || 5001;
const host = '127.0.0.1';
const databaseRetryDelay = 10_000;

function scheduleDatabaseRetry() {
  const retryTimer = setTimeout(async () => {
    const connected = await connectToDatabase(process.env.MONGODB_URI, { logErrors: false });
    if (!connected) scheduleDatabaseRetry();
  }, databaseRetryDelay);

  retryTimer.unref();
}

const databaseConnected = await connectToDatabase();
if (!databaseConnected) {
  if (process.env.MONGODB_URI) {
    console.warn('Starting SpendWise API in degraded mode. MongoDB connection will be retried automatically.');
    scheduleDatabaseRetry();
  } else {
    console.warn('Starting SpendWise API without MongoDB. Set MONGODB_URI in backend/.env and restart the API.');
  }
}
app.listen(port, host, () => {
  console.log(`SpendWise API listening on http://${host}:${port}`);
});

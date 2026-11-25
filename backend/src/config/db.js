import mongoose from 'mongoose';

export async function connectToDatabase(uri = process.env.MONGODB_URI, { logErrors = true } = {}) {
  if (!uri) {
    if (logErrors) console.error('MongoDB is not configured. Set MONGODB_URI in backend/.env.');
    return false;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB.');
    return true;
  } catch (error) {
    if (logErrors) console.error(`MongoDB connection failed: ${error.message}`);
    return false;
  }
}

export function requireDatabase(_request, response, next) {
  if (mongoose.connection.readyState !== 1) {
    return response.status(503).json({
      message: 'Database is unavailable. Check the MongoDB service and MONGODB_URI.',
    });
  }

  return next();
}

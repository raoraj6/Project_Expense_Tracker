import mongoose from 'mongoose';
import { config } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDB(uri = config.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

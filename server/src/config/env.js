import dotenv from 'dotenv';

dotenv.config();

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/expense_tracker'),
  jwtSecret: required('JWT_SECRET', process.env.NODE_ENV === 'production' ? undefined : 'dev-only-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // AI is optional — the app degrades gracefully without a key.
  groqApiKey: process.env.GROQ_API_KEY ?? null,
  // Must be a model that supports strict structured outputs: as of now that is
  // openai/gpt-oss-120b and openai/gpt-oss-20b (20b is cheaper/faster).
  groqModel: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
};

export const aiEnabled = Boolean(config.groqApiKey);

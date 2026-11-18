import dotenv from 'dotenv';
import path from 'path';

// Load .env whether running from repository root or backend folder
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'startup_funding_platform',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true
});

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
export const mongoClient = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 1500, // Fail-fast in 1.5 seconds if MongoDB is offline
  connectTimeoutMS: 1500
});

let mongoDbPromise: Promise<any> | null = null;

export async function mongoDb() {
  try {
    if (!mongoDbPromise) {
      mongoDbPromise = mongoClient.connect().catch((err) => {
        mongoDbPromise = null;
        throw err;
      });
    }
    await mongoDbPromise;
    return mongoClient.db(process.env.MONGODB_DATABASE || 'startup_funding_nosql');
  } catch (err) {
    mongoDbPromise = null;
    throw err;
  }
}

import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';

const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool; mongoClient?: MongoClient };
export const pool = globalForDb.mysqlPool ?? mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'startup_funding_platform',
  waitForConnections: true, connectionLimit: 10, decimalNumbers: true
});
if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool;

const mongoClient = globalForDb.mongoClient ?? new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
if (process.env.NODE_ENV !== 'production') globalForDb.mongoClient = mongoClient;
export async function mongoDb() { await mongoClient.connect(); return mongoClient.db(process.env.MONGODB_DATABASE || 'startup_funding_nosql'); }

import { mongoDb } from './db';
export async function logActivity(action:string, details:Record<string,unknown> = {}) {
  try { const db = await mongoDb(); await db.collection('activity_logs').insertOne({action, details, createdAt:new Date()}); } catch (e) { console.error('MongoDB activity log failed:', e); }
}

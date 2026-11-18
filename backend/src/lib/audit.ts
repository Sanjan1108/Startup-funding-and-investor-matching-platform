import { mongoDb } from './db';

export async function logActivity(action: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    const db = await mongoDb();
    await db.collection('activity_logs').insertOne({
      action,
      details,
      createdAt: new Date()
    });
  } catch (err) {
    // Graceful fallback: do not crash or stall API requests if MongoDB is offline
    console.warn(`[Audit Log] Activity logging skipped for "${action}" (MongoDB offline/unreachable)`);
  }
}

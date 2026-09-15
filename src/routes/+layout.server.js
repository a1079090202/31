import { getDb } from '$lib/server/db.js';
import { countOverdue } from '$lib/server/storage.js';
import { nowLocal } from '$lib/server/time.js';

export function load() {
  const db = getDb();
  return { overdueCount: countOverdue(db, nowLocal()) };
}

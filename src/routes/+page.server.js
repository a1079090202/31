import { getDb } from '$lib/server/db.js';
import { listOrders, countByStatus } from '$lib/server/orders.js';
import { countOverdue } from '$lib/server/storage.js';
import { nowLocal } from '$lib/server/time.js';

export function load({ url }) {
  const db = getDb();
  const status = url.searchParams.get('status') || 'all';
  return {
    orders: listOrders(db, status),
    counts: countByStatus(db),
    overdueCount: countOverdue(db, nowLocal()),
    filter: status
  };
}

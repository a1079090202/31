import { getDb } from '$lib/server/db.js';
import { monthlySummary, availableMonths } from '$lib/server/reports.js';
import { currentMonth } from '$lib/server/time.js';

export function load({ url }) {
  const db = getDb();
  const month = url.searchParams.get('month') || currentMonth();
  return {
    summary: monthlySummary(db, month),
    months: availableMonths(db),
    month
  };
}

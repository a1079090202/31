import { getDb } from '$lib/server/db.js';
import { summaryCsv } from '$lib/server/reports.js';
import { currentMonth } from '$lib/server/time.js';

export function GET({ url }) {
  const month = url.searchParams.get('month') || currentMonth();
  const csv = summaryCsv(getDb(), month);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="repair-summary-${month}.csv"`
    }
  });
}

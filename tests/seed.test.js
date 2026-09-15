import { describe, it, expect, afterEach, vi } from 'vitest';
import { createDb } from '../src/lib/server/db.js';
import { seed } from '../src/lib/server/seed.js';

// 跨月播种回归：「本月交车」「上月交车」两台样单必须落在正确的月份，
// 不管播种日是月初几号、上个月有多少天。
function deliveredMonths() {
  const db = createDb(':memory:');
  seed(db);
  const rows = db
    .prepare("SELECT order_no, delivered_at FROM orders WHERE status = 'delivered'")
    .all();
  db.close();
  return Object.fromEntries(rows.map((r) => [r.order_no, r.delivered_at.slice(0, 7)]));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('样例数据跨月归集', () => {
  it.each([
    ['2026-09-15 10:00:00', '2026-09', '2026-08'], // 月中，常规情形
    ['2026-09-01 08:00:00', '2026-09', '2026-08'], // 1 号播种：本月单不能滑进 8 月
    ['2026-03-01 09:00:00', '2026-03', '2026-02'], // 3 月 1 号：上月是短月 2 月，不能滑进 1 月
    ['2026-07-01 09:00:00', '2026-07', '2026-06'] // 7 月 1 号：上月是 6 月，不能滑进 5 月
  ])('播种于 %s 时，两台交车样单各归其月', (now, thisMonth, lastMonth) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now.replace(' ', 'T')));
    const months = deliveredMonths();
    expect(months['WX-DEMO-04']).toBe(thisMonth);
    expect(months['WX-DEMO-05']).toBe(lastMonth);
  });

  it('月末播种：旧件样例仍是一件在保管期内、一件已超期', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T10:00:00'));
    const db = createDb(':memory:');
    seed(db);
    const now = '2026-09-28 10:00:00';
    const parts = db.prepare('SELECT due_at FROM old_parts ORDER BY id').all();
    expect(parts[0].due_at > now).toBe(true); // 旧链条还在保管期
    expect(parts[1].due_at < now).toBe(true); // 旧刹车皮已超期
    db.close();
  });
});

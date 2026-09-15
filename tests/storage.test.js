import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/lib/server/db.js';
import { dueAt, isOverdue, listOverdue, KEEP_DAYS } from '../src/lib/server/storage.js';

describe('旧件保管期', () => {
  it('保管期满时间 = 进区时间 + 14 天', () => {
    expect(KEEP_DAYS).toBe(14);
    expect(dueAt('2026-09-01 10:00:00')).toBe('2026-09-15 10:00:00');
    // 跨月
    expect(dueAt('2026-09-25 08:30:00')).toBe('2026-10-09 08:30:00');
  });

  it('满 14 天整不算超期，超过才算', () => {
    const kept = '2026-09-01 10:00:00';
    expect(isOverdue(kept, '2026-09-14 10:00:00')).toBe(false); // 第 13 天
    expect(isOverdue(kept, '2026-09-15 10:00:00')).toBe(false); // 正好满 14 天
    expect(isOverdue(kept, '2026-09-15 10:00:01')).toBe(true);  // 超过 14 天
  });

  describe('待处置列表', () => {
    let db;
    const NOW = '2026-09-16 09:00:00';

    beforeEach(() => {
      db = createDb(':memory:');
      const order = db
        .prepare(
          `INSERT INTO orders (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at, status, created_at, updated_at)
           VALUES ('WX-T-01', 'ABC123', '测试车', '测试', 1000, '2026-09-30 18:00:00', 'repairing', '2026-09-01 09:00:00', '2026-09-01 09:00:00')`
        )
        .run().lastInsertRowid;
      const ins = db.prepare(
        `INSERT INTO old_parts (order_id, name, kept_at, due_at, status) VALUES (?, ?, ?, ?, ?)`
      );
      // 超期且未处理 → 应进待处置
      ins.run(order, '旧链条', '2026-09-01 08:00:00', dueAt('2026-09-01 08:00:00'), 'keeping');
      // 刚拆的，还在保管期 → 不进
      ins.run(order, '旧刹车皮', '2026-09-10 08:00:00', dueAt('2026-09-10 08:00:00'), 'keeping');
      // 超期但已报废 → 不进
      ins.run(order, '旧飞轮', '2026-08-20 08:00:00', dueAt('2026-08-20 08:00:00'), 'scrapped');
    });

    it('只有「超期且还没处理」的旧件进待处置', () => {
      const rows = listOverdue(db, NOW);
      expect(rows.map((r) => r.name)).toEqual(['旧链条']);
    });

    it('时间没到就一件都没有', () => {
      expect(listOverdue(db, '2026-09-05 09:00:00')).toHaveLength(0);
    });
  });
});

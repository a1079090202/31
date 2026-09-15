import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/lib/server/db.js';
import { monthlySummary } from '../src/lib/server/reports.js';

let db;

// 造一台已交车的单，并挂上换件记录
function delivered(orderNo, deliveredAt, laborCents, parts) {
  const id = db
    .prepare(
      `INSERT INTO orders (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at, status, created_at, updated_at, delivered_at)
       VALUES (?, 'ABC123', '测试车', '测试故障', ?, ?, 'delivered', ?, ?, ?)`
    )
    .run(orderNo, laborCents, deliveredAt, deliveredAt, deliveredAt, deliveredAt).lastInsertRowid;
  const ins = db.prepare(
    `INSERT INTO order_parts (order_id, source, inventory_id, name, qty, unit_cost_cents, created_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?)`
  );
  for (const p of parts) ins.run(id, p.source, p.name, p.qty, p.cost, deliveredAt);
  return id;
}

beforeEach(() => {
  db = createDb(':memory:');
  // 本月交车两台：
  // A：工费 80.00，领库存件 链条×1(30.00) + 内胎×2(8.00×2) + 客户自带脚踏(0) → 成本 46.00，毛利 34.00
  delivered('WX-A', '2026-09-05 15:00:00', 8000, [
    { source: 'inventory', name: '链条 8速', qty: 1, cost: 3000 },
    { source: 'inventory', name: '内胎 26×1.95', qty: 2, cost: 800 },
    { source: 'customer', name: '脚踏（客户自带）', qty: 1, cost: 0 }
  ]);
  // B：工费 40.00，领库存件 刹车皮×1(12.00) → 成本 12.00，毛利 28.00
  delivered('WX-B', '2026-09-20 11:00:00', 4000, [
    { source: 'inventory', name: '刹车皮（V刹）', qty: 1, cost: 1200 }
  ]);
  // 上月交车一台，不该进本月汇总
  delivered('WX-C', '2026-08-28 10:00:00', 5000, [
    { source: 'inventory', name: '飞轮 8速', qty: 1, cost: 5500 }
  ]);
  // 本月作废一台（带工费），不该进汇总
  db.prepare(
    `INSERT INTO orders (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at, status, created_at, updated_at, void_reason, void_operator, voided_at)
     VALUES ('WX-D', 'ABC123', '测试车', '作废单', 99900, '2026-09-10 18:00:00', 'void', '2026-09-01 09:00:00', '2026-09-02 09:00:00', '客户取消', '小王', '2026-09-02 09:00:00')`
  ).run();
  // 本月在修一台，不该进汇总
  db.prepare(
    `INSERT INTO orders (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at, status, created_at, updated_at)
     VALUES ('WX-E', 'ABC123', '测试车', '在修单', 77700, '2026-09-30 18:00:00', 'repairing', '2026-09-10 09:00:00', '2026-09-10 09:00:00')`
  ).run();
});

describe('月度毛利汇总', () => {
  it('只归集当月已交车的工单', () => {
    const s = monthlySummary(db, '2026-09');
    expect(s.count).toBe(2);
    expect(s.rows.map((r) => r.order_no)).toEqual(['WX-A', 'WX-B']);
  });

  it('每台：毛利 = 工费 − 库存领用成本（客户自带件算 0）', () => {
    const s = monthlySummary(db, '2026-09');
    const [a, b] = s.rows;
    expect(a.labor_cents).toBe(8000);
    expect(a.parts_cost_cents).toBe(3000 + 2 * 800); // 客户自带件不计
    expect(a.gross_cents).toBe(8000 - 4600);
    expect(b.labor_cents).toBe(4000);
    expect(b.parts_cost_cents).toBe(1200);
    expect(b.gross_cents).toBe(2800);
  });

  it('合计行 = 各行逐笔相加，拿计算器能对上', () => {
    const s = monthlySummary(db, '2026-09');
    expect(s.totals.labor_cents).toBe(8000 + 4000);
    expect(s.totals.parts_cost_cents).toBe(4600 + 1200);
    expect(s.totals.gross_cents).toBe(3400 + 2800);
    expect(s.totals.gross_cents).toBe(s.totals.labor_cents - s.totals.parts_cost_cents);
  });

  it('上月交的进上月汇总，跨月不串', () => {
    const s = monthlySummary(db, '2026-08');
    expect(s.count).toBe(1);
    expect(s.rows[0].order_no).toBe('WX-C');
    expect(s.totals.gross_cents).toBe(5000 - 5500); // 亏本也照实算
  });

  it('没有交车的月份是空表、合计为 0', () => {
    const s = monthlySummary(db, '2026-07');
    expect(s.count).toBe(0);
    expect(s.totals).toEqual({ labor_cents: 0, parts_cost_cents: 0, gross_cents: 0 });
  });
});

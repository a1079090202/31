// 月度维修汇总：按交车月份归集已交车的工单。
// 毛利 = 工费 − 配件成本；配件成本只算店里库存领用的（客户自带成本为 0），
// 全部以分的整数相加，不经过浮点，拿计算器能一笔一笔对上。
import { monthOf } from './time.js';

export function monthlySummary(db, month) {
  const orders = db
    .prepare(
      `SELECT id, order_no, frame_tail, brand, fault_desc, labor_cents, delivered_at
       FROM orders
       WHERE status = 'delivered' AND delivered_at LIKE ? || '%'
       ORDER BY delivered_at, id`
    )
    .all(month);

  const costStmt = db.prepare(
    `SELECT COALESCE(SUM(qty * unit_cost_cents), 0) AS cost
     FROM order_parts WHERE order_id = ? AND source = 'inventory'`
  );

  const rows = orders.map((o) => {
    const parts_cost_cents = costStmt.get(o.id).cost;
    return {
      ...o,
      parts_cost_cents,
      gross_cents: o.labor_cents - parts_cost_cents
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      labor_cents: acc.labor_cents + r.labor_cents,
      parts_cost_cents: acc.parts_cost_cents + r.parts_cost_cents,
      gross_cents: acc.gross_cents + r.gross_cents
    }),
    { labor_cents: 0, parts_cost_cents: 0, gross_cents: 0 }
  );

  return { month, rows, totals, count: rows.length };
}

/** 导出 CSV（带 BOM，Excel 直接打开不乱码） */
export function summaryCsv(db, month) {
  const { rows, totals } = monthlySummary(db, month);
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const yuan = (c) => (c / 100).toFixed(2);
  const lines = [
    ['单号', '车架号后六位', '品牌', '故障描述', '工费(元)', '配件成本(元)', '毛利(元)', '交车时间']
      .map(esc).join(',')
  ];
  for (const r of rows) {
    lines.push(
      [r.order_no, r.frame_tail, r.brand, r.fault_desc,
        yuan(r.labor_cents), yuan(r.parts_cost_cents), yuan(r.gross_cents), r.delivered_at]
        .map(esc).join(',')
    );
  }
  lines.push(
    ['合计', '', '', '', yuan(totals.labor_cents), yuan(totals.parts_cost_cents), yuan(totals.gross_cents), '']
      .map(esc).join(',')
  );
  return '﻿' + lines.join('\r\n');
}

/** 有交车记录的月份列表，给报表页下拉用 */
export function availableMonths(db) {
  const rows = db
    .prepare(
      `SELECT DISTINCT delivered_at AS d FROM orders
       WHERE status = 'delivered' AND delivered_at IS NOT NULL
       ORDER BY d DESC`
    )
    .all();
  return [...new Set(rows.map((r) => monthOf(r.d)))];
}

// 工单业务：建单、改单、状态推进、作废。状态规则全部交给 stateMachine。
import { nowLocal } from './time.js';
import { parseYuan } from './money.js';
import { assertTransition, assertEditable, nextStatus, STATUS_LABELS } from './stateMachine.js';
import { restock } from './inventory.js';

export class OrderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OrderError';
  }
}

/** 查单不抛错：详情页 load 用它，查不到由页面转 404 */
export function findOrder(db, id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
}

export function getOrder(db, id) {
  const order = findOrder(db, id);
  if (!order) throw new OrderError(`工单不存在（id=${id}）`);
  return order;
}

/** 生成单号：WX + 年月日 + 当日序号，如 WX20260915-01。
 *  序号取当日最大号 +1（不是 COUNT+1）：删单留洞、作废占号都不会撞号。 */
function nextOrderNo(db, now) {
  const day = now.slice(0, 10).replaceAll('-', '');
  const prefix = `WX${day}-`;
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(CAST(SUBSTR(order_no, ?) AS INTEGER)), 0) AS max_seq
       FROM orders WHERE order_no LIKE ? || '%'`
    )
    .get(prefix.length + 1, prefix);
  return `${prefix}${String(row.max_seq + 1).padStart(2, '0')}`;
}

function validateOrderFields({ frame_tail, brand, fault_desc, labor_cents, expect_done_at }) {
  if (!/^[0-9A-Za-z]{6}$/.test(frame_tail ?? '')) {
    throw new OrderError('车架号后六位必须是 6 位字母或数字');
  }
  if (!brand?.trim()) throw new OrderError('品牌不能为空');
  if (!fault_desc?.trim()) throw new OrderError('故障描述不能为空');
  if (!Number.isInteger(labor_cents) || labor_cents < 0) {
    throw new OrderError('预估工费必须是不小于 0 的金额');
  }
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(expect_done_at ?? '')) {
    throw new OrderError('预计完工时间格式不对');
  }
}

/** 接车建单。laborYuan 是用户输入的「元」字符串，这里转成分。 */
export function createOrder(db, { frame_tail, brand, fault_desc, laborYuan, expect_done_at }) {
  const labor_cents = parseYuan(laborYuan);
  const fields = {
    frame_tail: (frame_tail ?? '').trim(),
    brand: (brand ?? '').trim(),
    fault_desc: (fault_desc ?? '').trim(),
    labor_cents,
    expect_done_at: (expect_done_at ?? '').replace('T', ' ').slice(0, 16) + ':00'
  };
  validateOrderFields(fields);
  const now = nowLocal();
  // 取号与插单在同一事务里，不给并发留缝隙
  const tx = db.transaction(() =>
    db
      .prepare(
        `INSERT INTO orders
           (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at,
            status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .run(nextOrderNo(db, now), fields.frame_tail, fields.brand, fields.fault_desc,
        fields.labor_cents, fields.expect_done_at, now, now)
  );
  return tx().lastInsertRowid;
}

/** 修改工单基础信息。已交车 / 已作废的单在这里被拦下。 */
export function updateOrder(db, id, { frame_tail, brand, fault_desc, laborYuan, expect_done_at }) {
  const order = getOrder(db, id);
  assertEditable(order.status);
  const labor_cents = parseYuan(laborYuan);
  const fields = {
    frame_tail: (frame_tail ?? '').trim(),
    brand: (brand ?? '').trim(),
    fault_desc: (fault_desc ?? '').trim(),
    labor_cents,
    expect_done_at: (expect_done_at ?? '').replace('T', ' ').slice(0, 16) + ':00'
  };
  validateOrderFields(fields);
  db.prepare(
    `UPDATE orders SET frame_tail=?, brand=?, fault_desc=?, labor_cents=?, expect_done_at=?, updated_at=?
     WHERE id=?`
  ).run(fields.frame_tail, fields.brand, fields.fault_desc, fields.labor_cents,
    fields.expect_done_at, nowLocal(), id);
}

/** 推进到下一级状态（待修→在修→待取件→已交车），只能一级一级走 */
export function advanceOrder(db, id) {
  const order = getOrder(db, id);
  const to = nextStatus(order.status);
  if (!to) throw new OrderError(`工单当前状态「${STATUS_LABELS[order.status]}」不能再推进`);
  assertTransition(order.status, to);
  const now = nowLocal();
  db.prepare(
    `UPDATE orders SET status=?, updated_at=?, delivered_at=CASE WHEN ?='delivered' THEN ? ELSE delivered_at END
     WHERE id=?`
  ).run(to, now, to, now, id);
  return to;
}

/** 作废：必须留原因和经手人。已交车的单不能作废（状态机拦截）。
 *  本单领用的库存件随作废一并退回库存，与翻状态在同一事务里，账实不脱节。 */
export function voidOrder(db, id, { reason, operator }) {
  const order = getOrder(db, id);
  assertTransition(order.status, 'void');
  if (!reason?.trim()) throw new OrderError('作废必须填写原因');
  if (!operator?.trim()) throw new OrderError('作废必须填写经手人');
  const now = nowLocal();
  const drawn = db
    .prepare("SELECT inventory_id, qty FROM order_parts WHERE order_id = ? AND source = 'inventory'")
    .all(id);
  const tx = db.transaction(() => {
    for (const p of drawn) restock(db, p.inventory_id, p.qty); // 领了多少退回多少
    db.prepare(
      `UPDATE orders SET status='void', void_reason=?, void_operator=?, voided_at=?, updated_at=?
       WHERE id=?`
    ).run(reason.trim(), operator.trim(), now, now, id);
  });
  tx();
}

/** 列表查询：可按状态过滤，已作废的默认沉底 */
export function listOrders(db, status = null) {
  const base = `SELECT * FROM orders`;
  const orderBy = ` ORDER BY CASE status WHEN 'void' THEN 1 ELSE 0 END, created_at DESC, id DESC`;
  if (status && status !== 'all') {
    return db.prepare(`${base} WHERE status = ?${orderBy}`).all(status);
  }
  return db.prepare(base + orderBy).all();
}

/** 首页状态计数 */
export function countByStatus(db) {
  const rows = db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
  const counts = { pending: 0, repairing: 0, ready: 0, delivered: 0, void: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

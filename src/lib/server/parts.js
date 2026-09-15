// 换件登记与旧件处理。
// 换件来源三样：customer 客户自带 / inventory 库存领用（必须过库存扣减）；
// 拆下待鉴定的旧件进保管区，处理去向三样：退还客户 / 报废 / 转可用库存（必填质检备注）。
import { nowLocal } from './time.js';
import { assertEditable } from './stateMachine.js';
import { drawFromInventory, putOldPartIntoInventory } from './inventory.js';
import { dueAt } from './storage.js';
import { getOrder } from './orders.js';
import { DISPOSITION_LABELS } from '../labels.js';

export class PartError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PartError';
  }
}

/**
 * 登记工单换件。
 * - source=customer：客户自带配件，零成本，只记账不动库存；
 * - source=inventory：店里库存领用，与库存扣减在同一事务里，不够扣就整体回滚。
 */
export function addOrderPart(db, orderId, { source, inventoryId, name, qty }) {
  const order = getOrder(db, orderId);
  assertEditable(order.status);
  qty = Number(qty);
  if (!Number.isInteger(qty) || qty <= 0) throw new PartError('数量必须是正整数');
  const now = nowLocal();

  if (source === 'inventory') {
    const tx = db.transaction(() => {
      const item = drawFromInventory(db, Number(inventoryId), qty); // 不够扣会抛错 → 回滚
      db.prepare(
        `INSERT INTO order_parts (order_id, source, inventory_id, name, qty, unit_cost_cents, created_at)
         VALUES (?, 'inventory', ?, ?, ?, ?, ?)`
      ).run(orderId, item.id, item.name, qty, item.cost_cents, now);
    });
    tx();
    return;
  }
  if (source === 'customer') {
    if (!name?.trim()) throw new PartError('客户自带配件要填写配件名称');
    db.prepare(
      `INSERT INTO order_parts (order_id, source, inventory_id, name, qty, unit_cost_cents, created_at)
       VALUES (?, 'customer', NULL, ?, ?, 0, ?)`
    ).run(orderId, name.trim(), qty, now);
    return;
  }
  throw new PartError(`未知的配件来源：${source}`);
}

/** 登记拆下待鉴定的旧件：默认进保管区，保管期 14 天 */
export function registerOldPart(db, orderId, { name, note }) {
  const order = getOrder(db, orderId);
  assertEditable(order.status);
  if (!name?.trim()) throw new PartError('旧件名称不能为空');
  const now = nowLocal();
  const r = db
    .prepare(
      `INSERT INTO old_parts (order_id, name, note, kept_at, due_at, status)
       VALUES (?, ?, ?, ?, ?, 'keeping')`
    )
    .run(orderId, name.trim(), note?.trim() || null, now, dueAt(now));
  return r.lastInsertRowid;
}

export const DISPOSITIONS = ['return_customer', 'scrap', 'to_inventory'];
export { DISPOSITION_LABELS };

/**
 * 处理保管区旧件。
 * - return_customer 退还客户 / scrap 报废：记去向、经手人；
 * - to_inventory 转可用库存：必须填质检备注，同时入库存（同事务）。
 */
export function disposeOldPart(db, oldPartId, { disposition, qc_note, operator }) {
  const part = db.prepare('SELECT * FROM old_parts WHERE id = ?').get(oldPartId);
  if (!part) throw new PartError(`旧件不存在（id=${oldPartId}）`);
  if (part.status !== 'keeping') {
    throw new PartError(`这件旧件已处理过（${DISPOSITION_LABELS[part.disposition] ?? part.status}），不能重复处理`);
  }
  if (!DISPOSITIONS.includes(disposition)) throw new PartError(`未知的处理去向：${disposition}`);
  if (!operator?.trim()) throw new PartError('处理旧件必须填写经手人');
  if (disposition === 'to_inventory' && !qc_note?.trim()) {
    throw new PartError('转可用库存必须填写质检备注');
  }
  const now = nowLocal();
  const statusMap = { return_customer: 'returned', scrap: 'scrapped', to_inventory: 'to_inventory' };
  const tx = db.transaction(() => {
    if (disposition === 'to_inventory') {
      putOldPartIntoInventory(db, part.name, now);
    }
    db.prepare(
      `UPDATE old_parts SET status=?, disposition=?, qc_note=?, operator=?, disposed_at=?
       WHERE id=?`
    ).run(statusMap[disposition], disposition, qc_note?.trim() || null, operator.trim(), now, oldPartId);
  });
  tx();
}

/** 某工单的换件记录 */
export function listOrderParts(db, orderId) {
  return db
    .prepare('SELECT * FROM order_parts WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

/** 某工单的旧件记录（含已处理的，方便客户回头查） */
export function listOldPartsOfOrder(db, orderId) {
  return db
    .prepare('SELECT * FROM old_parts WHERE order_id = ? ORDER BY id')
    .all(orderId);
}

/** 已处理旧件台账 */
export function listDisposedOldParts(db) {
  return db
    .prepare(
      `SELECT op.*, o.order_no, o.frame_tail, o.brand
       FROM old_parts op JOIN orders o ON o.id = op.order_id
       WHERE op.status != 'keeping'
       ORDER BY op.disposed_at DESC`
    )
    .all();
}

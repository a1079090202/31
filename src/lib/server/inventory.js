// 库存扣减：唯一允许动库存数量的模块之一（另一个是旧件转可用入库）。
// 规则只有一条铁律：扣完不能是负数，不够就拦下，一笔都不许扣。

export class InventoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InventoryError';
  }
}

/**
 * 从库存领用 qty 件。库存不足抛 InventoryError，且不做任何扣减。
 * 返回扣减后的库存行（含成本快照所需的 cost_cents）。
 * 调用方若还有后续写库操作，应把本函数包在自己的事务里。
 */
export function drawFromInventory(db, inventoryId, qty) {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new InventoryError(`领用数量必须是正整数，收到：${qty}`);
  }
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventoryId);
  if (!item) throw new InventoryError(`库存里找不到这个配件（id=${inventoryId}）`);
  if (item.stock < qty) {
    throw new InventoryError(
      `「${item.name}」库存不足：现存 ${item.stock} ${item.unit}，要领 ${qty}，库存不能扣成负数`
    );
  }
  db.prepare('UPDATE inventory SET stock = stock - ? WHERE id = ?').run(qty, inventoryId);
  return { ...item, stock: item.stock - qty };
}

/** 入库 / 盘点补货 */
export function restock(db, inventoryId, qty) {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new InventoryError(`入库数量必须是正整数，收到：${qty}`);
  }
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventoryId);
  if (!item) throw new InventoryError(`库存里找不到这个配件（id=${inventoryId}）`);
  db.prepare('UPDATE inventory SET stock = stock + ? WHERE id = ?').run(qty, inventoryId);
}

/**
 * 旧件「转可用库存」：按名字找已有配件则数量 +1，否则新建一条零成本库存。
 * 返回库存行 id。
 */
export function putOldPartIntoInventory(db, name, now) {
  const existing = db.prepare('SELECT * FROM inventory WHERE name = ?').get(name);
  if (existing) {
    db.prepare('UPDATE inventory SET stock = stock + 1 WHERE id = ?').run(existing.id);
    return existing.id;
  }
  const r = db
    .prepare(
      `INSERT INTO inventory (name, unit, stock, cost_cents, created_at)
       VALUES (?, '件', 1, 0, ?)`
    )
    .run(name, now);
  return r.lastInsertRowid;
}

import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/lib/server/db.js';
import { drawFromInventory, InventoryError } from '../src/lib/server/inventory.js';
import { createOrder } from '../src/lib/server/orders.js';
import { addOrderPart } from '../src/lib/server/parts.js';

let db;
let itemId;

beforeEach(() => {
  db = createDb(':memory:');
  const r = db
    .prepare("INSERT INTO inventory (name, unit, stock, cost_cents, created_at) VALUES ('内胎 26×1.95', '条', 3, 800, '2026-09-01 09:00:00')")
    .run();
  itemId = r.lastInsertRowid;
});

const stock = () => db.prepare('SELECT stock FROM inventory WHERE id = ?').get(itemId).stock;

describe('库存扣减', () => {
  it('领用多少扣多少', () => {
    drawFromInventory(db, itemId, 2);
    expect(stock()).toBe(1);
  });

  it('领用量超过库存：拦下，一件都不扣', () => {
    expect(() => drawFromInventory(db, itemId, 4)).toThrow(InventoryError);
    expect(() => drawFromInventory(db, itemId, 4)).toThrow(/库存不足.*不能扣成负数/);
    expect(stock()).toBe(3); // 库存原封不动
  });

  it('恰好领完可以，库存归 0；再领一件就拦', () => {
    drawFromInventory(db, itemId, 3);
    expect(stock()).toBe(0);
    expect(() => drawFromInventory(db, itemId, 1)).toThrow(InventoryError);
    expect(stock()).toBe(0);
  });

  it('领用数量必须是正整数', () => {
    expect(() => drawFromInventory(db, itemId, 0)).toThrow(InventoryError);
    expect(() => drawFromInventory(db, itemId, -1)).toThrow(InventoryError);
    expect(() => drawFromInventory(db, itemId, 1.5)).toThrow(InventoryError);
  });

  it('工单领料：扣库存并记录成本快照；库存不够时整单回滚', () => {
    const orderId = createOrder(db, {
      frame_tail: '8A3F21',
      brand: '捷安特',
      fault_desc: '扎胎',
      laborYuan: '30',
      expect_done_at: '2026-09-20 18:00'
    });

    addOrderPart(db, orderId, { source: 'inventory', inventoryId: itemId, qty: 2 });
    expect(stock()).toBe(1);
    const part = db.prepare('SELECT * FROM order_parts WHERE order_id = ?').get(orderId);
    expect(part.unit_cost_cents).toBe(800); // 成本快照
    expect(part.qty).toBe(2);

    // 只剩 1 条却要领 2 条：报错，且库存、换件记录都不变
    expect(() =>
      addOrderPart(db, orderId, { source: 'inventory', inventoryId: itemId, qty: 2 })
    ).toThrow(InventoryError);
    expect(stock()).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM order_parts WHERE order_id = ?').get(orderId).n).toBe(1);
  });

  it('客户自带配件不动库存、成本为 0', () => {
    const orderId = createOrder(db, {
      frame_tail: '8A3F21',
      brand: '捷安特',
      fault_desc: '装脚踏',
      laborYuan: '10',
      expect_done_at: '2026-09-20 18:00'
    });
    addOrderPart(db, orderId, { source: 'customer', name: '脚踏（客户自带）', qty: 1 });
    expect(stock()).toBe(3);
    const part = db.prepare('SELECT * FROM order_parts WHERE order_id = ?').get(orderId);
    expect(part.unit_cost_cents).toBe(0);
  });
});

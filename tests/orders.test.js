import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb } from '../src/lib/server/db.js';
import { createOrder, voidOrder, getOrder } from '../src/lib/server/orders.js';
import { addOrderPart } from '../src/lib/server/parts.js';

let db;
let chainId; // 链条库存 id，初始库存 8 条

beforeEach(() => {
  db = createDb(':memory:');
  chainId = db
    .prepare(
      "INSERT INTO inventory (name, unit, stock, cost_cents, created_at) VALUES ('链条 8速', '条', 8, 3000, '2026-09-15 10:00:00')"
    )
    .run().lastInsertRowid;
});

afterEach(() => {
  vi.useRealTimers();
});

function newOrder() {
  return createOrder(db, {
    frame_tail: 'ABC123',
    brand: '测试车',
    fault_desc: '测试故障',
    laborYuan: '50',
    expect_done_at: '2026-09-20 18:00'
  });
}

const stock = () => db.prepare('SELECT stock FROM inventory WHERE id = ?').get(chainId).stock;

describe('作废工单回库', () => {
  it('作废把本单领用的库存件如数退回，账实一致', () => {
    const id = newOrder();
    addOrderPart(db, id, { source: 'inventory', inventoryId: chainId, qty: 2 });
    addOrderPart(db, id, { source: 'inventory', inventoryId: chainId, qty: 1 });
    expect(stock()).toBe(8 - 3);

    voidOrder(db, id, { reason: '客户不修了', operator: '小王' });

    expect(stock()).toBe(8);
    expect(getOrder(db, id).status).toBe('void');
  });

  it('客户自带件本来就没动库存，作废时不参与回库', () => {
    const id = newOrder();
    addOrderPart(db, id, { source: 'customer', name: '自带脚踏', qty: 1 });

    voidOrder(db, id, { reason: '客户不修了', operator: '小王' });

    expect(stock()).toBe(8);
  });

  it('没领件的单作废，库存不变', () => {
    const id = newOrder();
    voidOrder(db, id, { reason: '客户送错车', operator: '小王' });
    expect(stock()).toBe(8);
    expect(getOrder(db, id).status).toBe('void');
  });

  it('回库失败则整单不作废：翻状态与回库在同一事务', () => {
    const id = newOrder();
    addOrderPart(db, id, { source: 'inventory', inventoryId: chainId, qty: 2 });
    // 把换件记录的库存指向弄坏（绕过外键），模拟回库必然失败的数据
    db.pragma('foreign_keys = OFF');
    db.prepare('UPDATE order_parts SET inventory_id = 99999 WHERE order_id = ?').run(id);
    db.pragma('foreign_keys = ON');

    expect(() => voidOrder(db, id, { reason: '客户不修了', operator: '小王' })).toThrow(/找不到/);

    expect(getOrder(db, id).status).toBe('pending'); // 状态没翻
    expect(stock()).toBe(8 - 2); // 库存也没被部分回滚
  });

  it('已作废的单不能再次作废，库存不会重复回库', () => {
    const id = newOrder();
    addOrderPart(db, id, { source: 'inventory', inventoryId: chainId, qty: 2 });
    voidOrder(db, id, { reason: '客户不修了', operator: '小王' });
    expect(stock()).toBe(8);

    expect(() => voidOrder(db, id, { reason: '再试一次', operator: '小王' })).toThrow(/已作废/);
    expect(stock()).toBe(8);
  });
});

describe('单号生成', () => {
  const at = (local) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(local.replace(' ', 'T')));
  };
  const orderNo = (id) => db.prepare('SELECT order_no FROM orders WHERE id = ?').get(id).order_no;

  it('当天从 01 开始逐单递增', () => {
    at('2026-09-15 09:00:00');
    expect(orderNo(newOrder())).toBe('WX20260915-01');
    expect(orderNo(newOrder())).toBe('WX20260915-02');
    expect(orderNo(newOrder())).toBe('WX20260915-03');
  });

  it('中间删单留洞也不撞号：取最大序号 +1，不是 COUNT+1', () => {
    at('2026-09-15 09:00:00');
    newOrder();
    newOrder();
    newOrder(); // -01 -02 -03
    db.prepare("DELETE FROM orders WHERE order_no = 'WX20260915-02'").run();
    // 旧逻辑 COUNT(*)=2 会再发 -03，撞上还在的 -03（UNIQUE 冲突）
    expect(orderNo(newOrder())).toBe('WX20260915-04');
  });

  it('作废的单占号不释放', () => {
    at('2026-09-15 09:00:00');
    newOrder();
    const id2 = newOrder();
    voidOrder(db, id2, { reason: '客户不修了', operator: '小王' });
    expect(orderNo(newOrder())).toBe('WX20260915-03');
  });

  it('跨天序号重新从 01 开始', () => {
    at('2026-09-14 09:00:00');
    expect(orderNo(newOrder())).toBe('WX20260914-01');
    at('2026-09-15 09:00:00');
    expect(orderNo(newOrder())).toBe('WX20260915-01');
  });
});

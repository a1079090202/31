import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { restock } from '$lib/server/inventory.js';
import { parseYuan } from '$lib/server/money.js';
import { nowLocal } from '$lib/server/time.js';

export function load() {
  const db = getDb();
  return { items: db.prepare('SELECT * FROM inventory ORDER BY name').all() };
}

export const actions = {
  restock: async ({ request }) => {
    const f = await request.formData();
    try {
      restock(getDb(), Number(f.get('inventory_id')), Number(f.get('qty')));
      return { ok: true };
    } catch (e) {
      return fail(400, { error: e.message });
    }
  },

  addItem: async ({ request }) => {
    const f = await request.formData();
    const name = String(f.get('name') ?? '').trim();
    const unit = String(f.get('unit') ?? '个').trim() || '个';
    try {
      if (!name) throw new Error('配件名称不能为空');
      const stock = Number(f.get('stock'));
      if (!Number.isInteger(stock) || stock < 0) throw new Error('初始库存必须是不小于 0 的整数');
      const cost = parseYuan(f.get('cost'));
      if (cost < 0) throw new Error('成本不能是负数');
      getDb()
        .prepare('INSERT INTO inventory (name, unit, stock, cost_cents, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(name, unit, stock, cost, nowLocal());
      return { ok: true };
    } catch (e) {
      const msg = String(e.message).includes('UNIQUE') ? `「${name}」已在库存里，直接入库即可` : e.message;
      return fail(400, { error: msg });
    }
  }
};

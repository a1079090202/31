import { fail, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { getOrder, updateOrder, advanceOrder, voidOrder } from '$lib/server/orders.js';
import { addOrderPart, registerOldPart, listOrderParts, listOldPartsOfOrder } from '$lib/server/parts.js';
import { nextStatus } from '$lib/server/stateMachine.js';

export function load({ params }) {
  const db = getDb();
  const order = getOrder(db, Number(params.id));
  if (!order) error(404, '工单不存在');
  const editable = order.status !== 'delivered' && order.status !== 'void';
  return {
    order,
    parts: listOrderParts(db, order.id),
    oldParts: listOldPartsOfOrder(db, order.id),
    inventory: db.prepare('SELECT * FROM inventory ORDER BY name').all(),
    editable,
    next: editable ? nextStatus(order.status) : null
  };
}

// 每个动作只做一件事：取表单 → 调业务模块 → 业务异常原样拦回页面
const guard = (fn) => async (event) => {
  try {
    return (await fn(event)) ?? { ok: true };
  } catch (e) {
    return fail(400, { error: e.message });
  }
};

export const actions = {
  update: guard(async ({ params, request }) => {
    const f = await request.formData();
    updateOrder(getDb(), Number(params.id), {
      frame_tail: f.get('frame_tail'),
      brand: f.get('brand'),
      fault_desc: f.get('fault_desc'),
      laborYuan: f.get('labor'),
      expect_done_at: f.get('expect_done_at')
    });
  }),

  advance: guard(async ({ params }) => {
    advanceOrder(getDb(), Number(params.id));
  }),

  void: guard(async ({ params, request }) => {
    const f = await request.formData();
    voidOrder(getDb(), Number(params.id), {
      reason: f.get('reason'),
      operator: f.get('operator')
    });
  }),

  addPart: guard(async ({ params, request }) => {
    const f = await request.formData();
    addOrderPart(getDb(), Number(params.id), {
      source: f.get('source'),
      inventoryId: f.get('inventory_id'),
      name: f.get('part_name'),
      qty: f.get('qty')
    });
  }),

  addOldPart: guard(async ({ params, request }) => {
    const f = await request.formData();
    registerOldPart(getDb(), Number(params.id), {
      name: f.get('old_name'),
      note: f.get('old_note')
    });
  })
};

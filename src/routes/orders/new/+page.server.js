import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { createOrder } from '$lib/server/orders.js';

export const actions = {
  default: async ({ request }) => {
    const f = await request.formData();
    const values = {
      frame_tail: f.get('frame_tail'),
      brand: f.get('brand'),
      fault_desc: f.get('fault_desc'),
      laborYuan: f.get('labor'),
      expect_done_at: f.get('expect_done_at')
    };
    let id;
    try {
      id = createOrder(getDb(), values);
    } catch (e) {
      return fail(400, { error: e.message, values });
    }
    redirect(303, `/orders/${id}`); // redirect 是抛异常实现的，不能放进上面的 try
  }
};

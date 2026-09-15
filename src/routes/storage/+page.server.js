import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db.js';
import { listKeeping } from '$lib/server/storage.js';
import { disposeOldPart, listDisposedOldParts } from '$lib/server/parts.js';
import { nowLocal } from '$lib/server/time.js';

export function load() {
  const db = getDb();
  const now = nowLocal();
  return {
    keeping: listKeeping(db, now),
    disposed: listDisposedOldParts(db),
    now
  };
}

export const actions = {
  dispose: async ({ request }) => {
    const f = await request.formData();
    try {
      disposeOldPart(getDb(), Number(f.get('old_part_id')), {
        disposition: f.get('disposition'),
        qc_note: f.get('qc_note'),
        operator: f.get('operator')
      });
      return { ok: true };
    } catch (e) {
      return fail(400, { error: e.message });
    }
  }
};

// 旧件保管期计算：拆下待鉴定的旧件默认进保管区，保管期 14 天。
// 超过 14 天还没处理（退还/报废/转可用）的，进「待处置」列表提醒。
import { addDays } from './time.js';

export const KEEP_DAYS = 14;

/** 保管期满时间 = 进区时间 + 14 天（本地时间字符串） */
export function dueAt(keptAt) {
  return addDays(keptAt, KEEP_DAYS);
}

/** 是否已超期：当前时间严格晚于期满时间才算「超过 14 天」 */
export function isOverdue(keptAt, now) {
  return now > dueAt(keptAt);
}

/** 待处置列表：还在保管区、且已超期的旧件，按进区时间排，最久的在前 */
export function listOverdue(db, now) {
  return db
    .prepare(
      `SELECT op.*, o.order_no, o.frame_tail, o.brand
       FROM old_parts op
       JOIN orders o ON o.id = op.order_id
       WHERE op.status = 'keeping' AND op.due_at < ?
       ORDER BY op.kept_at ASC`
    )
    .all(now);
}

/** 保管区全量列表（含未超期），供保管区页面展示 */
export function listKeeping(db, now) {
  const rows = db
    .prepare(
      `SELECT op.*, o.order_no, o.frame_tail, o.brand
       FROM old_parts op
       JOIN orders o ON o.id = op.order_id
       WHERE op.status = 'keeping'
       ORDER BY op.due_at ASC`
    )
    .all();
  return rows.map((r) => ({ ...r, overdue: r.due_at < now }));
}

/** 待处置数量，给首页提醒角标用 */
export function countOverdue(db, now) {
  return db
    .prepare("SELECT COUNT(*) AS n FROM old_parts WHERE status = 'keeping' AND due_at < ?")
    .get(now).n;
}

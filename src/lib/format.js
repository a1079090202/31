// 纯展示格式化，前后端都可用。业务计算不经过这里。

/** 分 -> '1,234.50' 元字符串 */
export function yuan(cents) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const int = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const s = `${int}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${s}` : s;
}

/** 'YYYY-MM-DD HH:mm:ss' -> 'YYYY-MM-DD HH:mm'（列表里省点地方） */
export function shortTime(s) {
  return s ? s.slice(0, 16) : '';
}

/** 距期满还剩/超了几天，保管区列表用 */
export function daysToDue(dueAt, now) {
  const ms = new Date(dueAt.replace(' ', 'T')) - new Date(now.replace(' ', 'T'));
  const days = Math.floor(ms / 86400000);
  return days;
}

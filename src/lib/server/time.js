// 本地时间工具：全系统统一使用 'YYYY-MM-DD HH:mm:ss' 本地时间字符串。
// 该格式零填充、可按字典序比较，SQLite 的 datetime() 也能直接识别。

function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD HH:mm:ss'（本地时间） */
export function fmtLocal(d) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 当前本地时间字符串 */
export function nowLocal() {
  return fmtLocal(new Date());
}

/** 解析本地时间字符串为 Date */
export function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) throw new Error(`无法识别的本地时间：${s}`);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

/** 在本地时间字符串上加 n 天，返回新的本地时间字符串 */
export function addDays(localStr, days) {
  const d = parseLocal(localStr);
  d.setDate(d.getDate() + days);
  return fmtLocal(d);
}

/** 取 'YYYY-MM'，用于月度汇总 */
export function monthOf(localStr) {
  return localStr.slice(0, 7);
}

/** 月份平移：('2026-01', -1) -> '2025-12'，给「上月」这类锚点用 */
export function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** 当前月份 'YYYY-MM' */
export function currentMonth() {
  return nowLocal().slice(0, 7);
}

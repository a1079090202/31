// 金额一律以「分」为单位的整数存储与计算，展示层才格式化成元。

export class MoneyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MoneyError';
  }
}

/**
 * 把用户输入的「元」字符串（如 '12'、'12.5'、'12.50'）解析为分的整数。
 * 非法输入或超过两位小数直接抛错，绝不用浮点近似。
 */
export function parseYuan(input) {
  const s = String(input ?? '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    throw new MoneyError(`金额格式不对：「${s}」，请输入数字，最多两位小数`);
  }
  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;
  const [yuan, frac = ''] = body.split('.');
  const cents = Number(yuan) * 100 + Number((frac + '00').slice(0, 2));
  return negative ? -cents : cents;
}

/** 分 -> '1234.50' 这样的字符串（不带货币符号，方便表格对齐） */
export function formatCents(cents) {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${s}` : s;
}

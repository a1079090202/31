// 工单状态机：唯一负责「状态能不能这么走」的模块。
// 纯函数、不碰数据库，路由与业务层都只调这里的断言。
import { STATUS_LABELS } from '../labels.js';

export const FLOW = ['pending', 'repairing', 'ready', 'delivered'];

export { STATUS_LABELS };

export class TransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TransitionError';
  }
}

const label = (s) => STATUS_LABELS[s] ?? s;

/** 顺序流程中的下一个状态；已到末态或已作废返回 null */
export function nextStatus(current) {
  const i = FLOW.indexOf(current);
  if (i === -1 || i === FLOW.length - 1) return null;
  return FLOW[i + 1];
}

/**
 * 断言工单可以从 from 走到 to，不合法就抛 TransitionError，
 * 跳级时报错信息里说明中间还差哪几步。
 * 特殊状态 void：未交车的单可作废；已交车的单一律锁定。
 */
export function assertTransition(from, to) {
  if (from === 'void') {
    throw new TransitionError('工单已作废，不能再变更状态');
  }
  if (from === 'delivered') {
    throw new TransitionError('工单已交车，状态不可再变更');
  }
  if (to === 'void') return; // 未交车均可作废
  if (to === from) {
    throw new TransitionError(`工单已处于「${label(from)}」，无需重复操作`);
  }
  const fi = FLOW.indexOf(from);
  const ti = FLOW.indexOf(to);
  if (ti === -1) throw new TransitionError(`未知状态：${to}`);
  if (ti === fi + 1) return;
  if (ti < fi) {
    throw new TransitionError(`不能从「${label(from)}」回退到「${label(to)}」，流程只能一级一级向前`);
  }
  const missing = FLOW.slice(fi + 1, ti).map(label).join(' → ');
  throw new TransitionError(
    `不能从「${label(from)}」直接跳到「${label(to)}」，还差中间步骤：${missing}`
  );
}

/** 已交车 / 已作废的单子内容锁定，任何修改前先过这道断言 */
export function assertEditable(status) {
  if (status === 'delivered') {
    throw new TransitionError('工单已交车，内容已锁定，不能再修改');
  }
  if (status === 'void') {
    throw new TransitionError('工单已作废，内容已锁定，不能再修改');
  }
}

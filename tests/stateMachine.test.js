import { describe, it, expect } from 'vitest';
import {
  assertTransition,
  assertEditable,
  nextStatus,
  TransitionError
} from '../src/lib/server/stateMachine.js';

describe('工单状态机', () => {
  it('允许一级一级正向推进：待修→在修→待取件→已交车', () => {
    expect(nextStatus('pending')).toBe('repairing');
    expect(nextStatus('repairing')).toBe('ready');
    expect(nextStatus('ready')).toBe('delivered');
    expect(nextStatus('delivered')).toBe(null);
    expect(() => assertTransition('pending', 'repairing')).not.toThrow();
    expect(() => assertTransition('repairing', 'ready')).not.toThrow();
    expect(() => assertTransition('ready', 'delivered')).not.toThrow();
  });

  it('跳一级被拦，并说明差哪一步', () => {
    expect(() => assertTransition('pending', 'ready')).toThrow(TransitionError);
    expect(() => assertTransition('pending', 'ready')).toThrow(/待修.*待取件.*在修/);
  });

  it('跳两级被拦，缺失的两步都要说出来', () => {
    expect(() => assertTransition('pending', 'delivered')).toThrow(/在修.*待取件/);
    expect(() => assertTransition('repairing', 'delivered')).toThrow(/待取件/);
  });

  it('不允许回退', () => {
    expect(() => assertTransition('ready', 'repairing')).toThrow(/回退/);
    expect(() => assertTransition('delivered', 'ready')).toThrow(/已交车/);
  });

  it('已交车的单：任何状态变更（含作废）都被拦', () => {
    for (const to of ['pending', 'repairing', 'ready', 'delivered', 'void']) {
      expect(() => assertTransition('delivered', to)).toThrow(TransitionError);
    }
  });

  it('未交车的单可以作废；已作废的单不能再动', () => {
    for (const from of ['pending', 'repairing', 'ready']) {
      expect(() => assertTransition(from, 'void')).not.toThrow();
    }
    expect(() => assertTransition('void', 'pending')).toThrow(/已作废/);
    expect(() => assertTransition('void', 'void')).toThrow(/已作废/);
  });

  it('已交车 / 已作废的单内容锁定，其余可改', () => {
    expect(() => assertEditable('delivered')).toThrow(/已交车.*锁定/);
    expect(() => assertEditable('void')).toThrow(/已作废.*锁定/);
    expect(() => assertEditable('pending')).not.toThrow();
    expect(() => assertEditable('repairing')).not.toThrow();
    expect(() => assertEditable('ready')).not.toThrow();
  });
});

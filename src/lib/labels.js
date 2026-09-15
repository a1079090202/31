// 前后端共用的中文标签。状态机的状态定义在 server/stateMachine.js，
// 这里只放展示文案，组件和服务端模块都从这里取，保证全站用词一致。

export const STATUS_LABELS = {
  pending: '待修',
  repairing: '在修',
  ready: '待取件',
  delivered: '已交车',
  void: '已作废'
};

export const SOURCE_LABELS = {
  customer: '客户自带配件',
  inventory: '店里库存领用'
};

export const DISPOSITION_LABELS = {
  return_customer: '退还客户',
  scrap: '报废',
  to_inventory: '转可用库存'
};

export const OLD_PART_STATUS_LABELS = {
  keeping: '保管中',
  returned: '已退还客户',
  scrapped: '已报废',
  to_inventory: '已转可用库存'
};

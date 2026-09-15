// 初始化数据：6 台样单（覆盖各状态）+ 10 种配件库存 + 若干换件与旧件记录。
// 只在空库首次启动时灌入；日期都相对当前时间生成，保证开箱就能看到
// 在修中的单、已交车的单、以及一件「超过 14 天未处理」的待处置旧件。
import { nowLocal, addDays } from './time.js';

export function seed(db) {
  const now = nowLocal();

  const insertInventory = db.prepare(
    `INSERT INTO inventory (name, unit, stock, cost_cents, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertOrder = db.prepare(
    `INSERT INTO orders
       (order_no, frame_tail, brand, fault_desc, labor_cents, expect_done_at,
        status, created_at, updated_at, delivered_at, void_reason, void_operator, voided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOrderPart = db.prepare(
    `INSERT INTO order_parts (order_id, source, inventory_id, name, qty, unit_cost_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertOldPart = db.prepare(
    `INSERT INTO old_parts (order_id, name, note, kept_at, due_at, status)
     VALUES (?, ?, ?, ?, ?, 'keeping')`
  );

  const tx = db.transaction(() => {
    // ── 10 种配件库存 ─────────────────────────────────────────────
    const items = [
      ['内胎 26×1.95', '条', 20, 800],
      ['外胎 26×1.95', '条', 12, 3500],
      ['刹车皮（V刹）', '对', 15, 1200],
      ['碟刹来令片', '对', 10, 2500],
      ['链条 8速', '条', 8, 3000],
      ['飞轮 8速', '个', 5, 5500],
      ['变速线管套装', '套', 10, 1500],
      ['脚踏（通用）', '副', 6, 2800],
      ['车铃', '个', 9, 900],
      ['辐条 26寸（含条帽）', '根', 50, 150]
    ];
    const invIds = {};
    for (const [name, unit, stock, cost] of items) {
      const r = insertInventory.run(name, unit, stock, cost, now);
      invIds[name] = r.lastInsertRowid;
    }

    // ── 6 台样单 ─────────────────────────────────────────────────
    // 1) 待修：今早刚接
    insertOrder.run(
      'WX-DEMO-01', '8A3F21', '捷安特 ATX660', '后轮异响，骑行时有规律咔哒声',
      5000, addDays(now, 2), 'pending', now, now, null, null, null, null
    );
    // 2) 在修：昨天接的，已领一条内胎
    const d1 = addDays(now, -1);
    const o2 = insertOrder.run(
      'WX-DEMO-02', 'C77B02', '美利达 勇士500', '扎胎补胎，顺带更换老化外胎',
      3000, addDays(now, 1), 'repairing', d1, d1, null, null, null, null
    ).lastInsertRowid;
    insertOrderPart.run(o2, 'inventory', invIds['内胎 26×1.95'], '内胎 26×1.95', 1, 800, d1);
    db.prepare('UPDATE inventory SET stock = stock - 1 WHERE id = ?').run(invIds['内胎 26×1.95']);
    // 3) 待取件：修完等客户来拿
    const d3 = addDays(now, -3);
    insertOrder.run(
      'WX-DEMO-03', 'F0E9D4', '喜德盛 旭日300', '变速不准，调变速并换线管',
      6000, addDays(now, -1), 'ready', d3, now, null, null, null, null
    );
    // 4) 已交车（本月）：换链条 + 客户自带脚踏
    const d4 = addDays(now, -5);
    const o4 = insertOrder.run(
      'WX-DEMO-04', '12AB98', '永久 F1940', '链条拉长跳齿，更换链条；客户自带脚踏安装',
      8000, addDays(now, -4), 'delivered', d4, d4, addDays(now, -4), null, null, null
    ).lastInsertRowid;
    insertOrderPart.run(o4, 'inventory', invIds['链条 8速'], '链条 8速', 1, 3000, d4);
    insertOrderPart.run(o4, 'customer', null, '脚踏（客户自带）', 1, 0, d4);
    db.prepare('UPDATE inventory SET stock = stock - 1 WHERE id = ?').run(invIds['链条 8速']);
    // 5) 已交车（上月）：上月交的，验证月报按交车月归集
    const d5 = addDays(now, -35);
    const o5 = insertOrder.run(
      'WX-DEMO-05', '7K2M55', '凤凰 26寸通勤', '更换刹车皮，调圈',
      4000, addDays(now, -33), 'delivered', d5, d5, addDays(now, -33), null, null, null
    ).lastInsertRowid;
    insertOrderPart.run(o5, 'inventory', invIds['刹车皮（V刹）'], '刹车皮（V刹）', 1, 1200, d5);
    db.prepare('UPDATE inventory SET stock = stock - 1 WHERE id = ?').run(invIds['刹车皮（V刹）']);
    // 6) 已作废：客户送错车，留原因和经手人
    const d6 = addDays(now, -2);
    insertOrder.run(
      'WX-DEMO-06', '000000', '未知品牌', '客户报错车架号，实际车辆未到店，单子作废',
      2000, d6, 'void', d6, d6, null, '客户送错车，车架号对不上', '小王', d6
    );

    // ── 旧件：一件还在保管期内，一件已超 14 天进待处置 ─────────────
    insertOldPart.run(o4, '旧链条 8速', '拉长磨损，客户说先放店里', d4, addDays(d4, 14));
    insertOldPart.run(o5, '旧刹车皮（V刹）', '磨损到极限', d5, addDays(d5, 14)); // 已超期 → 待处置
  });

  tx();
}

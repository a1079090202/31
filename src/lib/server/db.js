// SQLite 连接与表结构。业务规则不放在这里，这里只管建库建表。
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seed } from './seed.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no      TEXT NOT NULL UNIQUE,          -- 单号，如 WX20260915-01
  frame_tail    TEXT NOT NULL,                 -- 车架号后六位
  brand         TEXT NOT NULL,
  fault_desc    TEXT NOT NULL,                 -- 故障描述
  labor_cents   INTEGER NOT NULL CHECK (labor_cents >= 0),  -- 预估工费（分）
  expect_done_at TEXT NOT NULL,                -- 预计完工时间（本地时间）
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','repairing','ready','delivered','void')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  delivered_at  TEXT,                          -- 交车时间
  void_reason   TEXT,                          -- 作废原因
  void_operator TEXT,                          -- 作废经手人
  voided_at     TEXT
);

-- 工单换件记录：source = customer(客户自带) | inventory(库存领用)
CREATE TABLE IF NOT EXISTS order_parts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  source          TEXT NOT NULL CHECK (source IN ('customer','inventory')),
  inventory_id    INTEGER REFERENCES inventory(id),  -- 库存领用时指向库存
  name            TEXT NOT NULL,               -- 配件名（快照，防库存改名）
  qty             INTEGER NOT NULL CHECK (qty > 0),
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,  -- 领用时的单位成本快照（分）
  created_at      TEXT NOT NULL
);

-- 拆下待鉴定的旧件：默认进保管区，超 14 天未处理进待处置
CREATE TABLE IF NOT EXISTS old_parts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id),
  name         TEXT NOT NULL,
  note         TEXT,                           -- 拆下时备注
  kept_at      TEXT NOT NULL,                  -- 进保管区时间
  due_at       TEXT NOT NULL,                  -- 保管期满时间 = kept_at + 14 天
  status       TEXT NOT NULL DEFAULT 'keeping'
               CHECK (status IN ('keeping','returned','scrapped','to_inventory')),
  disposition  TEXT,                           -- return_customer | scrap | to_inventory
  qc_note      TEXT,                           -- 转可用库存必填的质检备注
  operator     TEXT,                           -- 处理经手人
  disposed_at  TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  unit            TEXT NOT NULL DEFAULT '个',
  stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  cost_cents      INTEGER NOT NULL DEFAULT 0,  -- 单位成本（分）
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivered ON orders(delivered_at);
CREATE INDEX IF NOT EXISTS idx_order_parts_order ON order_parts(order_id);
CREATE INDEX IF NOT EXISTS idx_old_parts_status  ON old_parts(status, due_at);
`;

/** 打开（必要时创建）一个数据库并建好表。传 ':memory:' 可拿内存库，测试用。 */
export function createDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

const DB_PATH = process.env.DB_PATH || 'data/shop.db';

let _db;

/** 应用级单例。首次打开时若库是空的，自动灌入初始化数据。 */
export function getDb() {
  if (!_db) {
    _db = createDb(DB_PATH);
    const empty =
      _db.prepare('SELECT COUNT(*) AS n FROM orders').get().n === 0 &&
      _db.prepare('SELECT COUNT(*) AS n FROM inventory').get().n === 0;
    if (empty) seed(_db);
  }
  return _db;
}

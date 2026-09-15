// 删掉本地数据库，下次启动会重新灌入初始化数据。
import { rmSync } from 'node:fs';

for (const f of ['data/shop.db', 'data/shop.db-wal', 'data/shop.db-shm']) {
  rmSync(f, { force: true });
}
console.log('已删除 data/shop.db，下次启动时自动重建并灌入样例数据。');

// 生产启动器：adapter-node 未配 ORIGIN 时默认按 https 计算站点源，
// 会导致浏览器本地 http 访问时表单被 CSRF 检查拦下（403）。
// 这里默认把 ORIGIN 定到本机端口；部署到别的域名/端口时用环境变量覆盖：
//   ORIGIN=http://192.168.1.10:3000 PORT=3000 npm start
process.env.ORIGIN ??= `http://localhost:${process.env.PORT || 3000}`;

await import('../build/index.js');

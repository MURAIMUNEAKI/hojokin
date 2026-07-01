// api/proxy.js
// Vercel サーバーレス関数版 J-Grants API プロキシ
// Vercel は PHP を実行できないため、proxy.php と同じ役割（ドメイン限定中継）を Node で提供する。
// vercel.json のルートにより /proxy.php へのアクセスがこの関数へ振り向けられる。

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const target = (req.query && req.query.url) || '';
  if (!target) {
    res.status(400).json({ error: 'No URL provided' });
    return;
  }

  // セキュリティ: J-Grants のドメインのみ許可（オープンプロキシ化を防ぐ）
  if (target.indexOf('https://api.jgrants-portal.go.jp/') !== 0) {
    res.status(403).json({ error: 'Invalid domain restricted' });
    return;
  }

  try {
    const headers = { 'Accept': 'application/json' };
    // クライアントから X-API-KEY が来ていれば透過転送（公開APIでは不要だが将来に備える）
    if (req.headers['x-api-key']) headers['X-API-KEY'] = req.headers['x-api-key'];

    const apiRes = await fetch(target, { headers }); // Node 18+ のグローバル fetch
    const body = await apiRes.text();
    res.status(apiRes.status).send(body);
  } catch (e) {
    res.status(500).json({ error: 'Request Error: ' + (e && e.message ? e.message : String(e)) });
  }
};

const { verifyToken, readAuthToken, readJsonBody } = require('./_auth');
const { ghGetFile, ghPutFile } = require('./_catalog_repo');

function b64utf8(s) { return Buffer.from(s, 'utf8').toString('base64'); }

module.exports = async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server chưa cấu hình SESSION_SECRET' }); return; }
  if (!verifyToken(readAuthToken(req), secret)) { res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên hết hạn — đăng nhập lại khu quản trị' }); return; }
  if (!process.env.CATALOG_GH_TOKEN) { res.status(500).json({ error: 'Server chưa cấu hình CATALOG_GH_TOKEN' }); return; }

  if (req.method === 'GET') {
    try {
      const f = await ghGetFile('data.json');
      if (!f) { res.status(404).json({ error: 'Chưa có data.json trên GitHub' }); return; }
      const json = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
      res.status(200).json(json);
    } catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object' || !Array.isArray(body.products)) { res.status(400).json({ error: 'Dữ liệu không hợp lệ' }); return; }
    try {
      const existing = await ghGetFile('data.json');
      const json = JSON.stringify(body, null, 2);
      await ghPutFile('data.json', b64utf8(json), 'update catalogue', existing ? existing.sha : null);
      res.status(200).json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Lỗi cập nhật danh mục: ' + e.message }); }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};

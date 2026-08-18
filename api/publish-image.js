const { verifyToken, readAuthToken, readJsonBody } = require('./_auth');
const { ghPutFile } = require('./_catalog_repo');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server chưa cấu hình SESSION_SECRET' }); return; }
  if (!verifyToken(readAuthToken(req), secret)) { res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên hết hạn — đăng nhập lại khu quản trị' }); return; }
  if (!process.env.CATALOG_GH_TOKEN) { res.status(500).json({ error: 'Server chưa cấu hình CATALOG_GH_TOKEN' }); return; }

  const body = await readJsonBody(req);
  const path = String(body.path || '');
  const contentBase64 = String(body.contentBase64 || '');
  if (!/^images\/[a-zA-Z0-9._-]+\.jpg$/.test(path)) { res.status(400).json({ error: 'Đường dẫn ảnh không hợp lệ' }); return; }
  if (!contentBase64) { res.status(400).json({ error: 'Thiếu dữ liệu ảnh' }); return; }

  try {
    await ghPutFile(path, contentBase64, 'add image ' + path, null);
    res.status(200).json({ ok: true, path });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi tải ảnh lên GitHub: ' + e.message });
  }
};

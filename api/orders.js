const { verifyToken, readAuthToken, readJsonBody } = require('./_auth');
const { readOrders, writeOrders } = require('./_orders_repo');

const STATUSES = ['Mới', 'Đã liên hệ', 'Đang giao', 'Đã giao', 'Đã hủy'];

module.exports = async (req, res) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server chưa cấu hình SESSION_SECRET' }); return; }
  if (!verifyToken(readAuthToken(req), secret)) { res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên hết hạn — đăng nhập lại khu quản trị' }); return; }

  if (req.method === 'GET') {
    try {
      const { orders } = await readOrders();
      res.status(200).json({ orders });
    } catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.action !== 'updateStatus') { res.status(400).json({ error: 'action không hợp lệ' }); return; }
    const orderId = body.orderId, status = body.status;
    if (!STATUSES.includes(status)) { res.status(400).json({ error: 'Trạng thái không hợp lệ' }); return; }
    try {
      const { orders, sha } = await readOrders();
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) { res.status(404).json({ error: 'Không tìm thấy đơn hàng' }); return; }
      orders[idx].status = status;
      await writeOrders(orders, sha, 'update order status ' + orderId);
      res.status(200).json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};

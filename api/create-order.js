const { readJsonBody } = require('./_auth');
const { appendOrder } = require('./_orders_repo');

function clean(s) { return String(s == null ? '' : s).trim(); }
function parsePriceVN(s) {
  const digits = String(s || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

async function fetchProducts() {
  const r = await fetch('https://hoangmoc.vercel.app/data.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('Không tải được danh sách sản phẩm để xác thực đơn hàng');
  const j = await r.json();
  return j.products || [];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!process.env.ORDERS_GH_TOKEN) { res.status(500).json({ error: 'Server chưa cấu hình lưu đơn hàng' }); return; }

  const body = await readJsonBody(req);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const customer = body.customer || {};
  const name = clean(customer.name);
  const phone = clean(customer.phone);
  const address = clean(customer.address);
  const note = clean(customer.note);

  if (!rawItems.length) { res.status(400).json({ error: 'Giỏ hàng trống' }); return; }
  if (!name) { res.status(400).json({ error: 'Nhập tên người nhận' }); return; }
  if (!/^[0-9+ ]{8,15}$/.test(phone)) { res.status(400).json({ error: 'Số điện thoại không hợp lệ' }); return; }
  if (!address) { res.status(400).json({ error: 'Nhập địa chỉ giao hàng' }); return; }

  let products;
  try { products = await fetchProducts(); } catch (e) { res.status(502).json({ error: e.message }); return; }

  const items = [];
  for (const it of rawItems) {
    const p = products.find(x => x.id === it.id);
    if (!p) continue;
    const price = parsePriceVN(p.price);
    if (price <= 0) continue;
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    items.push({ id: p.id, name: p.name, price, qty });
  }
  if (!items.length) { res.status(400).json({ error: 'Không có sản phẩm hợp lệ trong giỏ hàng (có thể đã hết hàng hoặc chưa có giá)' }); return; }

  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  const orderId = 'HM' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const order = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'Mới',
    items,
    total,
    customer: { name, phone, address, note },
  };

  try {
    await appendOrder(order);
    res.status(200).json({ orderId, total });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi lưu đơn hàng: ' + e.message });
  }
};

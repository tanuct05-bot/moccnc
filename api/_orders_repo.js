const OWNER = 'tanuct05-bot';
const REPO = 'hoangmoc-orders';
const PATH = 'orders.json';

function headers() {
  return { Authorization: 'Bearer ' + process.env.ORDERS_GH_TOKEN, Accept: 'application/vnd.github+json' };
}

async function readOrders() {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, { headers: headers() });
  if (r.status === 404) return { orders: [], sha: null };
  if (!r.ok) throw new Error('Đọc orders.json lỗi ' + r.status);
  const j = await r.json();
  const content = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8'));
  return { orders: content.orders || [], sha: j.sha };
}

async function writeOrders(orders, sha, message) {
  const body = { message, content: Buffer.from(JSON.stringify({ orders }, null, 2)).toString('base64') };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error('Ghi orders.json lỗi ' + r.status + ' ' + t.slice(0, 200)); }
  return r.json();
}

async function appendOrder(order) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { orders, sha } = await readOrders();
    orders.unshift(order);
    try {
      await writeOrders(orders, sha, 'new order ' + order.id);
      return;
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 250 + Math.random() * 400));
    }
  }
  throw lastErr;
}

module.exports = { readOrders, writeOrders, appendOrder };

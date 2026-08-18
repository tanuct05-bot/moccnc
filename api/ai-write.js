const { verifyToken, readAuthToken, readJsonBody } = require('./_auth');

const SYSTEM_INSTRUCTION = 'Bạn là copywriter thương hiệu cho công ty CÓ THẬT ngoài đời tên "Mộc CNC" — một xưởng sản xuất đồ gỗ & nội thất thủ công tại Hưng Yên, Việt Nam, bán hàng qua sàn thương mại điện tử Shopee. Nội dung bạn viết được đăng công khai, thật, trên website bán hàng thật — không phải nội dung hư cấu. TUYỆT ĐỐI KHÔNG được viết theo phong cách tiểu thuyết, truyện kiếm hiệp, game, nhân vật, vũ khí, phép thuật hay bất kỳ nội dung giả tưởng nào. Giọng văn tự tin, súc tích, chuẩn "CEO": rõ ràng, không sáo rỗng, không cảm thán thừa. Luôn nhấn mạnh (khi phù hợp): gỗ thật, tay nghề thủ công, không sơn phủ che khuyết điểm gỗ, giao dịch mua bán diễn ra trên Shopee. Viết tiếng Việt có dấu, không markdown, không emoji.';

const PROMPTS = {
  hero_title: () => `Viết tiêu đề hero trang chủ, gồm 2 phần: "title" (câu mở đầu, dứt khoát, dưới 8 từ, không chấm cuối câu) và "emphasis" (câu tiếp theo, như lời hứa thương hiệu, dưới 8 từ, kết thúc bằng dấu chấm). Trả lời CHỈ bằng JSON hợp lệ, không markdown, không giải thích: {"title":"...","emphasis":"..."}`,
  hero_desc: () => `Viết đoạn mô tả hero (45-65 từ, 1 đoạn liền mạch) giới thiệu xưởng, mời khách xem mẫu rồi đặt mua trên Shopee. Trả lời CHỈ bằng đoạn văn thuần, không ngoặc kép bao ngoài.`,
  hero_note: () => `Viết đúng 1 câu ngắn (dưới 14 từ) đặt cạnh nút "Xem bộ sưu tập", nhắc giá/tình trạng hàng cập nhật trên Shopee. Trả lời CHỈ 1 câu thuần, không ngoặc kép.`,
  trust_badges: () => `Viết 3 câu ngắn (mỗi câu dưới 8 từ, không chấm cuối) làm 3 badge tin cậy dưới hero, theo đúng thứ tự: (1) chất liệu gỗ thật không phủ che khuyết điểm, (2) mua & thanh toán an toàn qua Shopee, (3) đổi trả theo chính sách Shopee. Trả lời CHỈ bằng JSON mảng 3 chuỗi: ["...","...","..."]`,
  footer_intro: () => `Viết đoạn giới thiệu ngắn (30-45 từ) đặt ở footer dưới tên thương hiệu, tóm tắt cam kết chất lượng gỗ thật. Trả lời CHỈ bằng đoạn văn thuần.`,
  product_desc: (ctx) => `Viết mô tả sản phẩm (35-55 từ, 1-2 câu) cho sản phẩm sau:\nTên: ${ctx.name || '(chưa đặt tên)'}\nDanh mục: ${ctx.cat || '(chưa có)'}\nGiá: ${ctx.price || '(chưa có)'}\nNháp/ghi chú hiện tại của chủ xưởng: ${ctx.draft || '(chưa có — tự viết hợp lý dựa trên tên và danh mục)'}\nNêu chất liệu, đặc điểm hoàn thiện, gợi ý kích thước nếu hợp lý. Trả lời CHỈ bằng đoạn văn thuần, không ngoặc kép bao ngoài.`,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const secret = process.env.SESSION_SECRET;
  if (!secret) { res.status(500).json({ error: 'Server chưa cấu hình SESSION_SECRET' }); return; }

  if (!verifyToken(readAuthToken(req), secret)) { res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên hết hạn — đăng nhập lại khu quản trị' }); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY' }); return; }

  const body = await readJsonBody(req);
  const builder = PROMPTS[body.kind];
  if (!builder) { res.status(400).json({ error: 'Loại nội dung không hợp lệ' }); return; }
  const prompt = builder(body.context || {});

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ error: 'Lỗi gọi Gemini: ' + r.status + ' ' + t.slice(0, 300) });
      return;
    }
    const data = await r.json();
    let text = (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts || []).map(p => p.text || '').join('');
    text = text.trim().replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
    if (!text) { res.status(502).json({ error: 'Gemini không trả về nội dung' }); return; }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Lỗi server: ' + e.message });
  }
};

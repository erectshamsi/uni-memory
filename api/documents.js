const { getDocuments, upsertDocument, deleteDocument } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json"); // همیشه تأکید می‌کنیم که پاسخ ما JSON است

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      return res.status(200).json({ documents: getDocuments() });
    }

    if (req.method === "POST") {
      // این بخش برای جلوگیری از ارورهای پارس کردن اضافه شده
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: "Invalid JSON format" }); }
      }
      
      const existing = getDocuments().find(d => d.id === body.id);
      const doc = upsertDocument({
        id: body.id || Date.now().toString(), // تولید خودکار ID اگر وجود نداشت
        title: body.title,
        content: body.content,
        status: body.status || "approved",
        validity: body.validity || "current"
      });
      return res.status(200).json({ ok: true, document: doc });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: "Missing id" });
      deleteDocument(id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (error) {
    // اگر هر خطایی در سرور رخ دهد، به جای متن، یک JSON خطا برمی‌گردانیم
    return res.status(500).json({ error: "Server Error: " + error.message });
  }
};

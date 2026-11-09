const { getDocuments, upsertDocument, deleteDocument } = require("./_lib/store");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({ documents: getDocuments() });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const existing = getDocuments().find(d => d.id === body.id);

    const contentText = body.content || body.text || existing?.content || "";
    const docLink = body.link !== undefined ? body.link : (existing?.link || "");
    const docCode = body.code !== undefined ? body.code : (existing?.code || "");

    const doc = upsertDocument({
      id: body.id,
      title: body.title ?? existing?.title,
      code: docCode,
      link: docLink,
      content: docLink && !contentText.includes(docLink) 
        ? `${contentText}\n\nلینک بخشنامه در سایت دانشگاه: ${docLink}` 
        : contentText,
      status: body.status ?? existing?.status ?? "approved",
      validity: body.validity ?? existing?.validity ?? "current",
      source: body.source ?? existing?.source ?? "admin"
    });
    return res.status(200).json({ ok: true, document: doc, persisted: "ephemeral-or-seed" });
  }

  if (req.method === "DELETE") {
    const id = req.query?.id || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: "Missing id" });
    return res.status(200).json({ ok: true, documents: deleteDocument(id) });
  }

  return res.status(405).json({ error: "Method not allowed" });
};

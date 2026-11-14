const fs = require("fs");
const path = require("path");

const SEED_PATH = path.join(process.cwd(), "data", "documents.json");
const TMP_PATH = "/tmp/uni-memory-documents.json";

function readDocs() {
  try {
    if (fs.existsSync(TMP_PATH)) {
      return JSON.parse(fs.readFileSync(TMP_PATH, "utf8"));
    }
  } catch (e) {}
  try {
    if (fs.existsSync(SEED_PATH)) {
      return JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    }
  } catch (e) {}
  return [];
}

function writeDocs(docs) {
  try {
    fs.writeFileSync(TMP_PATH, JSON.stringify(docs, null, 2), "utf8");
  } catch (e) {}
  try {
    fs.writeFileSync(SEED_PATH, JSON.stringify(docs, null, 2), "utf8");
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let docs = readDocs();
    if (!Array.isArray(docs)) docs = [];

    if (req.method === "GET") {
      return res.status(200).json({ documents: docs });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body || "{}");
        } catch (e) {
          return res.status(400).json({ error: "فرمت JSON نامعتبر است" });
        }
      }
      body = body || {};

      const idx = docs.findIndex((d) => String(d.id) === String(body.id));
      const existing = idx >= 0 ? docs[idx] : null;

      const doc = {
        id: body.id || existing?.id || "doc-" + Date.now(),
        title: (body.title ?? existing?.title ?? "بدون عنوان").trim(),
        content: (body.content ?? existing?.content ?? "").trim(),
        status: body.status ?? existing?.status ?? "approved",
        validity: body.validity ?? existing?.validity ?? "current",
        source: body.source ?? existing?.source ?? "admin",
        updatedAt: new Date().toISOString()
      };

      if (idx >= 0) {
        docs[idx] = doc;
      } else {
        docs.unshift(doc);
      }

      writeDocs(docs);
      return res.status(200).json({ ok: true, document: doc });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: "شناسه سند ارسال نشده است" });
      docs = docs.filter((d) => String(d.id) !== String(id));
      writeDocs(docs);
      return res.status(200).json({ ok: true, documents: docs });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: "Server Error: " + error.message });
  }
};

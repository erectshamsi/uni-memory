const fs = require("fs");
const path = require("path");

const SEED_PATH = path.join(process.cwd(), "data", "documents.json");
const TMP_PATH = "/tmp/uni-memory-documents.json";

function getDocuments() {
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

function saveDocuments(docs) {
  try {
    fs.writeFileSync(TMP_PATH, JSON.stringify(docs, null, 2), "utf8");
  } catch (e) {}
  try {
    fs.writeFileSync(SEED_PATH, JSON.stringify(docs, null, 2), "utf8");
  } catch (e) {}
  return docs;
}

function upsertDocument(doc) {
  const docs = getDocuments();
  const id = doc.id || "doc-" + Date.now();
  const idx = docs.findIndex((d) => String(d.id) === String(id));
  const existing = idx >= 0 ? docs[idx] : {};

  const record = {
    ...existing,
    ...doc,
    id,
    title: (doc.title ?? existing.title ?? "بدون عنوان").trim(),
    content: (doc.content ?? existing.content ?? "").trim(),
    status: doc.status ?? existing.status ?? "approved",
    validity: doc.validity ?? existing.validity ?? "current",
    source: doc.source ?? existing.source ?? "admin",
    updatedAt: new Date().toISOString()
  };

  if (idx >= 0) docs[idx] = record;
  else docs.unshift(record);

  saveDocuments(docs);
  return record;
}

function deleteDocument(id) {
  const docs = getDocuments().filter((d) => String(d.id) !== String(id));
  return saveDocuments(docs);
}

module.exports = { getDocuments, saveDocuments, upsertDocument, deleteDocument };

// Outils partagés des fonctions serveur (Vercel). Ce code tourne sur le serveur, jamais chez les visiteurs.
// Secrets (réglages Vercel → Environment Variables) :
//   FIREBASE_SA           = contenu JSON de la clé du compte de service Firebase
//   GOOGLE_CLIENT_ID      = identifiant OAuth (Google Cloud) pour accéder au Drive
//   GOOGLE_CLIENT_SECRET  = secret OAuth correspondant
// Le jeton d'accès au Drive et la clé de chiffrement sont rangés dans Firestore « secrets/drive »,
// une zone que les règles de sécurité interdisent à tout le monde sauf au serveur.
const crypto = require("crypto");
const admin = require("firebase-admin");

function app() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SA;
  if (!raw) throw httpErr(500, "config", "FIREBASE_SA manquant");
  return admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}
const fs = () => { app(); return admin.firestore(); };
const auth = () => { app(); return admin.auth(); };

function httpErr(status, code, msg) { const e = new Error(msg || code); e.status = status; e.code = code; return e; }

// ── Réponses HTTP ──
// Le projet Vercel « ecolingo » (même code, autre adresse) appelle le serveur de mes-revision.vercel.app
const OK_ORIGIN = /^https:\/\/(ecolingo-beryl\.vercel\.app|ecolingo-[a-z0-9-]+-c-zzers-projects\.vercel\.app|mes-revision\.vercel\.app|mes-revision-[a-z0-9-]+-c-zzers-projects\.vercel\.app)$/;
function handler(fn) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const o = req.headers.origin || "";
    if (OK_ORIGIN.test(o)) { res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary", "Origin"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); res.setHeader("Access-Control-Max-Age", "600"); }
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ error: "method" });
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const out = await fn(body, req);
      res.status(200).json(out || { ok: true });
    } catch (e) {
      const st = e.status || 500;
      if (st >= 500) console.error(e);
      res.status(st).json({ error: e.code || "server", ...(e.extra || {}) });
    }
  };
}

// ── Qui appelle ? (jeton Firebase envoyé par le site) ──
async function caller(req, required = true) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!t) { if (required) throw httpErr(401, "noauth"); return null; }
  try { return await auth().verifyIdToken(t); }
  catch (e) { throw httpErr(401, "noauth"); }
}
async function isAdminUid(uid) {
  if (!uid) return false;
  const db = fs();
  const [c, a] = await Promise.all([db.doc("config/admins").get(), db.doc("admins/" + uid).get()]);
  const ids = (c.exists && Array.isArray(c.data().ids)) ? c.data().ids.map(String) : [];
  return ids.includes(uid) || a.exists;
}
async function requireAdmin(req) {
  const u = await caller(req);
  if (!(await isAdminUid(u.uid))) throw httpErr(403, "notadmin");
  return u;
}

// ── Mots de passe : mêmes réglages qu'avant (PBKDF2-SHA256, 100 000 tours) pour garder les anciens mots de passe ──
const pbkdf = (pw, saltHex) => new Promise((ok, ko) =>
  crypto.pbkdf2(Buffer.from(String(pw), "utf8"), Buffer.from(saltHex, "utf8"), 100000, 32, "sha256", (e, k) => e ? ko(e) : ok(k.toString("hex"))));
const randHex = n => crypto.randomBytes(n).toString("hex");
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y); };
const normName = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const cleanName = s => { s = String(s || "").trim().replace(/\s+/g, " ").slice(0, 24); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pwOk = p => typeof p === "string" && p.length >= 8 && p.length <= 128 && /\d/.test(p) && /[A-Za-z]/.test(p);
function genRecCode() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.randomBytes(16); const c = [...b].map(x => A[x % 32]); return [0, 4, 8, 12].map(i => c.slice(i, i + 4).join("")).join("-"); }

// ── Secrets serveur (Firestore secrets/drive, interdit aux visiteurs par les règles) ──
let _sec = null, _secT = 0;
async function secrets(fresh) {
  if (_sec && !fresh && Date.now() - _secT < 300000) return _sec;
  const ref = fs().doc("secrets/drive");
  let s = (await ref.get()).data() || {};
  if (!s.dataKey) {   // création atomique : deux serveurs ne doivent jamais choisir deux clés différentes
    await fs().runTransaction(async tx => { const d = (await tx.get(ref)).data() || {}; if (!d.dataKey) tx.set(ref, { dataKey: randHex(32) }, { merge: true }); });
    s = (await ref.get()).data() || {};
  }
  _sec = s; _secT = Date.now(); return s;
}

// ── Chiffrement AES-256-GCM des fichiers du Drive ──
async function seal(obj) {
  const key = Buffer.from((await secrets()).dataKey, "hex"), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return Buffer.concat([Buffer.from("ECO1"), iv, c.getAuthTag(), enc]);
}
async function open(buf) {
  if (buf.slice(0, 4).toString() !== "ECO1") throw httpErr(500, "badfile");
  const key = Buffer.from((await secrets()).dataKey, "hex");
  const d = crypto.createDecipheriv("aes-256-gcm", key, buf.slice(4, 16));
  d.setAuthTag(buf.slice(16, 32));
  return JSON.parse(Buffer.concat([d.update(buf.slice(32)), d.final()]).toString("utf8"));
}

// ── Google Drive (ton Drive perso, via OAuth « drive.file » : l'appli ne voit QUE les fichiers qu'elle a créés) ──
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER = "EcoLingo - donnees chiffrees";
let _tok = null, _tokExp = 0, _folder = null;
const fileIds = new Map();

async function accessToken() {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  const s = await secrets();
  if (!s.refreshToken) throw httpErr(503, "nodrive");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: s.refreshToken, grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!r.ok) { console.error("drive token", j); throw httpErr(503, "nodrive"); }
  _tok = j.access_token; _tokExp = Date.now() + (j.expires_in || 3600) * 1000; return _tok;
}
async function gd(path, opt = {}) {
  const r = await fetch("https://www.googleapis.com" + path, { ...opt, headers: { Authorization: "Bearer " + await accessToken(), ...(opt.headers || {}) } });
  if (!r.ok) { const t = await r.text(); console.error("drive", r.status, t.slice(0, 300)); throw httpErr(502, "drive"); }
  return r;
}
const q = s => "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
async function folderId() {
  if (_folder) return _folder;
  const s = await secrets();
  if (s.folderId) return (_folder = s.folderId);
  const r = await gd("/drive/v3/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }) });
  const mine = (await r.json()).id, ref = fs().doc("secrets/drive");
  const won = await fs().runTransaction(async tx => { const d = (await tx.get(ref)).data() || {}; if (d.folderId) return d.folderId; tx.set(ref, { folderId: mine }, { merge: true }); return mine; });
  if (won !== mine) await gd("/drive/v3/files/" + mine, { method: "DELETE" }).catch(() => {});   // un autre serveur l'a créé avant nous
  _sec = null; return (_folder = won);
}
const IDX = () => fs().doc("secrets/driveIndex");
const idxKey = name => name.replace(/\./g, "_");
async function findFile(name) {
  if (fileIds.has(name)) return fileIds.get(name);
  const ix = ((await IDX().get()).data() || {}).files || {};
  if (ix[idxKey(name)]) { fileIds.set(name, ix[idxKey(name)]); return ix[idxKey(name)]; }
  const f = await folderId();
  const r = await gd("/drive/v3/files?" + new URLSearchParams({ q: "name = " + q(name) + " and " + q(f) + " in parents and trashed = false", fields: "files(id)", pageSize: "1" }));
  const id = ((await r.json()).files || [])[0]?.id || null;
  if (id) { fileIds.set(name, id); await IDX().set({ files: { [idxKey(name)]: id } }, { merge: true }); }
  return id;
}
async function readFile(name) {
  const id = await findFile(name); if (!id) return null;
  const r = await gd("/drive/v3/files/" + id + "?alt=media").catch(e => { fileIds.delete(name); throw e; });
  return open(Buffer.from(await r.arrayBuffer()));
}
async function writeFile(name, obj) {
  const data = await seal(obj), id = await findFile(name);
  if (id) { await gd("/upload/drive/v3/files/" + id + "?uploadType=media", { method: "PATCH", headers: { "Content-Type": "application/octet-stream" }, body: data }); return; }
  const f = await folderId(), b = "eco" + randHex(8);
  const body = Buffer.concat([
    Buffer.from("--" + b + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify({ name, parents: [f] }) + "\r\n--" + b + "\r\nContent-Type: application/octet-stream\r\n\r\n"),
    data, Buffer.from("\r\n--" + b + "--")]);
  const r = await gd("/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body });
  const nid = (await r.json()).id; fileIds.set(name, nid);
  await IDX().set({ files: { [idxKey(name)]: nid } }, { merge: true });
}
async function deleteFile(name) {
  const id = await findFile(name); if (!id) return;
  await gd("/drive/v3/files/" + id, { method: "DELETE" }); fileIds.delete(name);
  await IDX().update(new admin.firestore.FieldPath("files", idxKey(name)), admin.firestore.FieldValue.delete()).catch(() => {});
}
async function listFiles(prefix) {
  const f = await folderId(), out = []; let pt = "";
  do {
    const r = await gd("/drive/v3/files?" + new URLSearchParams({ q: "name contains " + q(prefix) + " and " + q(f) + " in parents and trashed = false", fields: "nextPageToken,files(id,name)", pageSize: "200", ...(pt ? { pageToken: pt } : {}) }));
    const j = await r.json(); (j.files || []).forEach(x => { if (x.name.startsWith(prefix)) { out.push(x.name); fileIds.set(x.name, x.id); } }); pt = j.nextPageToken || "";
  } while (pt);
  const ix = ((await IDX().get()).data() || {}).files || {};
  Object.keys(ix).forEach(k => { const n = k.replace(/_enc$/, ".enc"); if (n.startsWith(prefix) && !out.includes(n)) { out.push(n); fileIds.set(n, ix[k]); } });
  const miss = {}; out.forEach(n => { if (!ix[idxKey(n)] && fileIds.get(n)) miss[idxKey(n)] = fileIds.get(n); });
  if (Object.keys(miss).length) await IDX().set({ files: miss }, { merge: true });
  return out;
}

// ── Comptes « prénom » (anciens comptes) : un fichier chiffré par compte ──
const acctFile = id => "compte_" + id + ".enc";
// Transition : tant qu'un compte n'est pas encore dans le Drive, on le lit dans l'ancienne collection Firestore
// (lisible seulement par le serveur une fois les règles publiées) ; dès qu'il est réécrit, il part dans le Drive.
const okId = id => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id);
async function getAcct(id) {
  if (!okId(id)) return null;
  try { const a = await readFile(acctFile(id)); if (a) return a; } catch (e) { if (e.code !== "nodrive") throw e; }
  const d = await fs().doc("accounts/" + id).get();
  return d.exists ? d.data() : null;
}
async function putAcct(id, a) {
  if (!okId(id)) throw httpErr(400, "id");
  try { await writeFile(acctFile(id), a); }
  catch (e) { if (e.code !== "nodrive") throw e; await fs().doc("accounts/" + id).set(a); return; }
  await fs().doc("accounts/" + id).delete().catch(() => {});
}
async function delAcct(id) {
  if (!okId(id)) return;
  try { await deleteFile(acctFile(id)); } catch (e) { if (e.code !== "nodrive") throw e; }
  await fs().doc("accounts/" + id).delete().catch(() => {});
}
async function listAcctIds() {
  const ids = new Set();
  try { (await listFiles("compte_")).forEach(n => ids.add(n.slice(7, -4))); } catch (e) { if (e.code !== "nodrive") throw e; }
  (await fs().collection("accounts").get()).docs.forEach(d => ids.add(d.id));
  return [...ids];
}
const devsOf = a => { const d = { ...(a.devices || {}) }; if (a.deviceId && !d[a.deviceId]) d[a.deviceId] = { brand: "Appareil", added: a.createdAt || 0, last: a.lastLogin || 0 }; return d; };
const publicAcct = (id, a) => ({ id, name: a.name, devices: devsOf(a), createdAt: a.createdAt || 0, lastLogin: a.lastLogin || 0, migratedTo: a.migratedTo || null, hasRec: !!a.recHash });

module.exports = { admin, fs, auth, httpErr, handler, caller, isAdminUid, requireAdmin, pbkdf, randHex, same, normName, cleanName, normCode, pwOk, genRecCode,
  secrets, seal, open, SCOPE, readFile, writeFile, deleteFile, listFiles, getAcct, putAcct, delAcct, listAcctIds, devsOf, publicAcct, acctFile };

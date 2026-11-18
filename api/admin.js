// Actions réservées aux admins. Le serveur vérifie lui-même que l'appelant est admin (config/admins ou admins/<uid>).
const crypto = require("crypto");
const L = require("./_lib");

const sign = (key, s) => crypto.createHmac("sha256", Buffer.from(key, "hex")).update(s).digest("hex");

async function allLegacy() {
  const ids = await L.listAcctIds();
  const rows = await Promise.all(ids.map(async id => { try { const a = await L.getAcct(id); return a ? L.publicAcct(id, a) : null; } catch (e) { return null; } }));
  return rows.filter(Boolean);
}

const actions = {
  async list() { return { accounts: await allLegacy() }; },

  async release(b) {
    const id = String(b.id || ""), a = await L.getAcct(id); if (!a) throw L.httpErr(404, "gone");
    a.devices = {}; a.deviceId = null; await L.putAcct(id, a); return { ok: true };
  },

  async rename(b) {
    const id = String(b.id || ""), nm = L.cleanName(b.name), db = L.fs();
    if (!id || !nm) throw L.httpErr(400, "name");
    let partial = false;
    const a = await L.getAcct(id);
    if (a) { a.name = nm; await L.putAcct(id, a); }
    else { try { await db.doc("profiles/" + id).update({ firstName: nm, updatedAt: Date.now() }); } catch (e) { partial = true; } }
    const nl = L.normName(nm);
    await Promise.all([
      db.doc("lingo/" + id).update({ name: nm }).catch(() => {}),
      db.doc("presence/" + id).update({ name: nm, nl }).catch(() => {}),
      db.collection("visitors").where("accountId", "==", id).get().then(s => Promise.all(s.docs.map(d => d.ref.update({ name: nm })))).catch(() => {})
    ]);
    return { ok: true, partial };
  },

  async setPw(b) {
    const id = String(b.id || ""), a = await L.getAcct(id);
    if (!a || a.migratedTo) throw L.httpErr(404, "gone");
    if (!L.pwOk(b.pw)) throw L.httpErr(400, "weak");
    a.salt = L.randHex(16); a.hash = await L.pbkdf(b.pw, a.salt); a.failCount = 0; a.lockUntil = 0;
    await L.putAcct(id, a); return { ok: true };
  },

  async delete(b, req, me) {
    const id = String(b.id || ""), db = L.fs();
    if (!id) throw L.httpErr(400, "id");
    const a = await L.getAcct(id).catch(() => null), ids = [id].concat(a && a.migratedTo ? [a.migratedTo] : []);
    for (const x of ids) {
      await Promise.all(["profiles", "progress", "lingo", "presence"].map(c => db.doc(c + "/" + x).delete().catch(() => {})));
      const s = await db.collection("visitors").where("accountId", "==", x).get().catch(() => null);
      if (s) await Promise.all(s.docs.map(d => d.ref.update({ name: null, accountId: null }).catch(() => {})));
      if (x !== me.uid) await L.auth().deleteUser(x).catch(() => {});
    }
    await L.delAcct(id);
    return { ok: true };
  },

  // Une seule fois : déplace les comptes de Firestore (lisibles par tous) vers le Drive chiffré, puis les efface de Firestore
  // Déplace tous les comptes restants de Firestore vers le Drive chiffré (putAcct les efface de Firestore après écriture)
  async migrate() {
    const db = L.fs(), snap = await db.collection("accounts").get();
    if (!(await L.secrets(true)).refreshToken) throw L.httpErr(503, "nodrive");
    let moved = 0;
    for (const d of snap.docs) { await L.putAcct(d.id, d.data() || {}); moved++; }
    await Promise.all(["config/admin", "config/pwreset"].map(p => db.doc(p).delete().catch(() => {})));
    return { moved, left: (await db.collection("accounts").get()).size };
  },

  async driveStatus() { const s = await L.secrets(true); return { connected: !!s.refreshToken, folder: !!s.folderId }; },

  async driveConnect(b, req) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw L.httpErr(500, "config");
    const s = await L.secrets(), ts = String(Date.now()), host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: "https://" + host + "/api/drive-callback", response_type: "code",
      scope: L.SCOPE, access_type: "offline", prompt: "consent", state: ts + "." + sign(s.dataKey, "drive:" + ts) });
    return { url };
  }
};

module.exports = L.handler(async (b, req) => {
  const me = await L.requireAdmin(req), fn = actions[b.action];
  if (!fn) throw L.httpErr(400, "action");
  return fn(b, req, me);
});
module.exports.sign = sign;

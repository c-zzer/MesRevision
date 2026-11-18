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

  // « Give inventaire » : seul un admin peut ajouter des Lingo ou des objets (vérifié par le serveur)
  async donner(b) {
    const J = require("./_jeu"), id = String(b.id || "").trim(), amount = Number(b.amount || 0), all = !!b.all, cat = String(b.cat || ""), item = String(b.item || "");
    if (!id || /[\/\\]/.test(id) || id[0] === "_") throw L.httpErr(400, "id");
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) throw L.httpErr(400, "amount");
    const db = L.fs(), ref = db.doc("lingo/" + id);
    let nm = ""; const a = await L.getAcct(id).catch(() => null); if (a) nm = a.name;
    if (!nm) { const p = await db.doc("profiles/" + id).get(); if (p.exists) nm = [p.data().firstName, p.data().lastName].filter(Boolean).join(" "); }
    const lg0 = await ref.get(); if (!nm && !lg0.exists) throw L.httpErr(404, "compte");
    await db.runTransaction(async tx => {
      const old = (await tx.get(ref)).data() || {}, shop = Object.assign({}, old.shop || {});
      let next = shop, bonus = amount; const own = k => Array.isArray(shop[k]) ? shop[k] : [];
      if (all) { next = J.grantAllShopItems(shop); bonus = Math.max(amount, 100000); }
      else if (cat === "b") { if (!J.SH_BETES.some(x => x.id === item)) throw L.httpErr(400, "item"); next.mo = J.grantAddUnique(own("mo"), item); if (!next.m) next.m = item; }
      else if (cat === "d") { if (!J.SH_DANCES.some(x => x.id === item)) throw L.httpErr(400, "item"); next.dn = J.grantAddUnique(own("dn"), item); if (!next.dc) next.dc = item; }
      else if (cat === "c") { if (!J.SH_COS.some(x => x.id === item)) throw L.httpErr(400, "item"); next.co = J.grantAddUnique(own("co"), item); }
      else if (cat === "a") { if (!J.SH_COLORS.some(x => x.id === item)) throw L.httpErr(400, "item"); next.own = J.grantAddUnique(own("own"), item); if (!next.av) next.av = item; }
      else if (cat === "p") { const perk = J.SH_PERKS.find(x => x.id === item); if (!perk) throw L.httpErr(400, "item");
        if (perk.kind === "perm") next.pm = J.grantAddUnique(own("pm"), item); else { next.pk = Object.assign({}, shop.pk || {}); next.pk[item] = Math.min(perk.max, (next.pk[item] || 0) + 1); } }
      else if (cat === "f") { next.freeze = Math.min(J.shFzMax(shop), (shop.freeze || 0) + 1); }
      else if (cat && cat !== "l") throw L.httpErr(400, "cat");
      tx.set(ref, { name: nm || old.name || id, total: (old.total || 0) + bonus, shop: next }, { merge: true });
    });
    return { ok: true };
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

// Comptes « prénom + mot de passe » : toute la vérification se fait ICI, sur le serveur.
// Les empreintes des mots de passe sont dans le Drive (chiffrées) et ne sont jamais envoyées au navigateur.
const L = require("./_lib");

const MAX_DEV = 5;
const wait = ms => new Promise(r => setTimeout(r, ms));
const lockMsg = a => ({ lockMin: Math.max(1, Math.ceil((a.lockUntil - Date.now()) / 60000)) });
const brandOf = b => String(b.brand || "Appareil").slice(0, 60);
const devOf = b => { const d = String(b.dev || ""); if (!/^[A-Za-z0-9_-]{6,80}$/.test(d)) throw L.httpErr(400, "dev"); return d; };
const token = id => L.auth().createCustomToken(id, { legacy: true });

async function recFields() { const code = L.genRecCode(), recSalt = L.randHex(16); return { code, f: { recSalt, recHash: await L.pbkdf(L.normCode(code), recSalt) } }; }
async function bumpFail(id, a) {
  const n = (a.failCount || 0) + 1;
  Object.assign(a, n >= 6 ? { failCount: 0, lockUntil: Date.now() + 600000 } : { failCount: n });
  try { await L.putAcct(id, a); } catch (e) {}
  await wait(600);
}
async function legacyCaller(req) {
  const u = await L.caller(req);
  if (!u.legacy) throw L.httpErr(403, "notlegacy");
  const a = await L.getAcct(u.uid);
  if (!a || a.migratedTo) throw L.httpErr(404, "gone");
  return { id: u.uid, a };
}

const actions = {
  async create(b) {
    const name = L.cleanName(b.name), id = L.normName(name), dev = devOf(b);
    if (name.length < 2 || !id || id.length > 40) throw L.httpErr(400, "name");
    if (!L.pwOk(b.pw)) throw L.httpErr(400, "weak");
    if (await L.getAcct(id)) throw L.httpErr(409, "taken");
    // un compte e-mail ne doit jamais avoir le même identifiant
    try { await L.auth().getUser(id); throw L.httpErr(409, "taken"); } catch (e) { if (e.status) throw e; }
    const salt = L.randHex(16), now = Date.now(), rc = await recFields();
    await L.putAcct(id, { name, salt, hash: await L.pbkdf(b.pw, salt), ...rc.f, devices: { [dev]: { brand: brandOf(b), added: now, last: now } }, createdAt: now, lastLogin: now });
    return { id, name, token: await token(id), recCode: rc.code };
  },

  async login(b) {
    const id = L.normName(L.cleanName(b.name)), dev = devOf(b);
    if (!id || !b.pw) throw L.httpErr(400, "missing");
    const a = await L.getAcct(id);
    if (a && a.lockUntil > Date.now()) throw Object.assign(L.httpErr(429, "locked"), { extra: lockMsg(a) });
    if (a && a.migratedTo) throw L.httpErr(409, "migrated");
    const good = a && a.salt && a.hash && L.same(await L.pbkdf(b.pw, a.salt), a.hash);
    if (!good) { if (a) await bumpFail(id, a); else await wait(600); throw L.httpErr(401, "bad"); }
    const devs = L.devsOf(a), now = Date.now();
    if (!devs[dev] && Object.keys(devs).length >= MAX_DEV) {
      if (!b.replace || !devs[b.replace]) throw Object.assign(L.httpErr(409, "devfull"), { extra: { devices: Object.entries(devs).map(([k, v]) => ({ id: k, brand: v.brand, last: v.last })) } });
      delete devs[b.replace];
    }
    devs[dev] = { brand: brandOf(b), added: (devs[dev] || {}).added || now, last: now };
    Object.assign(a, { devices: devs, deviceId: null, lastLogin: now, failCount: 0, lockUntil: 0 });
    let recCode = null;
    if (!a.recHash) { const r = await recFields(); Object.assign(a, r.f); recCode = r.code; }
    await L.putAcct(id, a);
    return { id, name: a.name, token: await token(id), recCode };
  },

  async recover(b) {
    const id = L.normName(L.cleanName(b.name)), code = L.normCode(b.code), dev = devOf(b);
    if (!id || code.length < 16) throw L.httpErr(400, "missing");
    if (!L.pwOk(b.pw)) throw L.httpErr(400, "weak");
    const a = await L.getAcct(id);
    if (a && a.lockUntil > Date.now()) throw Object.assign(L.httpErr(429, "locked"), { extra: lockMsg(a) });
    const good = a && !a.migratedTo && a.recSalt && a.recHash && L.same(await L.pbkdf(code, a.recSalt), a.recHash);
    if (!good) { if (a) await bumpFail(id, a); else await wait(600); throw L.httpErr(401, "bad"); }
    const salt = L.randHex(16), r = await recFields(), now = Date.now();
    Object.assign(a, { salt, hash: await L.pbkdf(b.pw, salt), ...r.f, devices: { [dev]: { brand: brandOf(b), added: now, last: now } }, deviceId: null, failCount: 0, lockUntil: 0, lastLogin: now });
    await L.putAcct(id, a);
    return { id, name: a.name, token: await token(id), recCode: r.code };
  },

  // Vérifie au démarrage que ce téléphone fait toujours partie du compte
  async session(b, req) {
    const { id, a } = await legacyCaller(req), dev = devOf(b), devs = L.devsOf(a), now = Date.now();
    let dirty = false, recCode = null;
    if (!devs[dev]) {
      if (Object.keys(devs).length) throw L.httpErr(403, "devremoved");
      devs[dev] = { brand: brandOf(b), added: now, last: now }; dirty = true;
    } else if (now - (devs[dev].last || 0) > 600000) { devs[dev].last = now; dirty = true; }
    if (!a.recHash) { const r = await recFields(); Object.assign(a, r.f); recCode = r.code; dirty = true; }
    if (dirty) { a.devices = devs; a.deviceId = null; await L.putAcct(id, a); }
    return { id, name: a.name, recCode };
  },

  async devices(b, req) { const { a } = await legacyCaller(req); return { devices: L.devsOf(a), max: MAX_DEV }; },

  async removeDevice(b, req) {
    const { id, a } = await legacyCaller(req), devs = L.devsOf(a);
    delete devs[String(b.id || "")]; a.devices = devs; a.deviceId = null;
    await L.putAcct(id, a); return { ok: true };
  },

  async checkPw(b, req) {
    const { id, a } = await legacyCaller(req);
    if (a.lockUntil > Date.now()) throw Object.assign(L.httpErr(429, "locked"), { extra: lockMsg(a) });
    const ok = !!(b.pw && L.same(await L.pbkdf(b.pw, a.salt), a.hash));
    if (!ok) await bumpFail(id, a);
    return { ok };
  },

  async regenRec(b, req) {
    const { id, a } = await legacyCaller(req);
    if (!(b.pw && L.same(await L.pbkdf(b.pw, a.salt), a.hash))) { await bumpFail(id, a); throw L.httpErr(401, "bad"); }
    const r = await recFields(); Object.assign(a, r.f); await L.putAcct(id, a);
    return { recCode: r.code };
  },

  // Passage d'un ancien compte (prénom) à un compte e-mail : copie de la progression et de l'inventaire
  async upgrade(b, req) {
    const u = await L.caller(req);
    if (u.legacy) throw L.httpErr(400, "notmail");
    let old; try { old = await L.auth().verifyIdToken(String(b.oldToken || "")); } catch (e) { throw L.httpErr(401, "oldtoken"); }
    if (!old.legacy) throw L.httpErr(400, "oldtoken");
    const oldId = old.uid, uid = u.uid, a = await L.getAcct(oldId);
    if (!a) throw L.httpErr(404, "gone");
    if (a.migratedTo) return { ok: a.migratedTo === uid };
    const db = L.fs(), ts = Date.now();
    const op = await db.doc("progress/" + oldId).get();
    if (op.exists) await db.doc("progress/" + uid).set({ ...op.data(), updatedAt: ts });
    const ol = await db.doc("lingo/" + oldId).get(), nl = await db.doc("lingo/" + uid).get();
    if (ol.exists) {
      const o = ol.data() || {}, n = nl.exists ? nl.data() || {} : null;
      if (!n) await db.doc("lingo/" + uid).set({ ...o, migFrom: oldId });
      else if (n.migFrom !== oldId) {
        const os = o.shop || {}, ns = n.shop || {}, p = {};
        ["mo", "co", "own", "dn", "pm"].forEach(k => { const x = Array.isArray(ns[k]) ? ns[k] : [], m = [...new Set([...x, ...(Array.isArray(os[k]) ? os[k] : [])])]; if (m.length !== x.length) p[k] = m; });
        ["m", "av", "dc"].forEach(k => { if (!ns[k] && os[k]) p[k] = os[k]; });
        if (!(ns.ce && ns.ce.length) && Array.isArray(os.ce)) p.ce = os.ce;
        if (os.ot && !ns.ot) p.ot = os.ot;
        await db.doc("lingo/" + uid).set({ migFrom: oldId, total: (n.total || 0) + (o.total || 0), shop: p }, { merge: true });
      }
    }
    Object.assign(a, { migratedTo: uid, hash: null, salt: null, recHash: null, recSalt: null, devices: {} });
    await L.putAcct(oldId, a);
    return { ok: true };
  }
};

module.exports = L.handler(async (b, req) => {
  const fn = actions[b.action];
  if (!fn) throw L.httpErr(400, "action");
  return fn(b, req);
});

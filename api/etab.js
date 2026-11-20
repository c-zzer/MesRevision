// Comptes d'établissement : SEUL un admin crée les comptes (élèves, profs, direction) à partir du tableau de l'établissement.
// Les visiteurs ne peuvent plus créer de compte eux-mêmes.
// Chaque compte = un utilisateur Firebase « prenom.nom@eleve.mes-revision.vercel.app » (adresse technique, aucun e-mail n'y est envoyé)
// + son profil (profiles/<uid>) + sa fiche d'établissement (membres/<uid>, lisible seulement par le serveur).
const crypto = require("crypto");
const L = require("./_lib");

const DOMAIN = "eleve.mes-revision.vercel.app";
const MAX_BATCH = 20;

// ── Ordre d'affichage : direction (par hiérarchie) → personnel → profs → élèves ──
const RANGS = [
  [/proviseur(?!.*adjoint)|principal(?!.*adjoint)|chef d.?(e|é)tablissement|directeur(?!.*adjoint)|directrice(?!.*adjointe)/i, 1],
  [/adjoint|adjointe/i, 2],
  [/gestionnaire|intendan|adjoint gestion/i, 3],
  [/cpe|conseill(er|ère) principal/i, 4],
  [/secr(e|é)tari/i, 5],
  [/documentaliste|cdi|professeur documentaliste/i, 6],
  [/infirmi|sant(e|é)/i, 7],
  [/psy|orientation/i, 8],
  [/aed|surveillant|assistant d.?(e|é)ducation|vie scolaire/i, 9],
  [/aesh/i, 10]
];
const rangOf = m => {
  if (m.role === "famille") return 1100;
  if (m.role === "eleve") return 1000;
  if (m.role === "prof") return 100;
  const f = String(m.fonction || "");
  for (const [re, n] of RANGS) if (re.test(f)) return n;
  return 50;
};
const ordre = (a, b) => (a.rang - b.rang) || String(a.classe || "").localeCompare(String(b.classe || ""), "fr", { numeric: true })
  || String(a.nom || "").localeCompare(String(b.nom || ""), "fr") || String(a.prenom || "").localeCompare(String(b.prenom || ""), "fr");

const slug = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const txt = (s, n) => String(s == null ? "" : s).trim().replace(/\s+/g, " ").slice(0, n || 60);
const cap = s => s.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

function niveauOf(classe, role) {
  if (role !== "eleve") return "multi";
  const c = slug(classe);
  if (/^6/.test(c)) return "6e"; if (/^5/.test(c)) return "5e"; if (/^4/.test(c)) return "4e"; if (/^3/.test(c)) return "3e";
  if (/^(2|sec)/.test(c)) return "2nde"; if (/^(1|prem)/.test(c)) return "1ere"; if (/^(t|term)/.test(c)) return "term";
  if (/^cm1/.test(c)) return "cm1"; if (/^cm2/.test(c)) return "cm2";
  return "autre";
}
function birthOf(v) {
  if (!v) return "1900-01-01";                                   // « non renseignée »
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return "1900-01-01";
}
// Mot de passe provisoire lisible (sans 0/O ni 1/l) : ex. « Kp7m-Rb3x »
function tmpPw() {
  const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", Lo = "abcdefghijkmnpqrstuvwxyz", D = "23456789", b = crypto.randomBytes(8);
  const part = i => U[b[i] % U.length] + Lo[b[i + 1] % Lo.length] + D[b[i + 2] % D.length] + Lo[b[i + 3] % Lo.length];
  return part(0) + "-" + part(4);
}
async function freeId(base) {
  for (let i = 1; i < 200; i++) {
    const id = i === 1 ? base : base + i;
    try { await L.auth().getUserByEmail(id + "@" + DOMAIN); } catch (e) { if (e.code === "auth/user-not-found") return id; throw e; }
  }
  throw L.httpErr(409, "id");
}
const pub = (uid, m) => ({ uid, role: m.role, fonction: m.fonction || "", prenom: m.prenom, nom: m.nom, classe: m.classe || "", matiere: m.matiere || "", identifiant: m.identifiant, rang: m.rang, pwChanged: !!m.pwChanged,
  enfants: m.enfants || undefined, famille: m.famille || undefined, secu: !!m.qh, gest: !!m.gest });

// ── Question secrète (comme École Directe : demandée quand on se connecte depuis un nouvel appareil) ──
const QUESTIONS = [
  "Quel est le prénom de ton premier animal ?",
  "Dans quelle ville es-tu né(e) ?",
  "Quel est le nom de ton école primaire ?",
  "Quel est ton plat préféré ?",
  "Quel est le prénom de ton meilleur ami d'enfance ?",
  "Quel est le deuxième prénom d'un de tes parents ?"
];
const normRep = s => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const MAX_DEV = 10, MAX_FAIL = 5, LOCK_MS = 15 * 60000;
function addDevice(m, dev, brand) {
  const d = Object.assign({}, m.devices || {}), now = Date.now();
  d[dev] = { brand: txt(brand, 60) || "Appareil", added: (d[dev] && d[dev].added) || now, last: now };
  const ks = Object.keys(d).sort((a, b) => (d[b].last || 0) - (d[a].last || 0));
  ks.slice(MAX_DEV).forEach(k => delete d[k]);
  return d;
}
const devOf = b => txt(b.dev, 80);

async function creer(etabId, m) {
  const prenom = cap(txt(m.prenom, 40)), nom = txt(m.nom, 60).toUpperCase(), role = ["eleve", "prof", "personnel"].includes(m.role) ? m.role : "";
  if (!prenom || !nom || !role) return { erreur: "Nom, prénom ou type manquant", prenom, nom };
  if (role === "prof" && !txt(m.matiere)) return { erreur: "Matière manquante", prenom, nom };
  const base = (slug(prenom).replace(/-/g, "") + "." + slug(nom).replace(/-/g, "")).slice(0, 40);
  if (base.length < 3) return { erreur: "Nom ou prénom invalide", prenom, nom };
  const id = await freeId(base), pw = tmpPw(), email = id + "@" + DOMAIN;
  const u = await L.auth().createUser({ email, password: pw, emailVerified: true, displayName: prenom + " " + nom });
  await L.auth().setCustomUserClaims(u.uid, { tmp: 1, etab: etabId });
  const now = Date.now(), db = L.fs();
  const membre = { etab: etabId, role, fonction: txt(m.fonction, 60), matiere: txt(m.matiere, 60), classe: txt(m.classe, 20), prenom, nom,
    identifiant: id, createdAt: now, pwChanged: false };
  membre.rang = rangOf(membre);
  await Promise.all([
    db.doc("membres/" + u.uid).set(membre),
    db.doc("profiles/" + u.uid).set({ firstName: prenom, lastName: nom, email, emailVerified: true, role: role === "eleve" ? "eleve" : "prof",
      level: niveauOf(membre.classe, role), birth: birthOf(m.naissance), newsletter: { optIn: false, at: now }, privacy: { at: now, by: "etablissement" },
      createdAt: now, updatedAt: now, schema: 1 })
  ]);
  return { ...pub(u.uid, membre), motdepasse: pw };
}

// Compte Famille (comme École Directe) : un compte pour les parents, relié à un ou plusieurs enfants
async function creerFamille(etabId, enfants) {
  const db = L.fs(), nom = enfants[0].nom, id = await freeId(("famille." + slug(nom).replace(/-/g, "")).slice(0, 40)), pw = tmpPw();
  const u = await L.auth().createUser({ email: id + "@" + DOMAIN, password: pw, emailVerified: true, displayName: "Famille " + nom });
  await L.auth().setCustomUserClaims(u.uid, { tmp: 1, etab: etabId, fam: 1 });
  const membre = { etab: etabId, role: "famille", prenom: "Famille", nom, enfants: enfants.map(e => e.uid), classe: "",
    identifiant: id, createdAt: Date.now(), pwChanged: false, rang: 1100 };
  await db.doc("membres/" + u.uid).set(membre);
  await Promise.all(enfants.map(e => db.doc("membres/" + e.uid).update({ famille: u.uid })));
  return { ...pub(u.uid, membre), motdepasse: pw, enfantsNoms: enfants.map(e => e.prenom + " " + e.nom + (e.classe ? " (" + e.classe + ")" : "")) };
}
async function effacer(uid) {
  const db = L.fs(), s = await db.doc("membres/" + uid).get(), m = s.exists ? s.data() : {};
  if (m.role === "eleve" && m.famille) {   // on retire l'enfant de son compte famille
    const fr = db.doc("membres/" + m.famille), f = await fr.get();
    if (f.exists) await fr.update({ enfants: (f.data().enfants || []).filter(x => x !== uid) });
  }
  if (m.role === "eleve") await db.collection("invitations").where("eleve", "==", uid).get().then(q => Promise.all(q.docs.map(d => d.ref.delete()))).catch(() => {});
  if (m.role === "famille") await Promise.all((m.enfants || []).map(e => db.doc("membres/" + e).update({ famille: L.admin.firestore.FieldValue.delete() }).catch(() => {})));
  await Promise.all(["membres", "profiles", "progress", "lingo", "presence"].map(c => db.doc(c + "/" + uid).delete().catch(() => {})));
  await L.auth().deleteUser(uid).catch(() => {});
  L.devForget(uid);
}
async function nouveauxCodes(uids, etabOnly) {
  const db = L.fs(), out = [];
  for (const uid of uids) {
    const ref = db.doc("membres/" + uid), s = await ref.get(); if (!s.exists) continue;
    const pw = tmpPw(), m = s.data();
    if (etabOnly && (m.etab !== etabOnly || !["eleve", "famille"].includes(m.role))) continue;
    await L.auth().updateUser(uid, { password: pw });
    await L.auth().revokeRefreshTokens(uid).catch(() => {});
    await L.auth().setCustomUserClaims(uid, m.role === "famille" ? { tmp: 1, etab: m.etab, fam: 1 } : { tmp: 1, etab: m.etab });
    // mot de passe oublié → tout est remis à zéro : nouvelle question secrète à la prochaine connexion
    const FV = L.admin.firestore.FieldValue;
    await ref.update({ pwChanged: false, qh: FV.delete(), qs: FV.delete(), q: FV.delete(), devices: FV.delete(), qFail: FV.delete() });
    L.devForget(uid);
    out.push({ ...pub(uid, { ...m, pwChanged: false, qh: null }), motdepasse: pw });
  }
  return out;
}

// ── Suivi d'un élève (progression) : pour sa famille, le personnel de son établissement et les admins ──
let _J = null; const J = () => _J || (_J = require("./_jeu"));
const DAY = 864e5;
function resume(p, g) {
  p = p || {}; g = g || {};
  const sc = p.scores || {}; let quiz = 0, sum = 0, n = 0, last7 = 0, t7 = Date.now() - 7 * DAY;
  for (const k in sc) for (const a of (Array.isArray(sc[k]) ? sc[k] : [])) { quiz++; if (a.t > t7) last7++; }
  for (const k in sc) { const a = Array.isArray(sc[k]) && sc[k].length ? sc[k][sc[k].length - 1] : null; if (a && a.n) { sum += a.p; n++; } }
  let serie = 0, record = 0; try { const q = { d: (g.dq || {}).d || {}, best: (g.dq || {}).best || 0 }; serie = J().DQ.streakOf(q); record = Math.max(q.best, J().DQ.longest(q)); } catch (e) {}
  let rang = "Non classé"; try { rang = J().RK.label(J().RK.norm(g.rk)); } catch (e) {}
  return { quiz, quiz7: last7, moyenne: n ? Math.round(sum / n) : null, fiches: Object.keys(sc).length, serie, record, lingo: Math.round(g.total || 0), rang, actif: p.updatedAt || null };
}
async function suivi(uid) {
  const db = L.fs(), [m, p, g] = await Promise.all(["membres", "progress", "lingo"].map(c => db.doc(c + "/" + uid).get()));
  if (!m.exists) throw L.httpErr(404, "membre");
  const pd = p.exists ? p.data() : {}, sc = pd.scores || {}, mat = {}, recents = [];
  for (const k in sc) {
    const i = k.indexOf(":"), sid = i < 0 ? k : k.slice(0, i), fid = i < 0 ? "" : k.slice(i + 1), arr = Array.isArray(sc[k]) ? sc[k] : [];
    if (!arr.length) continue;
    const x = mat[sid] = mat[sid] || { sid, quiz: 0, sum: 0, n: 0 };
    x.quiz += arr.length; x.sum += arr[arr.length - 1].p || 0; x.n++;
    arr.forEach(a => recents.push({ sid, fid, p: a.p, s: a.s, n: a.n, t: a.t }));
  }
  recents.sort((a, b) => (b.t || 0) - (a.t || 0));
  const jours = {}; recents.forEach(a => { const d = new Date(a.t || 0).toISOString().slice(0, 10); jours[d] = (jours[d] || 0) + 1; });
  const md = m.data();
  return { eleve: pub(uid, md), resume: resume(pd, g.exists ? g.data() : {}),
    matieres: Object.values(mat).map(x => ({ sid: x.sid, quiz: x.quiz, moyenne: Math.round(x.sum / x.n), fiches: x.n })).sort((a, b) => b.quiz - a.quiz),
    recents: recents.slice(0, 15), jours };
}
async function lireMembre(uid) { const s = await L.fs().doc("membres/" + uid).get(); if (!s.exists) throw L.httpErr(403, "pasmembre"); return s.data(); }
const estPersonnel = m => m.role === "personnel" || m.role === "prof";

// ── Code « parents » (comme l'activation du compte famille sur École Directe / ÉduConnect) ──
// L'élève génère un code ; ses parents créent eux-mêmes leur compte Famille avec ce code.
const INV = h => L.fs().doc("invitations/" + h), INV_DAYS = 14;
const invHash = c => crypto.createHash("sha256").update(String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
function invCode() { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = crypto.randomBytes(8); let s = ""; for (let i = 0; i < 8; i++) s += A[b[i] % A.length]; return s.slice(0, 4) + "-" + s.slice(4); }
async function lireInvitation(code) {
  const ref = INV(invHash(code)), s = await ref.get();
  if (!s.exists || s.data().exp < Date.now()) throw L.httpErr(404, "code");
  return { ref, inv: s.data() };
}
const _essais = new Map();   // limite les essais de codes par adresse IP
function limiteIp(req) {
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || "")) || "").split(",")[0].trim() || "?", now = Date.now(), e = _essais.get(ip) || { n: 0, t: now };
  if (now - e.t > 15 * 60000) { e.n = 0; e.t = now; }
  if (++e.n > 20) throw L.httpErr(429, "locked");
  if (_essais.size > 5000) _essais.clear(); _essais.set(ip, e);
}
const publicActions = {
  // Étape 1 : le code est-il bon ? (affiche le prénom de l'enfant et l'établissement)
  async verifierCode(b, req) {
    limiteIp(req);
    const { inv } = await lireInvitation(b.code), e = await lireMembre(inv.eleve).catch(() => null);
    if (!e) throw L.httpErr(404, "code");
    const et = await L.fs().doc("etabs/" + e.etab).get();
    let deja = null; if (e.famille) { const f = await lireMembre(e.famille).catch(() => null); if (f && f.pwChanged) deja = f.identifiant; }
    return { enfant: e.prenom + " " + e.nom, classe: e.classe || "", etab: et.exists ? et.data().nom : "", deja };
  },
  // Étape 2 : création (ou activation) du compte Famille par les parents eux-mêmes
  async activerFamille(b, req) {
    limiteIp(req);
    const { ref, inv } = await lireInvitation(b.code), db = L.fs();
    if (!L.pwOk(b.pw)) throw L.httpErr(400, "weak");
    const q = Number(b.q), r = normRep(b.r);
    if (!(q >= 0 && q < QUESTIONS.length) || r.length < 2) throw L.httpErr(400, "question");
    const e = await lireMembre(inv.eleve);
    const qs = L.randHex(16), secu = { q, qs, qh: await L.pbkdf(r, qs), pwChanged: true };
    let uid, membre;
    if (e.famille) {
      const f = await lireMembre(e.famille).catch(() => null);
      if (f && f.pwChanged) throw Object.assign(L.httpErr(409, "famille"), { extra: { identifiant: f.identifiant } });
      if (f) { uid = e.famille; membre = f; await L.auth().updateUser(uid, { password: b.pw }); }
    }
    if (!uid) {
      const id = await freeId(("famille." + slug(e.nom).replace(/-/g, "")).slice(0, 40));
      const u = await L.auth().createUser({ email: id + "@" + DOMAIN, password: b.pw, emailVerified: true, displayName: "Famille " + e.nom });
      uid = u.uid; membre = { etab: e.etab, role: "famille", prenom: "Famille", nom: e.nom, enfants: [inv.eleve], classe: "", identifiant: id, createdAt: Date.now(), rang: 1100, parLesParents: true };
      await db.doc("membres/" + inv.eleve).update({ famille: uid });
    }
    await L.auth().setCustomUserClaims(uid, { etab: e.etab, fam: 1 });
    await db.doc("membres/" + uid).set({ ...membre, ...secu, devices: addDevice({}, devOf(b) || "inconnu", b.brand), qFail: L.admin.firestore.FieldValue.delete() }, { merge: true });
    await ref.delete();
    L.devForget(uid);
    return { identifiant: membre.identifiant };
  }
};

// ── Actions des comptes d'établissement eux-mêmes (pas besoin d'être admin) ──
const moiActions = {
  // Qui suis-je ? + l'établissement + cet appareil est-il reconnu ?
  async moi(b, u, m) {
    const e = await L.fs().doc("etabs/" + m.etab).get(), dev = devOf(b);
    const etat = !m.qh ? "config" : dev && m.devices && m.devices[dev] ? "ok" : "nouveau";
    if (etat === "ok" && Date.now() - (m.devices[dev].last || 0) > 6 * 3600e3) await L.fs().doc("membres/" + u.uid).update({ devices: addDevice(m, dev, b.brand) }).catch(() => {});
    return { moi: pub(u.uid, m), etab: e.exists ? { id: e.id, nom: e.data().nom, type: e.data().type || "", ville: e.data().ville || "" } : { id: m.etab, nom: "Mon établissement" },
      appareil: etat, question: m.qh && etat === "nouveau" ? QUESTIONS[m.q] || "" : undefined, questions: m.qh ? undefined : QUESTIONS };
  },
  // 1re connexion : choix de la question secrète (cet appareil devient reconnu)
  async securite(b, u, m) {
    const q = Number(b.q), r = normRep(b.r);
    if (!(q >= 0 && q < QUESTIONS.length)) throw L.httpErr(400, "question");
    if (r.length < 2) throw L.httpErr(400, "reponse");
    if (m.qh && !b.pw) throw L.httpErr(409, "deja");
    const qs = L.randHex(16);
    await L.fs().doc("membres/" + u.uid).update({ q, qs, qh: await L.pbkdf(r, qs), devices: addDevice(m, devOf(b) || "inconnu", b.brand), qFail: L.admin.firestore.FieldValue.delete() });
    L.devForget(u.uid);
    return { ok: true };
  },
  // Nouvel appareil : réponse à la question secrète
  async confirmer(b, u, m) {
    const dev = devOf(b); if (!dev) throw L.httpErr(400, "dev");
    if (!m.qh) return { ok: true };
    const f = m.qFail || { n: 0, t: 0 }, now = Date.now();
    if (f.n >= MAX_FAIL && now - f.t < LOCK_MS) throw Object.assign(L.httpErr(429, "locked"), { extra: { min: Math.ceil((LOCK_MS - (now - f.t)) / 60000) } });
    const ok = L.same(await L.pbkdf(normRep(b.r), m.qs), m.qh), ref = L.fs().doc("membres/" + u.uid);
    if (!ok) {
      const n = (now - f.t < LOCK_MS ? f.n : 0) + 1; await ref.update({ qFail: { n, t: now } });
      throw Object.assign(L.httpErr(403, "faux"), { extra: { reste: Math.max(0, MAX_FAIL - n) } });
    }
    await ref.update({ devices: addDevice(m, dev, b.brand), qFail: L.admin.firestore.FieldValue.delete() });
    L.devForget(u.uid);
    return { ok: true };
  },
  // Élève : code pour que ses parents créent leur compte Famille
  async inviterParents(b, u, m) {
    if (m.role !== "eleve") throw L.httpErr(403, "eleve");
    if (m.famille) { const f = await lireMembre(m.famille).catch(() => null); if (f && f.pwChanged) return { deja: f.identifiant }; }
    const db = L.fs(), old = await db.collection("invitations").where("eleve", "==", u.uid).get();
    await Promise.all(old.docs.map(d => d.ref.delete()));
    const code = invCode(), exp = Date.now() + INV_DAYS * 864e5;
    await INV(invHash(code)).set({ eleve: u.uid, etab: m.etab, exp, createdAt: Date.now() });
    return { code, exp };
  },
  // Famille : ajouter un frère / une sœur avec son code parents
  async ajouterEnfant(b, u, m) {
    if (m.role !== "famille") throw L.httpErr(403, "famille");
    const { ref, inv } = await lireInvitation(b.code), db = L.fs(), e = await lireMembre(inv.eleve);
    if (e.etab !== m.etab) throw L.httpErr(400, "etab");
    if (e.famille && e.famille !== u.uid) {
      const f = await lireMembre(e.famille).catch(() => null);
      if (f && f.pwChanged) throw L.httpErr(409, "famille");
      if (f) await effacer(e.famille);
    }
    await Promise.all([db.doc("membres/" + u.uid).update({ enfants: [...new Set([...(m.enfants || []), inv.eleve])] }), db.doc("membres/" + inv.eleve).update({ famille: u.uid }), ref.delete()]);
    return { enfant: e.prenom + " " + e.nom };
  },
  // Mes appareils reconnus
  async appareils(b, u, m) { return { appareils: Object.entries(m.devices || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => (b.last || 0) - (a.last || 0)) }; },
  async oublierAppareil(b, u, m) {
    const d = Object.assign({}, m.devices || {}); delete d[txt(b.id, 80)];
    await L.fs().doc("membres/" + u.uid).update({ devices: d }); L.devForget(u.uid); return { ok: true };
  },
  // Espace famille : les enfants du compte
  async enfants(b, u, m) {
    if (m.role !== "famille") throw L.httpErr(403, "famille");
    return { enfants: await Promise.all((m.enfants || []).map(id => suivi(id).catch(() => null))).then(a => a.filter(Boolean)) };
  },
  // Espace établissement : tous les élèves de l'établissement (personnel et profs)
  async eleves(b, u, m) {
    if (!estPersonnel(m)) throw L.httpErr(403, "personnel");
    const db = L.fs(), s = await db.collection("membres").where("etab", "==", m.etab).get();
    const el = s.docs.filter(d => d.data().role === "eleve"), out = [];
    for (let i = 0; i < el.length; i += 100) {
      const part = el.slice(i, i + 100), refs = c => part.map(d => db.doc(c + "/" + d.id));
      const [ps, gs] = await Promise.all([db.getAll(...refs("progress"), { fieldMask: ["scores", "updatedAt"] }), db.getAll(...refs("lingo"), { fieldMask: ["total", "dq", "rk"] })]);
      part.forEach((d, j) => out.push({ ...pub(d.id, d.data()), resume: resume(ps[j].exists ? ps[j].data() : {}, gs[j].exists ? gs[j].data() : {}) }));
    }
    return { eleves: out.sort(ordre), peutCodes: m.role === "personnel" };
  },
  async suivi(b, u, m) {
    const id = String(b.uid || ""), cible = await lireMembre(id).catch(() => null);
    if (!cible || cible.role !== "eleve") throw L.httpErr(404, "membre");
    const okFam = m.role === "famille" && (m.enfants || []).includes(id), okPers = estPersonnel(m) && cible.etab === m.etab;
    if (!okFam && !okPers) throw L.httpErr(403, "acces");
    return suivi(id);
  },
  // Vie scolaire / direction : nouveau mot de passe provisoire pour un élève ou son compte famille (mot de passe oublié)
  async codesEleve(b, u, m) {
    if (m.role !== "personnel") throw L.httpErr(403, "personnel");
    const id = String(b.uid || ""), cible = await lireMembre(id).catch(() => null);
    if (!cible || cible.etab !== m.etab) throw L.httpErr(404, "membre");
    const uids = [id]; if (b.famille && cible.famille) uids.push(cible.famille);
    return { resultats: await nouveauxCodes(uids, m.etab) };
  }
};

const actions = {
  async list() {
    const db = L.fs(), [e, m] = await Promise.all([db.collection("etabs").get(), db.collection("membres").select("etab", "role", "gest", "prenom", "nom").get()]);
    const n = {}, g = {};
    m.docs.forEach(d => { const x = d.data(), k = x.etab; n[k] = n[k] || { eleve: 0, prof: 0, personnel: 0, famille: 0 }; n[k][x.role] = (n[k][x.role] || 0) + 1; if (x.gest) (g[k] = g[k] || []).push(x.prenom + " " + x.nom); });
    return { etabs: e.docs.map(d => ({ id: d.id, ...d.data(), compte: n[d.id] || { eleve: 0, prof: 0, personnel: 0, famille: 0 }, gestion: g[d.id] || [] })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) };
  },

  async creerEtab(b) {
    const nom = txt(b.nom, 80); if (nom.length < 2) throw L.httpErr(400, "nom");
    const id = (slug(nom).slice(0, 40) || "etab") + "-" + crypto.randomBytes(3).toString("hex");
    await L.fs().doc("etabs/" + id).set({ nom, type: txt(b.type, 30), ville: txt(b.ville, 60), annee: txt(b.annee, 20), createdAt: Date.now() });
    return { id };
  },

  // Création des comptes par paquets (le site envoie la liste en plusieurs fois)
  async importer(b) {
    const etabId = String(b.etab || ""), db = L.fs();
    if (!etabId || !(await db.doc("etabs/" + etabId).get()).exists) throw L.httpErr(404, "etab");
    const liste = Array.isArray(b.membres) ? b.membres.slice(0, MAX_BATCH) : [];
    // déjà présents (même prénom + nom + type dans cet établissement) → on ne les recrée pas
    const deja = new Set((await db.collection("membres").where("etab", "==", etabId).get()).docs
      .map(d => { const x = d.data(); return [x.role, slug(x.prenom), slug(x.nom)].join("|"); }));
    const out = [];
    for (let i = 0; i < liste.length; i += 5) {
      out.push(...await Promise.all(liste.slice(i, i + 5).map(async m => {
        const k = [m.role, slug(m.prenom), slug(m.nom)].join("|");
        if (deja.has(k)) return { existe: true, prenom: txt(m.prenom), nom: txt(m.nom) };
        deja.add(k);
        try { return await creer(etabId, m); } catch (e) { console.error("etab creer", e); return { erreur: "Erreur serveur", prenom: txt(m.prenom), nom: txt(m.nom) }; }
      })));
    }
    return { resultats: out };
  },

  async membres(b) {
    const etabId = String(b.etab || ""), s = await L.fs().collection("membres").where("etab", "==", etabId).get();
    return { membres: s.docs.map(d => pub(d.id, d.data())).sort(ordre) };
  },

  async nouveauMdp(b) {
    const uids = (Array.isArray(b.uids) ? b.uids : [b.uid]).map(String).filter(Boolean).slice(0, MAX_BATCH);
    return { resultats: await nouveauxCodes(uids) };
  },

  // Comptes Famille : un par élève qui n'en a pas encore (b.uids = seulement ces élèves)
  async creerFamilles(b) {
    const etabId = String(b.etab || ""), db = L.fs(), want = Array.isArray(b.uids) ? new Set(b.uids.map(String)) : null;
    const s = await db.collection("membres").where("etab", "==", etabId).get();
    const el = s.docs.filter(d => { const x = d.data(); return x.role === "eleve" && !x.famille && (!want || want.has(d.id)); }).map(d => ({ uid: d.id, ...d.data() })).sort(ordre).slice(0, MAX_BATCH);
    const out = [];
    for (const e of el) { try { out.push(await creerFamille(etabId, [e])); } catch (x) { console.error("famille", x); out.push({ erreur: "Erreur serveur", prenom: e.prenom, nom: e.nom }); } }
    const reste = s.docs.filter(d => { const x = d.data(); return x.role === "eleve" && !x.famille && (!want || want.has(d.id)); }).length - el.length;
    return { resultats: out, reste: Math.max(0, reste) };
  },
  // Relier un frère / une sœur au même compte Famille
  async lierEnfant(b) {
    const db = L.fs(), famId = String(b.famille || ""), elId = String(b.eleve || "");
    const [f, e] = await Promise.all([lireMembre(famId), lireMembre(elId)]);
    if (f.role !== "famille" || e.role !== "eleve" || f.etab !== e.etab) throw L.httpErr(400, "lien");
    if (e.famille && e.famille !== famId) {   // ancien compte famille de l'enfant : retiré, et supprimé s'il n'a plus d'enfant
      const old = await lireMembre(e.famille).catch(() => null);
      if (old) { const reste = (old.enfants || []).filter(x => x !== elId); if (reste.length) await db.doc("membres/" + e.famille).update({ enfants: reste }); else { await db.doc("membres/" + elId).update({ famille: L.admin.firestore.FieldValue.delete() }); await effacer(e.famille); } }
    }
    await Promise.all([db.doc("membres/" + famId).update({ enfants: [...new Set([...(f.enfants || []), elId])] }), db.doc("membres/" + elId).update({ famille: famId })]);
    return { ok: true };
  },
  async suivi(b) { return suivi(String(b.uid || "")); },
  // Administrateur de l'établissement (direction / secrétariat) : gère lui-même les comptes de son établissement
  async setGest(b) {
    const uid = String(b.uid || ""), m = await lireMembre(uid);
    if (!["personnel", "prof"].includes(m.role)) throw L.httpErr(400, "role");
    await L.fs().doc("membres/" + uid).update({ gest: !!b.on });
    return { ok: true };
  },

  async supprimerMembre(b) {
    const uid = String(b.uid || "");
    if (!(await L.fs().doc("membres/" + uid).get()).exists) throw L.httpErr(404, "membre");
    await effacer(uid);
    return { ok: true };
  },

  // Supprime l'établissement et TOUS ses comptes (par paquets : le site rappelle tant que « reste » > 0)
  async supprimerEtab(b) {
    const etabId = String(b.etab || ""), db = L.fs();
    const s = await db.collection("membres").where("etab", "==", etabId).limit(MAX_BATCH).get();
    for (const d of s.docs) {
      await Promise.all(["membres", "profiles", "progress", "lingo", "presence"].map(c => db.doc(c + "/" + d.id).delete().catch(() => {})));
      await L.auth().deleteUser(d.id).catch(() => {});
    }
    const reste = (await db.collection("membres").where("etab", "==", etabId).limit(1).get()).size;
    if (!reste) await db.doc("etabs/" + etabId).delete();
    return { reste };
  }
};

// ── Administrateur d'établissement : mêmes outils que l'admin, mais SEULEMENT pour son établissement ──
const GEST = ["membres", "importer", "nouveauMdp", "supprimerMembre", "creerFamilles", "lierEnfant", "suivi"];
async function gestion(b, u, req) {
  const m = await lireMembre(u.uid);
  if (!m.gest || !GEST.includes(b.action)) throw L.httpErr(403, "notadmin");
  await L.devGate(u, req);
  b.etab = m.etab;
  const mien = async uid => { const x = await lireMembre(String(uid)).catch(() => null); return x && x.etab === m.etab ? x : null; };
  if (b.action === "nouveauMdp") {
    const ok = [];
    for (const id of (Array.isArray(b.uids) ? b.uids : [b.uid]).map(String).slice(0, MAX_BATCH)) { const x = await mien(id); if (x && id !== u.uid && !x.gest) ok.push(id); }
    b.uids = ok;
  }
  if (b.action === "supprimerMembre") { const x = await mien(b.uid); if (!x || b.uid === u.uid || x.gest) throw L.httpErr(403, "acces"); }
  if (b.action === "lierEnfant" && (!(await mien(b.famille)) || !(await mien(b.eleve)))) throw L.httpErr(403, "acces");
  if (b.action === "suivi" && !(await mien(b.uid))) throw L.httpErr(403, "acces");
  return actions[b.action](b, req);
}

module.exports = L.handler(async (b, req) => {
  if (moiActions[b.action] && !b.adminEtab) {
    const u = await L.caller(req);
    const m = await lireMembre(u.uid);
    if (!["moi", "securite", "confirmer"].includes(b.action)) await L.devGate(u, req);
    if (b.action === "securite" && m.qh) throw L.httpErr(409, "deja");
    return moiActions[b.action](b, u, m);
  }
  if (publicActions[b.action]) return publicActions[b.action](b, req);
  const u = await L.caller(req);
  if (!(await L.isAdminUid(u.uid))) return gestion(b, u, req);
  const fn = actions[b.action];
  if (!fn) throw L.httpErr(400, "action");
  return fn(b, req);
});
module.exports.DOMAIN = DOMAIN;

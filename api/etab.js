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
const pub = (uid, m) => ({ uid, role: m.role, fonction: m.fonction || "", prenom: m.prenom, nom: m.nom, classe: m.classe || "", matiere: m.matiere || "", identifiant: m.identifiant, rang: m.rang, pwChanged: !!m.pwChanged });

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

const actions = {
  async list() {
    const db = L.fs(), [e, m] = await Promise.all([db.collection("etabs").get(), db.collection("membres").select("etab", "role").get()]);
    const n = {}; m.docs.forEach(d => { const x = d.data(), k = x.etab; n[k] = n[k] || { eleve: 0, prof: 0, personnel: 0 }; n[k][x.role] = (n[k][x.role] || 0) + 1; });
    return { etabs: e.docs.map(d => ({ id: d.id, ...d.data(), compte: n[d.id] || { eleve: 0, prof: 0, personnel: 0 } })).sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr")) };
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
    const uids = (Array.isArray(b.uids) ? b.uids : [b.uid]).map(String).filter(Boolean).slice(0, MAX_BATCH), db = L.fs(), out = [];
    for (const uid of uids) {
      const ref = db.doc("membres/" + uid), s = await ref.get(); if (!s.exists) continue;
      const pw = tmpPw(), m = s.data();
      await L.auth().updateUser(uid, { password: pw });
      await L.auth().setCustomUserClaims(uid, { tmp: 1, etab: m.etab });
      await ref.update({ pwChanged: false });
      out.push({ ...pub(uid, { ...m, pwChanged: false }), motdepasse: pw });
    }
    return { resultats: out };
  },

  async supprimerMembre(b) {
    const uid = String(b.uid || ""), db = L.fs();
    if (!(await db.doc("membres/" + uid).get()).exists) throw L.httpErr(404, "membre");
    await Promise.all(["membres", "profiles", "progress", "lingo", "presence"].map(c => db.doc(c + "/" + uid).delete().catch(() => {})));
    await L.auth().deleteUser(uid).catch(() => {});
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

module.exports = L.handler(async (b, req) => {
  await L.requireAdmin(req);
  const fn = actions[b.action];
  if (!fn) throw L.httpErr(400, "action");
  return fn(b, req);
});
module.exports.DOMAIN = DOMAIN;

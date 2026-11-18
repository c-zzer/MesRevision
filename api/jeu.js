// ANTI-TRICHE : tout ce qui rapporte des Lingo, du rang ou des objets est décidé ICI, sur le serveur.
// - Les réponses ne quittent jamais le serveur avant que l'élève ait répondu (une question à la fois, chronométrée par le serveur).
// - Le serveur corrige, calcule les Lingo, le rang (solo et 1 contre 1), le quiz du jour et gère toute la boutique.
// - Les élèves ne peuvent plus écrire dans « lingo/… » ni dans « duels/… » (règles Firestore).
const crypto = require("crypto");
const L = require("./_lib");
const J = require("./_jeu");
const { RK, RKS, LG, DQ, DQ_N } = J;

const FV = () => L.admin.firestore.FieldValue;
const SES = id => L.fs().doc("jeu_sessions/" + id);
const LGO = uid => L.fs().doc("lingo/" + uid);
const DUEL = id => L.fs().doc("duels/" + id);
const now = () => Date.now();
const rid = () => crypto.randomBytes(12).toString("hex");
const TIMER = 20, GRACE = 2500, GONE = 120000, PEND_OLD = 600000;

// ── Nom affiché : jamais celui envoyé par le téléphone ──
const _names = new Map();
async function nameOf(uid) {
  if (_names.has(uid)) return _names.get(uid);
  let n = "";
  try { const a = await L.getAcct(uid); if (a && a.name) n = a.name; } catch (e) {}
  if (!n) { const p = await L.fs().doc("profiles/" + uid).get().catch(() => null); if (p && p.exists) n = L.cleanName(p.data().firstName || ""); }
  if (!n) { const l = await LGO(uid).get().catch(() => null); n = (l && l.exists && l.data().name) || "Joueur"; }
  _names.set(uid, n); return n;
}

// ── Questions : tirées côté serveur, options mélangées, bonne réponse gardée ici ──
function shuffledQ(q) {   // q = { q, options, correct: 0, explain }
  const ord = J.shuffleArray(q.options.map((_, i) => i));
  return { q: q.q, o: ord.map(i => q.options[i]), c: ord.indexOf(q.correct), e: q.explain || "" };
}
const tierOf = r => RK.norm(r).ok ? RK.norm(r).t : 1;

// Gain d'entraînement (plafonné par jour, compté sur le serveur)
function trGain(d, score, total) {
  if (!(score > 0)) return { g: 0 };
  const today = DQ.today(), tr = d.trd && d.trd.d === today ? d.trd : { d: today, n: 0 };
  const g = Math.max(0, Math.min(score * LG.trOk + (score === total && total >= 3 ? LG.trPerfect : 0), LG.trDay - (tr.n || 0)));
  return { g, trd: { d: today, n: (tr.n || 0) + g } };
}
// Contre le même adversaire : de moins en moins de MMR dans la journée
function repOf(d, opp) {
  const today = DQ.today(), vs = d.vs && d.vs.d === today ? { d: today, n: Object.assign({}, d.vs.n) } : { d: today, n: {} };
  const n = vs.n[opp] = (vs.n[opp] || 0) + 1;
  return { rep: n <= 3 ? 1 : n <= 6 ? .5 : .25, vs };
}

// Rang solo (copie de rkApplySolo du site, mais exécutée par le serveur)
function soloApply(tx, ref, d, name, o, extraGain) {
  const cur = RK.norm(d.rks), p = o.total ? o.score / o.total * 100 : 0, thr = J.rkSoloGoal(cur.t), inc = FV().increment;
  const x = RK.duel(cur, { won: !o.forfeit && p >= thr, draw: !o.forfeit && p < thr && p >= thr - RKS.draw, forfeit: !!o.forfeit, my: 50 + (p - thr) / 2, opp: 50 - (p - thr) / 2, oppMmr: cur.mmr });
  const gain = (extraGain || 0) + (x.reward > 0 ? x.reward : 0);
  const up = { name, t: now(), rks: x.r, rps: RK.rp(x.r), soloPend: FV().delete() };
  if (gain > 0) { up.total = inc(gain); up.solo = inc(gain); }
  tx.set(ref, up, { merge: true });
  x.gain = x.reward; x.thr = thr; x.pct = Math.round(p); return x;
}
// Rang 1 contre 1 (copie de rkApply)
function duelApply(tx, ref, d, name, o) {
  const inc = FV().increment, x = RK.duel(d.rk, o), rk = Object.assign({}, x.r, { pend: null }), gain = (o.lingo || 0) + x.reward;
  const up = { name, t: now(), rk, rp: RK.rp(x.r), duels: inc(1) };
  if (o.won) up.wins = inc(1); if (gain > 0) { up.total = inc(gain); up.duel = inc(gain); }
  if (o.vs) up.vs = o.vs;
  tx.set(ref, up, { merge: true }); x.gain = gain; return x;
}
const slimX = x => x && JSON.parse(JSON.stringify({ d: x.d, lp: x.lp, ev: x.ev, gain: x.gain, reward: x.reward, before: x.before, after: x.after, thr: x.thr, pct: x.pct }));   // sans « undefined » (refusé par Firestore)

// ── Sessions de quiz ──
async function sesGet(sid, uid) {
  const s = await SES(String(sid || "")).get();
  if (!s.exists || s.data().uid !== uid) throw L.httpErr(404, "session");
  return s;
}
function pub(se) { return { sid: se.id, mode: se.mode, n: se.qs.length, timer: se.timer, ranked: !!se.ranked, thr: se.thr || null }; }
const curIdx = se => (se.res || []).length;   // question en cours = première sans réponse (les questions passées comptent comme répondues)

// Partie classée solo quittée en cours de route (≥ 2 réponses) = défaite, appliquée au prochain passage
async function settleSolo(uid, name) {
  const ref = LGO(uid);
  return L.fs().runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {}, p = d.soloPend; if (!p) return null;
    const s = await tx.get(SES(p)); const se = s.exists ? s.data() : null;
    if (!se || se.done) { tx.set(ref, { soloPend: FV().delete() }, { merge: true }); return null; }
    const ans = (se.res || []).filter(r => !r.skip);
    if (ans.length < RKS.forfeitQ) { tx.set(ref, { soloPend: FV().delete() }, { merge: true }); tx.set(SES(p), { done: true }, { merge: true }); return null; }
    tx.set(SES(p), { done: true, forfeit: true }, { merge: true });
    return slimX(soloApply(tx, ref, d, name, { score: ans.reduce((a, r) => a + r.f, 0), total: se.qs.length, forfeit: true }, 0));
  });
}

// Duel : résultat pour UN joueur (chacun le sien, une seule fois)
async function duelFinalize(uid, id, force) {
  const name = await nameOf(uid);
  return L.fs().runTransaction(async tx => {
    const ds = await tx.get(DUEL(id)); if (!ds.exists) return { gone: true };
    const du = ds.data(), opp = du.fromId === uid ? du.toId : du.fromId;
    if (du.fromId !== uid && du.toId !== uid) throw L.httpErr(403, "duel");
    if (du.fin && du.fin[uid]) return du.fin[uid];
    const sc = du.sc || {}, m = sc[uid] || { s: 0, i: 0, c: 0 }, o = sc[opp] || { s: 0, i: 0, c: 0 };
    const t = now(), oAt = o.at || du.ts || du.t, mAt = m.at || du.ts || du.t;
    const oGone = !!o.f || (!o.d && t - oAt > GONE), mGone = !!m.f || (force === "forfeit");
    if (!m.d && !mGone) return { wait: true };
    if (!mGone && !o.d && !oGone) return { wait: true };
    const ref = LGO(uid), d = (await tx.get(ref)).data() || {};
    let win, draw;
    if (mGone) { win = false; draw = false; }
    else { win = oGone || m.s > (o.s || 0); draw = !oGone && m.s === (o.s || 0); if (draw) win = false; }
    const res = { win, draw, gone: !mGone && oGone, my: m.s || 0, opp: o.s || 0, c: m.c || 0, n: du.n || 10, comp: du.mode !== "train" };
    if (res.comp) {
      const g = mGone ? 0 : Math.round((m.c || 0) * LG.duelOk) + (win ? LG.win : draw ? LG.draw : LG.lose);
      const od = (await tx.get(LGO(opp))).data() || {}, rp = repOf(d, opp);
      const x = duelApply(tx, ref, d, name, { won: win, draw, forfeit: mGone, my: m.s || 0, opp: o.s || 0, oppMmr: RK.norm(od.rk).mmr, rep: rp.rep, lingo: g, vs: rp.vs });
      res.x = slimX(x); res.gain = x.gain;
    } else {
      const tg = trGain(d, m.c || 0, du.n || 10); res.gain = tg.g;
      if (tg.g > 0) tx.set(ref, { name, t: t, total: FV().increment(tg.g), trd: tg.trd }, { merge: true });
    }
    tx.set(DUEL(id), { fin: { [uid]: JSON.parse(JSON.stringify(res)) } }, { merge: true });
    return res;
  });
}
// Duel classé en attente (app fermée, onglet quitté…) : réglé au prochain passage
async function settleDuel(uid) {
  const d = (await LGO(uid).get()).data() || {}, p = d.rk && d.rk.pend; if (!p || !p.id) return null;
  const ds = await DUEL(p.id).get();
  if (!ds.exists) { await LGO(uid).set({ rk: { pend: null } }, { merge: true }); return null; }
  const du = ds.data(); if (du.fin && du.fin[uid]) { await LGO(uid).set({ rk: { pend: null } }, { merge: true }); return null; }
  const m = (du.sc || {})[uid] || {}, old = now() - (p.t || 0) > PEND_OLD;
  if (!m.d && !old) return null;
  const r = await duelFinalize(uid, p.id, !m.d ? "forfeit" : null);
  return r && !r.wait ? r : null;
}

// Gel de série : utilisé automatiquement si hier est manqué (série vérifiée par le serveur)
async function autoFreeze(uid) {
  const ref = LGO(uid);
  return L.fs().runTransaction(async tx => {
    const d = (await tx.get(ref)).data() || {}, sh = d.shop || {}, q = d.dq || { d: {} }, t = DQ.today(), y = DQ.add(t, -1);
    if (q.d[t] !== undefined || q.d[y] !== undefined || q.d[DQ.add(t, -2)] === undefined) return false;
    if ((sh.freeze || 0) < 1 || sh.fzd === y) return false;
    tx.set(ref, { shop: { freeze: FV().increment(-1), fzd: y }, dq: { d: { [y]: 0 } } }, { merge: true }); return y;
  });
}
const dqView = q => { q = q || { d: {}, best: 0 }; const o = { d: q.d || {}, best: q.best || 0 }; return { d: o.d, best: Math.max(o.best, DQ.longest(o)), streak: DQ.streakOf(o) }; };

const A = {
  // Au lancement / à l'ouverture des modes : règle ce qui est en attente
  async sync(b, u) {
    const name = await nameOf(u.uid), out = {};
    try {   // première fois : la série du quiz du jour est reprise de la progression du compte
      const d0 = (await LGO(u.uid).get()).data() || {};
      if (!d0.dq) { const p = ((await L.fs().doc("progress/" + u.uid).get()).data() || {}).dq || {}, dd = {};
        Object.keys(p.d || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= DQ.today()).slice(-400).forEach(k => { dd[k] = Math.max(0, Math.min(DQ_N, +p.d[k] || 0)); });
        await LGO(u.uid).set({ name, dq: { d: dd, best: DQ.longest({ d: dd }) } }, { merge: true }); }
    } catch (e) {}
    try { out.solo = await settleSolo(u.uid, name); } catch (e) {}
    try { out.duel = await settleDuel(u.uid); } catch (e) {}
    try { out.gel = await autoFreeze(u.uid); } catch (e) {}
    const d = (await LGO(u.uid).get()).data() || {};
    out.total = d.total || 0; out.dq = dqView(d.dq);
    return out;
  },

  // Quiz du jour : infos d'accueil (catégories) sans les questions
  async jour() { return { num: DQ.num(), cats: DQ.cats(), n: DQ_N }; },

  async start(b, u) {
    const mode = String(b.mode || ""), uid = u.uid, name = await nameOf(uid);
    let qs, se = { uid, mode, t0: now(), res: [], served: {}, done: false };
    if (mode === "solo") {
      await settleSolo(uid, name).catch(() => {});
      const d = (await LGO(uid).get()).data() || {}, t = tierOf(d.rks);
      qs = J.rkBank(10, t).qs; se.timer = TIMER; se.ranked = qs.length >= RKS.minQ; se.thr = J.rkSoloGoal(RK.norm(d.rks).t);
    } else if (mode === "free") { qs = J.rkBank(10).qs; se.timer = 0; }
    else if (mode === "daily") { qs = DQ.questions(); se.timer = 0; se.day = DQ.today(); }
    else if (mode === "duel") {
      const id = String(b.duelId || ""), ds = await DUEL(id).get(); if (!ds.exists) throw L.httpErr(404, "duel");
      const du = ds.data(); if (du.fromId !== uid && du.toId !== uid) throw L.httpErr(403, "duel");
      if (du.status !== "active") throw L.httpErr(409, "duelstate");
      const priv = (await SES("duel_" + id).get()).data(); if (!priv) throw L.httpErr(404, "duel");
      const sid = "d_" + id + "_" + uid, ex = await SES(sid).get();
      if (ex.exists) return pub(Object.assign({ id: sid }, ex.data()));
      se = Object.assign(se, { duelId: id, opp: du.fromId === uid ? du.toId : du.fromId, timer: du.mode === "train" ? 0 : TIMER, comp: du.mode !== "train", qs: priv.qs });
      await SES(sid).set(se);
      await DUEL(id).set({ sc: { [uid]: { s: 0, i: 0, c: 0, at: now() } }, ts: du.ts || now() }, { merge: true });
      if (se.comp) { const od = (await LGO(se.opp).get()).data() || {}; await LGO(uid).set({ name, rk: { pend: { id, opp: se.opp, omm: RK.norm(od.rk).mmr, t: now() } } }, { merge: true }); }
      return pub(Object.assign({ id: sid }, se));
    } else throw L.httpErr(400, "mode");
    se.qs = qs.map(shuffledQ);
    const sid = rid(); await SES(sid).set(se);
    if (mode === "solo" && se.ranked) await LGO(uid).set({ name, soloPend: sid }, { merge: true });
    return pub(Object.assign({ id: sid }, se));
  },

  // La question suivante n'est envoyée qu'au moment où elle s'affiche : le chrono démarre ici, sur le serveur
  async suivante(b, u) {
    return L.fs().runTransaction(async tx => {
      const s = await tx.get(SES(String(b.sid || ""))); if (!s.exists || s.data().uid !== u.uid) throw L.httpErr(404, "session");
      const se = s.data(), i = curIdx(se); if (se.done) throw L.httpErr(409, "done");
      if (i >= se.qs.length) return { end: true };
      if (!se.served[i]) tx.set(SES(s.id), { served: { [i]: now() } }, { merge: true });
      const q = se.qs[i]; return { i, q: q.q, options: q.o, hidden: (se.fifty || {})[i] || [] };
    });
  },

  async repondre(b, u) {
    const r = await L.fs().runTransaction(async tx => {
      const s = await tx.get(SES(String(b.sid || ""))); if (!s.exists || s.data().uid !== u.uid) throw L.httpErr(404, "session");
      const se = s.data(), i = curIdx(se); if (se.done) throw L.httpErr(409, "done");
      if (i >= se.qs.length || !se.served[i]) throw L.httpErr(409, "order");
      const q = se.qs[i], ms = now() - se.served[i];
      let a = Number.isInteger(b.a) && b.a >= 0 && b.a < q.o.length ? b.a : null;
      if (se.timer && ms > se.timer * 1000 + GRACE) a = null;   // trop tard = pas de réponse
      const f = a === q.c ? 1 : 0, rec = { a, f, ms };
      tx.set(SES(s.id), { res: FV().arrayUnion(Object.assign({ k: i }, rec)) }, { merge: true });
      return { se, i, f, ms, q };
    });
    const { se, i, f, ms, q } = r;
    if (se.mode === "duel") {   // le score du duel est écrit par le serveur
      const pts = Math.round(f * (se.comp ? 100 + 50 * Math.max(0, 1 - ms / 20000) : 100)), inc = FV().increment;
      await DUEL(se.duelId).set({ sc: { [u.uid]: { s: inc(pts), i: inc(1), c: inc(f), at: now() } } }, { merge: true }).catch(() => {});
    }
    return { ok: f === 1, correct: q.c, explain: q.e, i };
  },

  // 50/50 et « Passer » : seulement en partie libre (jamais en classé), payés avec ses boosts
  async cinquante(b, u) {
    return L.fs().runTransaction(async tx => {
      const s = await tx.get(SES(String(b.sid || ""))), lr = LGO(u.uid); if (!s.exists || s.data().uid !== u.uid) throw L.httpErr(404, "session");
      const se = s.data(), i = curIdx(se); if (se.mode !== "free" || se.done || !se.served[i]) throw L.httpErr(409, "mode");
      if ((se.fifty || {})[i]) return { hide: se.fifty[i] };
      const d = (await tx.get(lr)).data() || {}, pk = Object.assign({}, (d.shop || {}).pk || {}); if (!(pk.fifty > 0)) return { none: true };
      pk.fifty--; const q = se.qs[i], hide = J.shuffleArray(q.o.map((_, k) => k).filter(k => k !== q.c)).slice(0, 2);
      tx.set(lr, { shop: { pk } }, { merge: true }); tx.set(SES(s.id), { fifty: { [i]: hide } }, { merge: true });
      return { hide, left: pk.fifty };
    });
  },
  async passer(b, u) {
    return L.fs().runTransaction(async tx => {
      const s = await tx.get(SES(String(b.sid || ""))), lr = LGO(u.uid); if (!s.exists || s.data().uid !== u.uid) throw L.httpErr(404, "session");
      const se = s.data(), i = curIdx(se); if (se.mode !== "free" || se.done || i >= se.qs.length) throw L.httpErr(409, "mode");
      const d = (await tx.get(lr)).data() || {}, pk = Object.assign({}, (d.shop || {}).pk || {}); if (!(pk.skip > 0)) return { none: true };
      pk.skip--; tx.set(lr, { shop: { pk } }, { merge: true });
      tx.set(SES(s.id), { res: FV().arrayUnion({ k: i, a: null, f: 0, ms: 0, skip: true }) }, { merge: true });
      return { ok: true, left: pk.skip };
    });
  },
  // Utiliser un boost hors partie classée (bouclier de combo = XP seulement ; 50/50 et Passer en révision de fiche)
  async perk(b, u) {
    const id = String(b.id || ""); if (!["shield", "fifty", "skip"].includes(id)) throw L.httpErr(400, "perk");
    const lr = LGO(u.uid);
    return L.fs().runTransaction(async tx => { const d = (await tx.get(lr)).data() || {}, pk = Object.assign({}, (d.shop || {}).pk || {}); if (!(pk[id] > 0)) return { ok: false }; pk[id]--; tx.set(lr, { shop: { pk } }, { merge: true }); return { ok: true }; });
  },

  async fin(b, u) {
    const uid = u.uid, name = await nameOf(uid), s = await sesGet(b.sid, uid), se = s.data();
    const res = (se.res || []).slice().sort((x, y) => x.k - y.k), done = res.length >= se.qs.length;
    if (!done) throw L.httpErr(409, "notdone");
    const ans = res.filter(r => !r.skip), score = ans.reduce((a, r) => a + r.f, 0), total = ans.length;
    if (se.mode === "duel") {
      await DUEL(se.duelId).set({ sc: { [uid]: { d: true, at: now() } } }, { merge: true });
      await SES(s.id).set({ done: true }, { merge: true });
      const r = await duelFinalize(uid, se.duelId).catch(() => ({ wait: true }));
      return { score, total, duel: r };
    }
    const ref = LGO(uid);
    return L.fs().runTransaction(async tx => {
      const ss = await tx.get(SES(s.id)); if (ss.data().done) return ss.data().out || { score, total };
      const d = (await tx.get(ref)).data() || {}; let out = { score, total };
      if (se.mode === "solo") {
        const g = ans.reduce((a, r) => a + Math.round(r.f * (LG.ok + LG.speed * Math.max(0, 1 - r.ms / 20000))), 0) + (score === total && total >= 3 ? LG.perfect : 0);
        if (se.ranked) { const x = soloApply(tx, ref, d, name, { score, total }, g); out.gain = g; out.x = slimX(x); }
        else { if (g > 0) tx.set(ref, { name, t: now(), total: FV().increment(g), solo: FV().increment(g) }, { merge: true }); out.gain = g; }
      } else if (se.mode === "free") {
        const tg = trGain(d, score, total); out.gain = tg.g;
        if (tg.g > 0) tx.set(ref, { name, t: now(), total: FV().increment(tg.g), trd: tg.trd }, { merge: true });
      } else if (se.mode === "daily") {
        const q = { d: Object.assign({}, (d.dq || {}).d), best: (d.dq || {}).best || 0 }, day = se.day;
        out.fresh = q.d[day] === undefined && day === DQ.today();
        if (out.fresh) { q.d[day] = score; const ks = Object.keys(q.d).sort(); ks.slice(0, Math.max(0, ks.length - 400)).forEach(k => delete q.d[k]); q.best = Math.max(q.best, DQ.longest(q)); tx.set(ref, { name, dq: q }, { merge: true }); }
        out.dq = dqView(q);
      }
      tx.set(SES(s.id), { done: true, out }, { merge: true });
      return out;
    });
  },

  async abandon(b, u) {
    const uid = u.uid, s = await sesGet(b.sid, uid), se = s.data(); if (se.done) return { ok: true };
    if (se.mode === "duel") {
      await DUEL(se.duelId).set({ sc: { [uid]: { d: true, f: true, at: now() } } }, { merge: true });
      await SES(s.id).set({ done: true }, { merge: true });
      return { duel: await duelFinalize(uid, se.duelId, "forfeit").catch(() => null) };
    }
    if (se.mode === "solo" && se.ranked) return { x: await settleSolo(uid, await nameOf(uid)) };
    await SES(s.id).set({ done: true }, { merge: true }); return { ok: true };
  },

  // ── Duels : invitation, réponse, annulation, résultat ──
  async defier(b, u) {
    const uid = u.uid, to = String(b.toId || ""); if (!to || to === uid) throw L.httpErr(400, "to");
    const pr = await L.fs().doc("presence/" + to).get(); if (!pr.exists) throw L.httpErr(404, "to");
    const mode = b.mode === "train" ? "train" : "comp", d = (await LGO(uid).get()).data() || {};
    const qs = (mode === "comp" ? J.rkBank(10, tierOf(d.rk)) : J.rkBank(10)).qs.map(shuffledQ), id = rid();
    await SES("duel_" + id).set({ uid: "", qs, t: now() });
    await DUEL(id).set({ fromId: uid, fromName: await nameOf(uid), toId: to, toName: await nameOf(to), status: "pending", title: mode === "comp" ? "Quiz ranked" : "Quiz", n: qs.length, sc: {}, t: now(), mode });
    return { id };
  },
  async repondreDefi(b, u) {
    return L.fs().runTransaction(async tx => {
      const r = DUEL(String(b.id || "")), s = await tx.get(r); if (!s.exists) throw L.httpErr(404, "duel");
      const du = s.data(); if (du.toId !== u.uid) throw L.httpErr(403, "duel");
      if (du.status !== "pending" || now() - du.t > 95000) return { status: du.status === "pending" ? "expired" : du.status };
      const st = b.ok ? "active" : "declined"; tx.update(r, { status: st, ts: now() }); return { status: st };
    });
  },
  async annulerDefi(b, u) {
    const r = DUEL(String(b.id || "")), s = await r.get(); if (!s.exists) return { ok: true };
    if (s.data().fromId !== u.uid) throw L.httpErr(403, "duel");
    if (s.data().status === "pending") await r.update({ status: "cancelled" }); return { ok: true };
  },
  async finDuel(b, u) { return duelFinalize(u.uid, String(b.id || "")); },

  // ── Boutique (mêmes règles que le site, appliquées par le serveur) ──
  async boutique(b, u) {
    const uid = u.uid, name = await nameOf(uid), ref = LGO(uid), op = String(b.op || ""), day = DQ.today();
    return L.fs().runTransaction(async tx => {
      const d = (await tx.get(ref)).data() || {}, total = d.total || 0, sh = d.shop || {};
      let x = null, extra = {};
      if (op === "claim") {
        if (sh.claim === day) x = { r: "done" };
        else { const pk = Object.assign({}, sh.pk || {}); let n = J.shRoll();
          if ((pk.chance || 0) > 0) { n = 15 + Math.floor(Math.random() * 16); pk.chance--; }
          if ((sh.pm || []).includes("magnet")) n += 3;
          if ((pk.x2 || 0) > 0) { n *= 2; pk.x2--; }
          x = { r: "ok", dt: n, patch: { claim: day, pk } }; extra.got = n; }
      } else if (op === "buy") {
        const key = String(b.key || ""), def = J.shDef(key); if (!def) throw L.httpErr(400, "key");
        const of = J.shOffers().find(o => o.key === key), base = of ? of.price : def.base, price = J.shPx(base, sh);
        if (total < price) x = { r: "poor" };
        else { const p = {}, t = def.type, id = def.id; x = null;
          if (t === "a") { const o = sh.own || []; if (o.includes(id)) x = { r: "have" }; else { p.own = o.concat(id); p.av = id; } }
          else if (t === "b") { const o = sh.mo || []; if (o.includes(id)) x = { r: "have" }; else { p.mo = o.concat(id); p.m = id; } }
          else if (t === "d") { const o = sh.dn || []; if (o.includes(id)) x = { r: "have" }; else { p.dn = o.concat(id); p.dc = id; } }
          else if (t === "c") { const o = sh.co || []; if (o.includes(id)) x = { r: "have" }; else { p.co = o.concat(id); p.ce = J.shEquipCos(sh.ce || [], id); } }
          else if (t === "p") { const pf = def.perk;
            if (pf.kind === "perm") { const o = sh.pm || []; if (o.includes(id)) x = { r: "have" }; else p.pm = o.concat(id); }
            else { const pk = Object.assign({}, sh.pk || {}), n = pk[id] || 0; if (n >= pf.max) x = { r: "full" }; else { pk[id] = n + 1; p.pk = pk; } } }
          else if (t === "fz") { const bi = sh.bd === day ? sh.bi || [] : []; if (bi.includes("fz")) x = { r: "have" }; else if ((sh.freeze || 0) >= J.shFzMax(sh)) x = { r: "full" }; else { p.bd = day; p.bi = bi.concat("fz"); p.freeze = (sh.freeze || 0) + 1; } }
          if (!x && J.shGate(key, sh)) x = { r: "lock" };
          if (!x) { x = { r: "ok", dt: -price, patch: p }; extra.paid = price; } }
      } else if (op === "equip") {
        const tok = String(b.tok || ""), i = tok.indexOf(":"), t = tok.slice(0, i), id = tok.slice(i + 1), p = {};
        if (t === "b") { if (!(sh.mo || []).includes(id)) throw L.httpErr(400, "own"); p.m = id; }
        else if (t === "a") { if (id && !(sh.own || []).includes(id)) throw L.httpErr(400, "own"); p.av = id; }
        else if (t === "c") { if (!(sh.co || []).includes(id)) throw L.httpErr(400, "own"); const ce = sh.ce || []; p.ce = ce.includes(id) ? ce.filter(c => c !== id) : J.shEquipCos(ce, id); }
        else if (t === "n") p.ce = (sh.ce || []).filter(c => J.BX.cosSlot[c] !== id);
        else if (t === "d") p.dc = id && (sh.dn || []).includes(id) ? id : "";
        else if (t === "x") p.ce = [];
        else if (t === "r") { const own = J.SH_COS.filter(c => (sh.co || []).includes(c.id)), ce = []; J.BX.SLOTS.forEach(([s]) => { const Lc = own.filter(c => c.slot === s); if (Lc.length && Math.random() < .6) ce.push(Lc[Math.floor(Math.random() * Lc.length)].id); }); p.ce = ce; }
        else if (t === "o") { const o = (sh.ot || [])[+id]; if (!o) throw L.httpErr(400, "tok"); p.ce = (o.ce || []).filter(c => (sh.co || []).includes(c)); if (o.m && (sh.mo || []).includes(o.m)) p.m = o.m; p.av = !o.av || (sh.own || []).includes(o.av) ? o.av || "" : sh.av || ""; p.dc = !o.dc || (sh.dn || []).includes(o.dc) ? o.dc || "" : sh.dc || ""; }
        else if (t === "s") { const ot = (sh.ot || []).slice(); while (ot.length < 3) ot.push({ m: "", av: "", ce: [] }); const k = Math.max(0, Math.min(2, +id | 0)); ot[k] = { m: J.shMasc(sh), av: sh.av || "", ce: J.shWorn(sh), dc: J.shDcur(sh) }; p.ot = ot; }
        else throw L.httpErr(400, "tok");
        x = { r: "ok", dt: 0, patch: p };
      } else if (op === "loot") {
        const bx = J.SH_BOXES.find(o => o.id === b.id); if (!bx) throw L.httpErr(400, "box");
        const price = J.shPx(bx.price, sh);
        if (total < price) x = { r: "poor" };
        else { const res = J.shLootRoll(bx, Math.random(), Math.random(), sh); x = { r: "ok", dt: -price + (res.gain || 0), patch: res.patch || {} };
          extra.paid = price; extra.res = { k: res.k, name: res.name, gain: res.gain || 0, rar: res.rar, dup: !!res.dup, dud: !!res.dud, key: res.def ? res.def.key : null }; }
      } else throw L.httpErr(400, "op");
      if (x.r === "ok") tx.set(ref, { name, total: FV().increment(x.dt || 0), shop: x.patch }, { merge: true });
      return Object.assign({ r: x.r }, extra);
    });
  }
};

module.exports = L.handler(async (b, req) => {
  const fn = A[b.action];
  if (!fn) throw L.httpErr(400, "action");
  const u = b.action === "jour" ? null : await L.caller(req);
  return fn(b, u);
});

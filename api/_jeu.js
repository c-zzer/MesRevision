// ⚠️ FICHIER GÉNÉRÉ par outils/extraire-jeu.js à partir de index.html — ne pas modifier à la main.
// Règles du jeu partagées avec le site : le serveur calcule exactement comme lui.
/* eslint-disable */
const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const progDirty = () => {};
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const RK = (() => {
  // ── RÉGLAGES : tout se règle ici ────────────────────────────────────────────
  const CFG = {
    start: 1000,                    // MMR de départ (caché)
    place: 5,                       // duels de placement (aucun LP en jeu, gros écarts de MMR)
    placeCap: 2,                    // rang maximum à la sortie des placements (2 = Or)
    carry: 20,                      // LP maximum reportés après une montée de division
    dropLp: 75,                     // LP après une descente de division / de rang
    failLp: 75,                     // LP après une série de promotion perdue
    entryLp: 15,                    // LP en arrivant dans un nouveau rang
    shield: 3,                      // duels de protection contre la descente après une montée de rang
    minWin: 5, minLoss: 4,          // LP minimum gagnés / perdus (le perdant perd TOUJOURS quelque chose)
    minMmr: 6,                      // variation minimale du MMR caché
    spread: 450, gapLo: .6, gapHi: 1.6,   // effet « MMR caché au-dessus / en dessous de ton rang »
    kPlace: 48, kNew: 40, newGames: 20, k: [32, 30, 28, 26, 24, 22],
    margin: .25,                    // bonus/malus maximum selon l'écart de score
    forfeit: 1.3,                   // malus si on abandonne un duel classé
    streakMax: .2,                  // bonus de série (victoires) / malus (défaites), max
    reward: { place: 60, div: 40, tier: 150, tierStep: 50 }   // Lingo gagnés
  };
  // gain / loss = vitesse des LP (la perte n’est JAMAIS supérieure au gain : loss ≤ gain) selon le rang (monter devient de plus en plus long) · bo = série pour passer au rang suivant
  const TIERS = [
    { id: "bronze",  n: "Bronze",  c: "#E8A46B", d: 3, mmr: 700,  gain: 1.00, loss: .85, bo: 3 },
    { id: "argent",  n: "Argent",  c: "#DDE5E8", d: 3, mmr: 900,  gain: .90,  loss: .90, bo: 3 },
    { id: "or",      n: "Or",      c: "#FFD23F", d: 3, mmr: 1100, gain: .80,  loss: .80, bo: 3 },
    { id: "platine", n: "Platine", c: "#7FE0D0", d: 3, mmr: 1350, gain: .70,  loss: .70, bo: 5 },
    { id: "diamant", n: "Diamant", c: "#8CC8FF", d: 3, mmr: 1650, gain: .60,  loss: .60, bo: 5 },
    { id: "maitre",  n: "Maître",  c: "#B9A5FF", d: 1, mmr: 2000, gain: .50,  loss: .50, bo: 0 }
  ];
  const LEGEND_LP = 400;            // « Légende » = Maître avec au moins 400 LP
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === "number" && isFinite(x) ? x : d);
  const roman = n => ["", "I", "II", "III"][n] || "";

  function blank() { return { mmr: CFG.start, g: 0, w: 0, l: 0, t: 0, dv: 3, lp: 0, promo: null, shield: 0, st: 0, pk: 0, ok: false }; }
  function norm(x) {
    const b = blank(); if (!x || typeof x !== "object") return b;
    const r = Object.assign(b, x);
    r.mmr = num(r.mmr, CFG.start); r.g = num(r.g, 0) | 0; r.w = num(r.w, 0) | 0; r.l = num(r.l, 0) | 0;
    r.t = clamp(num(r.t, 0) | 0, 0, TIERS.length - 1); r.lp = num(r.lp, 0); r.st = num(r.st, 0) | 0; r.shield = num(r.shield, 0) | 0; r.ok = !!r.ok;
    r.dv = TIERS[r.t].d === 1 ? 1 : clamp(num(r.dv, 3) | 0, 1, 3);
    r.promo = r.promo && typeof r.promo === "object" ? { w: num(r.promo.w, 0) | 0, l: num(r.promo.l, 0) | 0, need: num(r.promo.need, 2) | 0, of: num(r.promo.of, 3) | 0 } : null;
    r.pk = Math.max(num(r.pk, 0), rp(r));
    return r;
  }
  // Points de classement « absolus » : servent à trier le classement dans l'ordre des rangs affichés
  function rp(r) { const T = TIERS[r.t]; return r.t * 1000 + (T.d > 1 ? (3 - r.dv) * 100 : 0) + Math.round(r.lp); }
  // MMR « attendu » pour le rang affiché : l'écart avec le vrai MMR caché accélère ou freine la montée
  function implied(r) {
    const T = TIERS[r.t], N = TIERS[r.t + 1]; if (!N) return T.mmr + r.lp * 4;
    const w = (N.mmr - T.mmr) / T.d; return T.mmr + (T.d - r.dv) * w + w * Math.min(r.lp, 100) / 100;
  }
  function placeFrom(mmr) {
    let t = 0; for (let i = 0; i < TIERS.length; i++) if (mmr >= TIERS[i].mmr) t = i;
    if (t > CFG.placeCap) return { t: CFG.placeCap, dv: 3, lp: 0 };
    const T = TIERS[t], N = TIERS[t + 1], w = (N.mmr - T.mmr) / T.d, off = Math.max(0, mmr - T.mmr), di = Math.min(T.d - 1, Math.floor(off / w));
    return { t, dv: T.d - di, lp: Math.min(50, Math.round((off - di * w) / w * 100)) };
  }
  const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  function tierName(r) { return r.t === TIERS.length - 1 && r.lp >= LEGEND_LP ? "Légende" : TIERS[r.t].n; }
  function label(r) { return !r.ok ? "Non classé" : TIERS[r.t].d > 1 ? tierName(r) + " " + roman(r.dv) : tierName(r); }
  function view(x) {
    const r = norm(x), T = TIERS[r.t];
    return { ok: r.ok, placed: Math.min(r.g, CFG.place), place: CFG.place, name: label(r), tier: tierName(r), color: r.t === TIERS.length - 1 && r.lp >= LEGEND_LP ? "#FF5B3A" : T.c, t: r.t, dv: r.dv, d: T.d,
      lp: Math.round(r.lp), pct: T.d > 1 ? clamp(r.lp, 0, 100) : 100, promo: r.promo, shield: r.shield, w: r.w, l: r.l, g: r.g, wr: r.g ? Math.round(100 * r.w / r.g) : 0, st: r.st, rp: rp(r), master: T.d === 1 };
  }

  // Résultat d'un duel classé. o = { won, draw, forfeit, my, opp (scores du duel), oppMmr, rep (≤1 : dégressif contre le même adversaire) }
  // Retourne { r: nouvel état à enregistrer, d: variation du MMR caché, lp: variation de LP affichée, ev: événements, reward: Lingo bonus, before, after }
  function duel(r0, o) {
    const r = norm(r0), before = view(r), ev = [], res = o.draw ? .5 : o.won ? 1 : 0;
    const om = num(o.oppMmr, CFG.start), E = expected(r.mmr, om);
    const K = r.g < CFG.place ? CFG.kPlace : r.g < CFG.newGames ? CFG.kNew : CFG.k[r.t];
    const my = Math.max(0, num(o.my, 0)), op = Math.max(0, num(o.opp, 0)), tot = my + op;
    const mf = 1 + Math.min(CFG.margin, Math.abs(my - op) / Math.max(1, tot) * CFG.margin * 2);      // plus l'écart est grand, plus ça compte
    const sb = Math.abs(r.st) >= 2 ? Math.min(CFG.streakMax, (Math.abs(r.st) - 1) * .05) : 0;       // série de 3+ : ça monte / descend plus vite
    const gap = r.ok ? r.mmr - implied(r) : 0;                                                      // MMR caché vs rang affiché
    let d;
    if (res === 1) d = Math.max(CFG.minMmr, K * (1 - E)) * mf * (1 + (r.st > 0 ? sb : 0)) * clamp(num(o.rep, 1), .1, 1);
    else if (res === 0) d = -Math.max(CFG.minMmr, K * E) * mf * (1 + (r.st < 0 ? sb : 0)) * (o.forfeit ? CFG.forfeit : 1);   // le perdant perd TOUJOURS du MMR
    else d = K * (.5 - E) * .6;
    d = Math.round(d); if (res === 1) d = Math.max(1, d); if (res === 0) d = Math.min(-1, d);
    r.mmr += d; r.g++; if (res === 1) { r.w++; r.st = r.st > 0 ? r.st + 1 : 1; } else if (res === 0) { r.l++; r.st = r.st < 0 ? r.st - 1 : -1; } else r.st = 0;
    let reward = 0, lp = 0, tierUp = false;

    if (!r.ok) {                                                           // ── Placement : pas de LP, seulement du MMR
      if (r.g >= CFG.place) { const p = placeFrom(r.mmr); Object.assign(r, p, { ok: true, promo: null, shield: 0 }); ev.push({ k: "place" }); reward += CFG.reward.place; }
    } else {
      const T = TIERS[r.t];
      const gm = clamp(1 + gap / CFG.spread, CFG.gapLo, CFG.gapHi), lm = Math.min(gm, clamp(1 - gap / CFG.spread, CFG.gapLo, CFG.gapHi));   // perte ≤ gain, même si le MMR caché est sous ton rang
      if (res === 1) lp = Math.max(CFG.minWin, Math.round(d * T.gain * gm));
      else if (res === 0) {
        lp = -Math.max(CFG.minLoss, Math.round(-d * T.loss * lm));
        if (!o.forfeit) lp = Math.max(lp, -Math.max(CFG.minWin, Math.round(Math.max(1, Math.round(Math.max(CFG.minMmr, K * .5) * mf)) * T.gain * gm)));   // jamais plus de LP perdus que n'en rapporterait une victoire (même écart de score) ; seul l'abandon est puni plus fort
      }
      if (r.promo) {                                                       // ── Série de promotion : les LP sont gelés à 100
        lp = 0;
        if (res === 1) { r.promo.w++; ev.push({ k: "promoWin" }); } else if (res === 0) { r.promo.l++; ev.push({ k: "promoLoss" }); }
        if (r.promo.w >= r.promo.need) { r.promo = null; tierUp = true; }
        else if (r.promo.l > r.promo.of - r.promo.need) { r.promo = null; r.lp = CFG.failLp; ev.push({ k: "promoFail" }); }
      } else {
        r.lp += lp;
        if (r.lp >= 100 && T.d > 1) {
          if (r.dv > 1) { r.dv--; r.lp = Math.min(r.lp - 100, CFG.carry); ev.push({ k: "divUp" }); reward += CFG.reward.div; }
          else { r.lp = 100; r.promo = { w: 0, l: 0, need: Math.ceil(T.bo / 2), of: T.bo }; ev.push({ k: "promoStart", of: T.bo, need: r.promo.need }); }
        } else if (r.lp < 0) {
          if (r.shield > 0 || (r.t === 0 && r.dv === 3)) r.lp = 0;
          else if (T.d > 1 && r.dv < 3) { r.dv++; r.lp = CFG.dropLp; ev.push({ k: "divDown" }); }
          else { r.t--; r.dv = TIERS[r.t].d > 1 ? 1 : 1; r.lp = CFG.dropLp; ev.push({ k: "tierDown" }); }
        }
      }
      if (tierUp) { r.t++; r.dv = TIERS[r.t].d > 1 ? 3 : 1; r.lp = CFG.entryLp; r.shield = CFG.shield + 1; ev.push({ k: "tierUp" }); reward += CFG.reward.tier + CFG.reward.tierStep * r.t; }
      if (r.shield > 0) r.shield--;
    }
    r.pk = Math.max(r.pk, rp(r));
    return { r, d, lp, ev, reward, before, after: view(r) };
  }
  return { CFG, TIERS, norm, blank, view, label, rp, implied, expected, duel, placeFrom, roman };
})();
const RKS = { minQ: 5, base: 50, step: 2, draw: 10, forfeitQ: 2 };
const rkSoloGoal = t => RKS.base + RKS.step * t;
const RK_DIF = [[85, 15, 0, 0], [75, 23, 2, 0], [65, 30, 5, 0], [55, 35, 10, 0], [45, 38, 15, 2], [35, 40, 20, 5]];
function rkLevel(t) {
  const w = RK_DIF[t] || [70, 25, 5, 0]; let r = Math.random() * 100, L = 0;
  while (L < 3 && r >= w[L]) { r -= w[L]; L++; }
  return L + 1;
}
function rkBank(n, t) {
  const by = {}; DQ_BANK.forEach(q => (by[q[0]] = by[q[0]] || []).push(q));
  const cats = shuffleArray(Object.keys(by)).slice(0, n || 10);
  return { cats, qs: cats.map(c => {
    const L = rkLevel(t), pool = by[c]; let cand = [];
    for (let k = 0; k <= 3 && !cand.length; k++) cand = pool.filter(q => { const d = q[5] || 2; return d === L - k || d === L + k; });   // niveau voulu, sinon le plus proche
    const q = (cand.length ? cand : pool)[Math.floor(Math.random() * (cand.length || pool.length))];
    return { q: q[1], options: [q[2], ...q[3]], correct: 0, explain: q[4] || "" };
  }) };
}
const LG = { ok: 10, speed: 5, perfect: 20, runs: 3, win: 25, draw: 10, lose: 5, duelOk: 5 };
LG.trOk = 2;
LG.trPerfect = 3;
LG.trDay = 40;
const DQ_KEY = "rev_dq_v1", DQ_DAYS = 1000, DQ_EPOCH = Date.UTC(2026, 9, 12), DQ_N = 5;
const DQ_CATS = ["Histoire", "Géographie", "Sciences", "Nature & animaux", "Sport", "Arts & littérature", "Cinéma & musique", "Gastronomie", "Langue française", "Insolite & records", "Technologie & jeux", "Mythologie", "Capitales", "Drapeaux", "Départements", "Éléments chimiques"].concat(["Calcul mental"]);
const DQ_BANK = [];
const DQ = (() => {
  const pad = n => String(n).padStart(2, "0"), K = DQ_CATS.length - 1;
  const ds = t => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const add = (s, k) => { const [y, m, d] = s.split("-").map(Number); return ds(new Date(y, m - 1, d + k)); };
  // Le « jour » (quiz du jour, boutique, cadeau, offres) change chaque jour à 6 h 30, heure de Paris : avant 6 h 30, on est encore la veille.
  const RESET_MIN = 6 * 60 + 30;
  const _pf = (() => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }); } catch (e) { return null; } })();
  const parisNow = () => { if (!_pf) { const d = new Date(); return { s: ds(d), min: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 }; }
    const p = {}; _pf.formatToParts(new Date()).forEach(x => p[x.type] = x.value); return { s: p.year + "-" + p.month + "-" + p.day, min: (+p.hour % 24) * 60 + (+p.minute) + (+p.second) / 60 }; };
  const today = () => { const n = parisNow(); return n.min < RESET_MIN ? add(n.s, -1) : n.s; };
  const resetIn = () => { const n = parisNow(); return Math.round((n.min < RESET_MIN ? RESET_MIN - n.min : 1440 + RESET_MIN - n.min) * 60000); };
  const dow = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
  const dayNum = s => { const [y, m, d] = s.split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - DQ_EPOCH) / 864e5); };
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const shuf = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function load() { try { const v = JSON.parse(localStorage.getItem(DQ_KEY) || "{}") || {}; return { d: v.d && typeof v.d === "object" ? v.d : {}, best: +v.best || 0 }; } catch (e) { return { d: {}, best: 0 }; } }
  function saveRaw(o) { try { localStorage.setItem(DQ_KEY, JSON.stringify(o)); } catch (e) {} }
  function trim(o) { const k = Object.keys(o.d).sort(); k.slice(0, Math.max(0, k.length - 400)).forEach(x => delete o.d[x]); return o; }
  function streakOf(o) { let t = today(); if (o.d[t] === undefined) t = add(t, -1); let n = 0; while (o.d[t] !== undefined) { n++; t = add(t, -1); } return n; }
  function longest(o) { let best = 0, run = 0, prev = null; Object.keys(o.d).sort().forEach(x => { run = prev && add(prev, 1) === x ? run + 1 : 1; prev = x; if (run > best) best = run; }); return best; }
  function merge(r) { const l = load(); if (r && typeof r === "object") { const rd = r.d && typeof r.d === "object" ? r.d : {}; Object.keys(rd).forEach(k => { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(+rd[k])) l.d[k] = Math.max(l.d[k] === undefined ? -1 : l.d[k], +rd[k]); }); l.best = Math.max(l.best, +r.best || 0); } l.best = Math.max(l.best, longest(l)); return trim(l); }
  function record(score) { const o = load(), t = today(); if (o.d[t] !== undefined) return false; o.d[t] = score; o.best = Math.max(o.best, longest(o)); trim(o); saveRaw(o); try { progDirty(); } catch (e) {} return true; }
  function mathQ(r) {
    const R = (a, b) => a + Math.floor(r() * (b - a + 1)), t = R(0, 5); let q, a;
    if (t === 0) { const x = R(12, 89), y = R(11, 79); q = "Combien font " + x + " + " + y + " ?"; a = x + y; }
    else if (t === 1) { const x = R(40, 160), y = R(11, x - 8); q = "Combien font " + x + " − " + y + " ?"; a = x - y; }
    else if (t === 2) { const x = R(3, 12), y = R(6, 14); q = "Combien font " + x + " × " + y + " ?"; a = x * y; }
    else if (t === 3) { const y = R(3, 12), z = R(4, 15); q = "Combien font " + (y * z) + " ÷ " + y + " ?"; a = z; }
    else if (t === 4) { const p = [10, 20, 25, 50][R(0, 3)], b = R(2, 25) * 20; q = "Quel est " + p + " % de " + b + " ?"; a = b * p / 100; }
    else { const x = R(4, 16); q = "Combien font " + x + "² ?"; a = x * x; }
    const c = [...new Set([a + 1, a - 1, a + 2, a - 2, a + 10, a - 10, a + 5, a - 5, a * 2, Math.round(a / 2)])].filter(v => v !== a && v >= 0);
    return [K, q, String(a), shuf(c, r).slice(0, 3).map(String), ""];
  }
  let _plan = null;
  const reset = () => { _plan = null; };   // à appeler quand la banque s'agrandit : le plan du jour est recalculé
  function plan() {
    if (_plan) return _plan;
    const by = DQ_CATS.map(() => []); DQ_BANK.forEach((q, i) => by[q[0]].push(i));
    const w = by.map((c, i) => i === K ? 5 : i < 12 ? Math.min(Math.sqrt(c.length), 5) : Math.sqrt(c.length) * .7), cnt = by.map(() => 0), perm = {}; _plan = [];
    for (let n = 0; n < DQ_DAYS; n++) {
      const r = rng(n * 7919 + 101), pool = [...w.keys()], day = [];
      for (let k = 0; k < DQ_N; k++) {
        let x = r() * pool.reduce((sum, c) => sum + w[c], 0), j = 0;
        while (j < pool.length - 1 && x > w[pool[j]]) { x -= w[pool[j]]; j++; }
        const c = pool.splice(j, 1)[0], ptr = cnt[c]++;
        if (c === K) { day.push([c, "m", n * 10 + k]); continue; }
        const len = by[c].length, cyc = Math.floor(ptr / len), key = c + ":" + cyc;
        if (!perm[key]) perm[key] = shuf([...Array(len).keys()], rng(c * 1009 + cyc * 37 + 5));
        day.push([c, "b", by[c][perm[key][ptr % len]]]);
      }
      _plan.push(day);
    }
    return _plan;
  }
  const num = () => ((dayNum(today()) % DQ_DAYS) + DQ_DAYS) % DQ_DAYS;
  const quiz = n => plan()[n === undefined ? num() : n].map(([c, t, v]) => t === "m" ? mathQ(rng(v * 7 + 17)) : DQ_BANK[v]);
  const questions = n => quiz(n).map(q => ({ q: q[1], options: [q[2], ...q[3]], correct: 0, explain: q[4] || "" }));
  const cats = n => [...new Set(plan()[n === undefined ? num() : n].map(x => DQ_CATS[x[0]]))];
  return { today, resetIn, add, dow, load, saveRaw, merge, record, streakOf, longest, num, questions, cats, quiz, reset };
})();
const SH = { min: 5, max: 20, freezeMax: 2, freezePrice: 120, promo: .7, card: .9 };
const SH_COLORS = [
  { id: "menthe", n: "Menthe", c: "#7FE0B0", p: 80 }, { id: "ciel", n: "Ciel", c: "#7CCBFF", p: 80 },
  { id: "corail", n: "Corail", c: "#FF8F7A", p: 100 }, { id: "rose", n: "Rose bonbon", c: "#FF9ACB", p: 100 },
  { id: "citron", n: "Citron", c: "#F4E04D", p: 120 }, { id: "lilas", n: "Lilas", c: "#B9A5FF", p: 120 },
  { id: "mandarine", n: "Mandarine", c: "#FF9F43", p: 160 }, { id: "turquoise", n: "Turquoise", c: "#4FD1C5", p: 180 }];
const SH_SNOW = '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>';
const shRoll = () => SH.min + Math.floor(Math.pow(Math.random(), 1.6) * (SH.max - SH.min + 1));
function shRng(s) { let a = 0; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 2654435761) >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const BX = (() => {
const INK="#0F3B2E";
const ANCH={"cyclope": {"hat": [60, 22, 1.0], "eyes": [60, 52, 1.15], "mouth": [60, 70, 0.8], "neck": [60, 84, 1.1], "hand": [108, 77], "back": [60, 54, 1.1], "feet": [[45, 102], [75, 102]]}, "troisyeux": {"hat": [60, 16, 1.0], "eyes": [60, 38, 1.45], "mouth": [60, 66, 0.9], "neck": [60, 84, 1.1], "hand": [106, 75], "back": [60, 52, 1.1], "feet": [[45, 102], [75, 102]]}, "carre": {"hat": [60, 21, 1.15], "eyes": [60, 46, 1.27], "mouth": [60, 58, 1.0], "neck": [60, 84, 1.2], "hand": [110, 73], "back": [60, 54, 1.15], "feet": [[43, 102], [77, 102]]}, "chaussette": {"hat": [60, 12, 0.87], "eyes": [60, 64, 0.9], "mouth": [60, 71, 0.7], "neck": [60, 82, 0.95], "hand": [98, 75], "back": [60, 50, 1.0], "feet": [[47, 102], [73, 102]]}, "piquant": {"hat": [60, 16, 1.0], "eyes": [60, 50, 0.95], "mouth": [60, 61, 0.8], "neck": [60, 82, 1.1], "hand": [106, 75], "back": [60, 52, 1.2], "feet": [[45, 100], [75, 100]]}, "moustache": {"hat": [60, 16, 1.0], "eyes": [60, 42, 1.1], "mouth": [60, 62, 1.0], "neck": [60, 86, 1.0], "hand": [108, 77], "back": [60, 52, 1.15], "feet": [[45, 102], [75, 102]]}, "yeuxtiges": {"hat": [60, 44, 0.8], "eyes": [60, 18, 1.9], "mouth": [60, 67, 0.9], "neck": [60, 88, 1.0], "hand": [108, 85], "back": [60, 66, 1.1], "feet": [[43, 104], [77, 104]]}, "patate": {"hat": [60, 20, 1.0], "eyes": [60, 50, 1.1], "mouth": [60, 60, 0.85], "neck": [60, 86, 1.0], "hand": [106, 76], "back": [60, 54, 1.15], "feet": [[45, 102], [75, 102]]}, "cornu": {"hat": [60, 25, 0.75], "eyes": [60, 52, 1.0], "mouth": [60, 64, 0.8], "neck": [60, 86, 1.0], "hand": [108, 81], "back": [60, 56, 1.15], "feet": [[45, 102], [75, 102]]}, "poilu": {"hat": [60, 17, 0.95], "eyes": [60, 52, 1.1], "mouth": [60, 62, 0.8], "neck": [60, 82, 1.0], "hand": [104, 79], "back": [60, 54, 1.1], "feet": [[45, 98], [75, 98]]}, "triangle": {"hat": [60, 16, 0.6], "eyes": [60, 58, 1.2], "mouth": [60, 73, 0.7], "neck": [60, 86, 1.2], "hand": [102, 73], "back": [60, 56, 1.1], "feet": [[41, 102], [79, 102]]}, "oreilles": {"hat": [60, 33, 0.8], "eyes": [60, 60, 1.0], "mouth": [60, 70, 0.75], "neck": [60, 88, 0.95], "hand": [94, 91], "back": [60, 62, 1.1], "feet": [[45, 102], [75, 102]]}, "bouche": {"hat": [60, 20, 1.0], "eyes": [60, 36, 1.25], "mouth": [60, 56, 1.0], "neck": [60, 82, 1.1], "hand": [108, 75], "back": [60, 52, 1.15], "feet": [[45, 100], [75, 100]]}, "gronez": {"hat": [60, 22, 0.95], "eyes": [60, 42, 1.27], "mouth": [60, 74, 0.9], "neck": [60, 88, 1.0], "hand": [106, 79], "back": [60, 56, 1.15], "feet": [[45, 102], [75, 102]]}, "donut": {"hat": [60, 20, 1.0], "eyes": [60, 40, 1.2], "mouth": [60, 70, 0.8], "neck": [60, 84, 1.1], "hand": [107, 75], "back": [60, 54, 1.2], "feet": [[45, 102], [75, 102]]}, "tripatte": {"hat": [60, 16, 1.0], "eyes": [60, 40, 1.0], "mouth": [60, 50, 0.8], "neck": [60, 70, 0.9], "hand": [102, 63], "back": [60, 44, 1.1], "feet": [[29, 100], [60, 101], [91, 100]]}, "coulong": {"hat": [60, 7, 0.6], "eyes": [60, 21, 0.65], "mouth": [60, 28, 0.45], "neck": [60, 50, 0.55], "hand": [102, 85], "back": [60, 64, 0.9], "feet": [[45, 102], [75, 102]]}, "deuxtetes": {"hat": [[42, 19, 0.6], [78, 19, 0.6]], "eyes": [[42, 34, 0.55], [78, 34, 0.55]], "mouth": [[42, 44, 0.4], [78, 45, 0.4]], "neck": [60, 86, 1.0], "hand": [105, 85], "back": [60, 66, 1.1], "feet": [[45, 102], [75, 102]]}, "gelee": {"hat": [60, 18, 0.7], "eyes": [60, 54, 1.1], "mouth": [60, 63, 0.8], "neck": [60, 82, 1.2], "hand": [104, 81], "back": [60, 56, 1.15], "feet": [[43, 102], [77, 102]]}, "fleur": {"hat": [60, 6, 0.9], "eyes": [60, 36, 0.65], "mouth": [60, 45, 0.5], "neck": [60, 70, 0.8], "hand": [90, 93], "back": [60, 60, 1.0], "feet": [[49, 102], [71, 102]]}, "goutte": {"hat": [60, 30, 0.75], "eyes": [60, 60, 1.0], "mouth": [60, 71, 0.8], "neck": [60, 88, 1.0], "hand": [102, 78], "back": [60, 62, 1.05], "feet": [[45, 102], [75, 102]]}, "oeuf": {"hat": [60, 16, 0.95], "eyes": [60, 54, 1.05], "mouth": [60, 67, 0.85], "neck": [60, 88, 1.0], "hand": [102, 76], "back": [60, 54, 1.1], "feet": [[45, 102], [75, 102]]}, "nuage": {"hat": [60, 24, 1.0], "eyes": [60, 54, 1.05], "mouth": [60, 66, 0.85], "neck": [60, 86, 1.1], "hand": [110, 76], "back": [60, 56, 1.2], "feet": [[45, 102], [75, 102]]}, "chabete": {"hat": [60, 24, 1.0], "eyes": [60, 50, 1.05], "mouth": [60, 66, 0.8], "neck": [60, 86, 1.05], "hand": [104, 76], "back": [60, 56, 1.1], "feet": [[45, 102], [75, 102]]}, "champi": {"hat": [60, 14, 1.15], "eyes": [60, 64, 0.85], "mouth": [60, 75, 0.7], "neck": [60, 86, 0.85], "hand": [92, 80], "back": [60, 50, 1.25], "feet": [[45, 102], [75, 102]]}, "fantome": {"hat": [60, 18, 1.05], "eyes": [60, 46, 1.1], "mouth": [60, 58, 0.8], "neck": [60, 80, 1.1], "hand": [102, 72], "back": [60, 52, 1.1], "feet": [[45, 102], [75, 102]]}, "etoile": {"hat": [60, 26, 0.7], "eyes": [60, 52, 0.9], "mouth": [60, 63, 0.75], "neck": [60, 80, 0.9], "hand": [102, 76], "back": [60, 56, 1.2], "feet": [[45, 102], [75, 102]]}, "robot": {"hat": [60, 22, 1.2], "eyes": [60, 46, 1.25], "mouth": [60, 74, 0.9], "neck": [60, 90, 1.15], "hand": [112, 74], "back": [60, 56, 1.25], "feet": [[45, 102], [75, 102]]}, "cactus": {"hat": [60, 12, 0.8], "eyes": [60, 40, 0.85], "mouth": [60, 51, 0.7], "neck": [60, 64, 0.8], "hand": [94, 72], "back": [60, 50, 0.95], "feet": [[45, 102], [75, 102]]}, "dino": {"hat": [60, 28, 1.0], "eyes": [60, 50, 1.05], "mouth": [60, 61, 0.85], "neck": [60, 86, 1.1], "hand": [106, 78], "back": [62, 56, 1.15], "feet": [[45, 102], [75, 102]]}, "dragon": {"hat": [60, 24, 1.0], "eyes": [60, 48, 1.05], "mouth": [60, 66, 0.8], "neck": [60, 86, 1.05], "hand": [104, 78], "back": [60, 56, 1.1], "feet": [[45, 102], [75, 102]]}, "licorne": {"hat": [60, 24, 1.0], "eyes": [60, 50, 1.05], "mouth": [60, 66, 0.8], "neck": [60, 86, 1.05], "hand": [104, 78], "back": [60, 56, 1.1], "feet": [[45, 102], [75, 102]]}, "astro": {"hat": [60, 24, 1.0], "eyes": [60, 52, 1.15], "mouth": [60, 67, 0.8], "neck": [60, 86, 1.05], "hand": [104, 78], "back": [60, 56, 1.1], "feet": [[45, 102], [75, 102]]}};
const COSM=[{"id": "casquette", "nom": "Casquette", "slot": "hat"}, {"id": "couronne", "nom": "Couronne", "slot": "hat"}, {"id": "hautdeforme", "nom": "Haut-de-forme", "slot": "hat"}, {"id": "bonnet", "nom": "Bonnet", "slot": "hat"}, {"id": "fete", "nom": "Chapeau de fête", "slot": "hat"}, {"id": "sorcier", "nom": "Chapeau de sorcier", "slot": "hat"}, {"id": "noeud", "nom": "Gros nœud", "slot": "hat"}, {"id": "aureole", "nom": "Auréole", "slot": "hat"}, {"id": "toque", "nom": "Toque de chef", "slot": "hat"}, {"id": "bandeau", "nom": "Bandeau", "slot": "hat"}, {"id": "rondes", "nom": "Lunettes rondes", "slot": "eyes"}, {"id": "soleil", "nom": "Lunettes de soleil", "slot": "eyes"}, {"id": "monocle", "nom": "Monocle", "slot": "eyes"}, {"id": "masque", "nom": "Masque de héros", "slot": "eyes"}, {"id": "coeur", "nom": "Lunettes cœur", "slot": "eyes"}, {"id": "moustachefausse", "nom": "Fausse moustache", "slot": "mouth"}, {"id": "echarpe", "nom": "Écharpe", "slot": "neck"}, {"id": "papillon", "nom": "Nœud papillon", "slot": "neck"}, {"id": "cravate", "nom": "Cravate", "slot": "neck"}, {"id": "perles", "nom": "Collier de perles", "slot": "neck"}, {"id": "medaille", "nom": "Médaille", "slot": "neck"}, {"id": "ballon", "nom": "Ballon", "slot": "hand"}, {"id": "baguette", "nom": "Baguette magique", "slot": "hand"}, {"id": "bouquet", "nom": "Bouquet", "slot": "hand"}, {"id": "glace", "nom": "Glace", "slot": "hand"}, {"id": "cape", "nom": "Cape", "slot": "back"}, {"id": "sac", "nom": "Sac à dos", "slot": "back"}, {"id": "ailes", "nom": "Ailes", "slot": "back"}, {"id": "baskets", "nom": "Baskets", "slot": "feet"}, {"id": "bottes", "nom": "Bottes", "slot": "feet"}, {"id": "chat", "nom": "Oreilles de chat", "slot": "hat"}, {"id": "antennes", "nom": "Antennes", "slot": "hat"}, {"id": "fleurette", "nom": "Fleurette", "slot": "hat"}, {"id": "chantier", "nom": "Casque de chantier", "slot": "hat"}, {"id": "lapin", "nom": "Oreilles de lapin", "slot": "hat"}, {"id": "pirate", "nom": "Chapeau de pirate", "slot": "hat"}, {"id": "cowboy", "nom": "Chapeau de cowboy", "slot": "hat"}, {"id": "crete", "nom": "Crête de punk", "slot": "hat"}, {"id": "diplome", "nom": "Toque de diplômé", "slot": "hat"}, {"id": "viking", "nom": "Casque de viking", "slot": "hat"}, {"id": "ampoule", "nom": "Ampoule « Eurêka »", "slot": "hat"}, {"id": "laurier", "nom": "Couronne de laurier", "slot": "hat"}, {"id": "cosmique", "nom": "Couronne cosmique", "slot": "hat"}, {"id": "cacheoeil", "nom": "Cache-œil", "slot": "eyes"}, {"id": "lunettes3d", "nom": "Lunettes 3D", "slot": "eyes"}, {"id": "ski", "nom": "Masque de ski", "slot": "eyes"}, {"id": "etoiles", "nom": "Lunettes étoiles", "slot": "eyes"}, {"id": "pixel", "nom": "Lunettes pixel « la classe »", "slot": "eyes"}, {"id": "sucette", "nom": "Sucette", "slot": "mouth"}, {"id": "bulle", "nom": "Bulle de chewing-gum", "slot": "mouth"}, {"id": "sifflet", "nom": "Sifflet", "slot": "mouth"}, {"id": "dents", "nom": "Dents de vampire", "slot": "mouth"}, {"id": "guidon", "nom": "Moustache en guidon", "slot": "mouth"}, {"id": "barbe", "nom": "Barbichette", "slot": "mouth"}, {"id": "bavoir", "nom": "Bavoir", "slot": "neck"}, {"id": "bandana", "nom": "Bandana", "slot": "neck"}, {"id": "clochette", "nom": "Collier à clochette", "slot": "neck"}, {"id": "collier", "nom": "Collier de fleurs", "slot": "neck"}, {"id": "chaine", "nom": "Chaîne en or", "slot": "neck"}, {"id": "fraise", "nom": "Collerette royale", "slot": "neck"}, {"id": "crayon", "nom": "Crayon", "slot": "hand"}, {"id": "livre", "nom": "Livre de cours", "slot": "hand"}, {"id": "loupe", "nom": "Loupe", "slot": "hand"}, {"id": "fiole", "nom": "Fiole de chimie", "slot": "hand"}, {"id": "parapluie", "nom": "Parapluie", "slot": "hand"}, {"id": "trophee", "nom": "Trophée", "slot": "hand"}, {"id": "epee", "nom": "Épée", "slot": "hand"}, {"id": "guitare", "nom": "Guitare", "slot": "hand"}, {"id": "flambeau", "nom": "Flambeau", "slot": "hand"}, {"id": "sceptre", "nom": "Sceptre étoilé", "slot": "hand"}, {"id": "cartable", "nom": "Cartable", "slot": "back"}, {"id": "carapace", "nom": "Carapace", "slot": "back"}, {"id": "ailespapillon", "nom": "Ailes de papillon", "slot": "back"}, {"id": "jetpack", "nom": "Jetpack", "slot": "back"}, {"id": "ailesdragon", "nom": "Ailes de dragon", "slot": "back"}, {"id": "sandales", "nom": "Sandales", "slot": "feet"}, {"id": "palmes", "nom": "Palmes", "slot": "feet"}, {"id": "patins", "nom": "Patins à roulettes", "slot": "feet"}, {"id": "fusees", "nom": "Bottes-fusées", "slot": "feet"}];
const BETES=[{"id": "cyclope", "nom": "Cyclope"}, {"id": "troisyeux", "nom": "Trois-yeux"}, {"id": "carre", "nom": "Carré"}, {"id": "chaussette", "nom": "Chaussette"}, {"id": "piquant", "nom": "Piquant"}, {"id": "moustache", "nom": "Moustachu"}, {"id": "yeuxtiges", "nom": "Yeux-tiges"}, {"id": "patate", "nom": "Patate"}, {"id": "cornu", "nom": "Cornu"}, {"id": "poilu", "nom": "Boule-poils"}, {"id": "triangle", "nom": "Triangle"}, {"id": "oreilles", "nom": "Grandes-oreilles"}, {"id": "bouche", "nom": "Grande-bouche"}, {"id": "gronez", "nom": "Gros-nez"}, {"id": "donut", "nom": "Donut-bête"}, {"id": "tripatte", "nom": "Tripatte"}, {"id": "coulong", "nom": "Cou-long"}, {"id": "deuxtetes", "nom": "Deux-têtes"}, {"id": "gelee", "nom": "Gélatine"}, {"id": "fleur", "nom": "Fleur-tête"}, {"id": "goutte", "nom": "Goutte"}, {"id": "oeuf", "nom": "Œuf"}, {"id": "nuage", "nom": "Nuage"}, {"id": "chabete", "nom": "Chabête"}, {"id": "champi", "nom": "Champi"}, {"id": "fantome", "nom": "Fantôme"}, {"id": "etoile", "nom": "Étoile"}, {"id": "robot", "nom": "Robot"}, {"id": "cactus", "nom": "Cactus"}, {"id": "dino", "nom": "Dino"}, {"id": "dragon", "nom": "Dragonnet"}, {"id": "licorne", "nom": "Licorne"}, {"id": "astro", "nom": "Astro-bête"}];
const SLOTS=[["hat","Chapeaux"],["eyes","Lunettes"],["mouth","Moustache"],["neck","Cou"],["hand","En main"],["back","Dans le dos"],["feet","Chaussures"]];
const cosSlot=Object.fromEntries(COSM.map(c=>[c.id,c.slot]));
const SW='stroke="'+INK+'" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" fill="none"';
function bestiole(id,cosm,size){
  cosm=cosm||[];size=size||120;const A=ANCH[id],by={};cosm.forEach(c=>by[cosSlot[c]]=c);
  const put=slot=>{const cid=by[slot];if(!cid||!A[slot])return"";let a=A[slot];if(!Array.isArray(a[0]))a=[a];
    return a.map(p=>`<use href="#cosm-${cid}" transform="translate(${p[0]} ${p[1]}) scale(${p[2]==null?1:p[2]})"/>`).join("");};
  return `<svg viewBox="-14 -44 148 182" width="${size}" height="${Math.round(size*182/148)}" aria-label="${id}"><g ${SW}>${put("back")}</g><use href="#bete-${id}" width="120" height="120"/><g ${SW}>${["feet","mouth","eyes","neck","hand","hat"].map(put).join("")}</g></svg>`;
}
return { INK, ANCH, COSM, BETES, SLOTS, cosSlot, SW, bestiole };
})();
const SH_RAR = { commun: { n: "Commun", i: 0 }, rare: { n: "Rare", i: 1 }, epique: { n: "Épique", i: 2 }, legendaire: { n: "Légendaire", i: 3 }, mythique: { n: "Mythique", i: 4 } };
const SH_RK = Object.keys(SH_RAR);
const SH_BT = [   // [id, rareté, prix, accroche]
  ["patate", "commun", 150, "Ronde, câline, increvable."],
  ["carre", "commun", 175, "Carré dans ses révisions."],
  ["chaussette", "commun", 200, "Toujours seule, jamais perdue."],
  ["goutte", "commun", 200, "Elle ne transpire jamais en contrôle."],
  ["triangle", "commun", 225, "Pointu sur les dates."],
  ["oeuf", "commun", 225, "Pas encore éclos, déjà curieux."],
  ["poilu", "commun", 250, "Une boule de poils studieuse."],
  ["nuage", "commun", 275, "La tête dans les nuages, mais attentif."],
  ["piquant", "commun", 300, "À ne pas prendre à rebrousse-poil."],
  ["cyclope", "rare", 600, "Il ne voit que ses fiches."],
  ["moustache", "rare", 700, "Une moustache, un style."],
  ["chabete", "rare", 750, "Ronronne quand il a tout bon."],
  ["oreilles", "rare", 800, "Il entend tes révisions."],
  ["champi", "rare", 850, "Pousse vite, surtout après la pluie de questions."],
  ["gronez", "rare", 900, "Un nez pour les bonnes réponses."],
  ["fantome", "rare", 950, "Il hante les révisions de dernière minute."],
  ["bouche", "rare", 1000, "Il réclame du travail."],
  ["etoile", "rare", 1100, "Elle brille à chaque bonne réponse."],
  ["cornu", "rare", 1200, "Les cornes de la réussite."],
  ["troisyeux", "epique", 2000, "Voit tes erreurs avant toi."],
  ["donut", "epique", 2400, "Un trou de mémoire ? Jamais."],
  ["robot", "epique", 2600, "Calcule plus vite que son ombre."],
  ["tripatte", "epique", 2800, "Trois pattes, zéro excuse."],
  ["cactus", "epique", 3000, "Piquant, mais pas méchant."],
  ["coulong", "epique", 3200, "Repère les contrôles de loin."],
  ["dino", "epique", 3400, "Ancien, mais toujours à jour."],
  ["yeuxtiges", "legendaire", 5000, "Garde un œil sur ta série."],
  ["deuxtetes", "legendaire", 6500, "Deux têtes valent mieux qu’une."],
  ["dragon", "legendaire", 7000, "Crache des bonnes réponses."],
  ["licorne", "legendaire", 7500, "Magique, et elle le sait."],
  ["gelee", "legendaire", 8000, "Souple, brillante, légendaire."],
  ["fleur", "mythique", 25000, "La mascotte ultime. Rarissime."],
  ["astro", "mythique", 30000, "Venue d’une autre galaxie. Encore plus rare que la Fleur."]
];
const SH_BETES = SH_BT.map(([id, rar, base, desc]) => ({ id, rar, base, desc, name: (BX.BETES.find(b => b.id === id) || {}).nom || id }));
const SH_CT = [   // [id, rareté, prix]
  ["casquette", "commun", 60], ["bonnet", "commun", 60], ["fete", "commun", 70], ["bandeau", "commun", 70], ["echarpe", "commun", 80], ["rondes", "commun", 80], ["ballon", "commun", 90], ["baskets", "commun", 100],
  ["hautdeforme", "rare", 220], ["noeud", "rare", 230], ["soleil", "rare", 250], ["papillon", "rare", 250], ["cravate", "rare", 270], ["moustachefausse", "rare", 280], ["glace", "rare", 290], ["bottes", "rare", 320], ["bouquet", "rare", 330], ["toque", "rare", 360],
  ["monocle", "epique", 600], ["medaille", "epique", 650], ["masque", "epique", 700], ["coeur", "epique", 750], ["perles", "epique", 800], ["sorcier", "epique", 850], ["sac", "epique", 900], ["cape", "epique", 1000],
  ["couronne", "legendaire", 1600], ["aureole", "legendaire", 1900], ["baguette", "legendaire", 2200], ["ailes", "legendaire", 2500],
  ["chat", "commun", 70], ["antennes", "commun", 60], ["fleurette", "commun", 70], ["chantier", "commun", 80], ["lapin", "rare", 260], ["pirate", "rare", 300], ["cowboy", "rare", 300], ["crete", "rare", 280], ["diplome", "epique", 700], ["viking", "epique", 900], ["ampoule", "epique", 800], ["laurier", "legendaire", 1800], ["cosmique", "mythique", 9000], ["cacheoeil", "commun", 70], ["lunettes3d", "rare", 240], ["ski", "rare", 320], ["etoiles", "epique", 750], ["pixel", "legendaire", 2000], ["sucette", "commun", 60], ["bulle", "commun", 60], ["sifflet", "commun", 70], ["dents", "rare", 260], ["guidon", "rare", 300], ["barbe", "epique", 650], ["bavoir", "commun", 60], ["bandana", "commun", 70], ["clochette", "commun", 90], ["collier", "rare", 340], ["chaine", "epique", 850], ["fraise", "legendaire", 1700], ["crayon", "commun", 60], ["livre", "commun", 80], ["loupe", "rare", 280], ["fiole", "rare", 300], ["parapluie", "rare", 340], ["trophee", "epique", 950], ["epee", "epique", 900], ["guitare", "legendaire", 2200], ["flambeau", "legendaire", 2400], ["sceptre", "mythique", 8000], ["cartable", "commun", 100], ["carapace", "rare", 380], ["ailespapillon", "epique", 1000], ["jetpack", "legendaire", 2500], ["ailesdragon", "mythique", 10000], ["sandales", "commun", 80], ["palmes", "rare", 260], ["patins", "epique", 800], ["fusees", "legendaire", 2100]
];
const SH_COS = SH_CT.map(([id, rar, base]) => { const c = BX.COSM.find(x => x.id === id) || {}; return { id, rar, base, name: c.nom || id, slot: c.slot }; });
const SH_SLOTN = Object.fromEntries(BX.SLOTS);
const SH_PERKS = [
  { id: "x2", name: "Cadeau ×2", desc: "Double ton prochain cadeau du jour.", base: 45, kind: "stock", max: 3, rar: "commun", ic: '<path d="M6 6l12 12M18 6L6 18"/>' },
  { id: "chance", name: "Trèfle porte-bonheur", desc: "Ton prochain cadeau vaudra entre 15 et 30 Lingo.", base: 35, kind: "stock", max: 3, rar: "commun", ic: '<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/>' },
  { id: "pocket", name: "Poche à gels", desc: "+1 emplacement de gel de série (3 au lieu de 2), à vie.", base: 600, kind: "perm", rar: "rare", ic: SH_SNOW },
  { id: "magnet", name: "Aimant à Lingo", desc: "+3 Lingo à chaque cadeau du jour, à vie.", base: 1500, kind: "perm", rar: "epique", ic: '<path d="M5 3v8a7 7 0 0014 0V3h-4v8a3 3 0 01-6 0V3z"/><path d="M5 7h4M15 7h4"/>' },
  { id: "card", name: "Carte de fidélité", desc: "−10 % sur tout dans la boutique, à vie.", base: 4000, kind: "perm", rar: "legendaire", ic: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>' },
  { id: "fifty", name: "Compétence 50/50", desc: "Retire 2 mauvaises réponses d'une question. En entraînement uniquement (jamais en ranked).", base: 30, kind: "stock", max: 5, rar: "commun", ic: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 8h4M12 12h4M12 16h4"/>' },
  { id: "skip", name: "Compétence Passer", desc: "Passe une question sans perdre de point. En entraînement uniquement (jamais en ranked).", base: 25, kind: "stock", max: 5, rar: "commun", ic: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>' },
  { id: "shield", name: "Bouclier de combo", desc: "Une erreur ne casse pas ton combo (à partir de ×3). Ne change que l'XP, jamais le rang.", base: 45, kind: "stock", max: 3, rar: "rare", ic: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>' }];
const SH_STOCK = { commun: 40, rare: 15, epique: 6, legendaire: 2, mythique: 1 };
const SH_DANCES = [   // [id, nom, rareté, prix, accroche, bras devant le corps] : volontairement chères
  { id: "wave", name: "Salut", rar: "commun", base: 400, front: false, desc: "Un petit coucou à tout le monde." },
  { id: "jacks", name: "Jumping jacks", rar: "commun", base: 500, front: false, desc: "Un peu de sport, ça fait du bien." },
  { id: "six7", name: "6-7", rar: "rare", base: 1000, front: false, desc: "Une main monte, l’autre descend." },
  { id: "robot", name: "Robot", rar: "rare", base: 1300, front: false, desc: "Bip. Boup. Bip." },
  { id: "sprinkler", name: "Sprinkler", rar: "epique", base: 2200, front: true, desc: "Tssk-tssk-tssk-tssk-tssk." },
  { id: "disco", name: "Disco", rar: "epique", base: 2800, front: false, desc: "Saturday night fever." },
  { id: "floss", name: "Floss", rar: "legendaire", base: 5000, front: true, desc: "Les hanches d’un côté, les bras de l’autre." },
  { id: "dab", name: "Dab", rar: "legendaire", base: 6000, front: true, desc: "Le geste. Tout le monde le connaît." },
  { id: "clap", name: "Bravo !", rar: "commun", base: 450, front: true, desc: "Clap clap clap, bien joué." },
  { id: "flex", name: "Muscles", rar: "commun", base: 500, front: false, desc: "Le cerveau, c’est un muscle." },
  { id: "rire", name: "Mort de rire", rar: "commun", base: 550, front: true, desc: "Trop drôle, il n’en peut plus." },
  { id: "shrug", name: "Bof", rar: "commun", base: 600, front: false, desc: "Ça dépend… comme en philo." },
  { id: "chicken", name: "Danse des canards", rar: "rare", base: 1100, front: false, desc: "Coin coin, les coudes en ailes." },
  { id: "hype", name: "Hourra !", rar: "rare", base: 1300, front: false, desc: "Les bras en l’air, ça y est, c’est réussi." },
  { id: "victory", name: "Victoire", rar: "rare", base: 1500, front: false, desc: "Saut de joie, bras en V." },
  { id: "twist", name: "Twist", rar: "epique", base: 2500, front: false, desc: "Les hanches font tout le travail." },
  { id: "swim", name: "Le crawl", rar: "epique", base: 2900, front: false, desc: "Il nage dans le bonheur." },
  { id: "headbang", name: "Headbang", rar: "epique", base: 3200, front: false, desc: "Comme au concert. Doucement la nuque." },
  { id: "moonwalk", name: "Moonwalk", rar: "legendaire", base: 6500, front: false, desc: "Il avance… en reculant." },
  { id: "spin", name: "Toupie", rar: "legendaire", base: 7000, front: false, desc: "Il tourne sur lui-même sans tomber." },
  { id: "tornade", name: "Tornade", rar: "mythique", base: 15000, front: false, desc: "La danse ultime. Elle donne le tournis." }];
const shDcur = sh => (sh.dn || []).includes(sh.dc) && SH_DANCES.some(d => d.id === sh.dc) ? sh.dc : "";
const shLimited = def => false;
const shMaxOf = def => shLimited(def) ? SH_STOCK[def.rar] || 0 : 0;
const shSk = key => key.replace(":", "_");
const shKey = k => k === "fz" ? ["fz", ""] : [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
const shPx = (p, sh) => (sh.pm || []).includes("card") ? Math.max(1, Math.round(p * SH.card)) : p;
const shFzMax = sh => SH.freezeMax + ((sh.pm || []).includes("pocket") ? 1 : 0);
const shMasc = sh => SH_BETES.some(b => b.id === sh.m) && (sh.mo || []).includes(sh.m) ? sh.m : "";
const shWorn = sh => (sh.ce || []).filter(c => (sh.co || []).includes(c));
const shEquipCos = (ce, id) => ce.filter(x => BX.cosSlot[x] !== BX.cosSlot[id]).concat(id);
function shDef(key) {
  if (key === "fz") return { key, type: "fz", id: "", name: "Gel de série", desc: "Sauve ta série du quiz du jour si tu rates une journée. Utilisé automatiquement.", base: SH.freezePrice, rar: "rare" };
  const [t, id] = shKey(key);
  if (t === "b") { const b = SH_BETES.find(x => x.id === id); return b && { key, type: "b", id, name: b.name, desc: b.desc, base: b.base, rar: b.rar }; }
  if (t === "c") { const c = SH_COS.find(x => x.id === id); return c && { key, type: "c", id, name: c.name, desc: SH_SLOTN[c.slot] || "", base: c.base, rar: c.rar }; }
  if (t === "d") { const d = SH_DANCES.find(x => x.id === id); return d && { key, type: "d", id, name: "Danse : " + d.name, desc: d.desc, base: d.base, rar: d.rar }; }
  if (t === "a") { const c = SH_COLORS.find(x => x.id === id); return c && { key, type: "a", id, name: "Teinte " + c.n, desc: "Colore ta bestiole et ton avatar.", base: c.p, rar: "commun", c: c.c }; }
  if (t === "p") { const p = SH_PERKS.find(x => x.id === id); return p && { key, type: "p", id, name: p.name, desc: p.desc, base: p.base, rar: p.rar, ic: p.ic, perk: p }; }
  return null;
}
function shOffers() {
  const r = shRng(DQ.today()), cs = SH_COLORS.slice();
  for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; }
  const W = { commun: 5, rare: 3, epique: 2, legendaire: 1, mythique: 0 };
  const pick = list => { const bag = []; list.forEach(x => { for (let k = 0; k < (W[x.rar] || 0); k++) bag.push(x); }); return bag[Math.floor(r() * bag.length)]; };
  const b = pick(SH_BETES), c = pick(SH_COS);
  const dz = pick(SH_DANCES), keys = ["b:" + b.id, "c:" + c.id, "d:" + dz.id, "a:" + cs[0].id, "a:" + cs[1].id, "fz"];
  const a = keys.map(k => { const d = shDef(k); return Object.assign({}, d, { price: d.base }); });
  const k = Math.floor(r() * a.length); a[k].promo = true; a[k].old = a[k].price; a[k].price = Math.max(1, Math.round(a[k].price * SH.promo));
  return a;
}
const SH_GATE_TYPES = { b: () => SH_BETES, c: () => SH_COS, d: () => SH_DANCES };
const SH_OWN_KEY = { b: "mo", c: "co", d: "dn" };
function shGate(key, sh) {   // null si l'article est libre, sinon { have, need }
  const [t, id] = shKey(key), L = SH_GATE_TYPES[t] && SH_GATE_TYPES[t](); if (!L) return null;
  const it = L.find(x => x.id === id); if (!it || it.rar !== "mythique") return null;
  const leg = L.filter(x => x.rar === "legendaire"), need = Math.min(3, leg.length), own = sh[SH_OWN_KEY[t]] || [];
  const have = leg.filter(x => own.includes(x.id)).length; return have >= need ? null : { have, need };
}
const SH_JUNK = ["Une chaussette trouée", "Un lacet sans chaussure", "De la poussière de craie", "Un post-it vide", "Un stylo sans encre", "Une gomme mâchouillée", "Une fiche illisible", "Un cours périmé", "Un trombone tordu", "Un ticket de cantine", "Un surligneur sec", "Un bout de copie double"];
const SH_BOXES = [   // t : [type, poids, …]  ·  junk = déchet · l = Lingo (min, max) · c / b = cosmétique / bestiole d'une rareté · p = boost · j = jackpot
  { id: "bois", name: "Caisse en bois", price: 90, rar: "commun", col: "#C98B4E", dur: 900, d: "Vieille, bancale, remplie de bric-à-brac.",
    t: [["junk", 36], ["l", 26, 18, 35], ["l", 16, 42, 70], ["c", 12, "commun"], ["p", 4], ["c", 4, "rare"], ["c", .8, "epique"]] },
  { id: "argent", name: "Caisse d’argent", price: 280, rar: "rare", col: "#BFC9D1", dur: 1300, d: "Plus solide. Plus tentante aussi.",
    t: [["junk", 25], ["l", 28, 70, 140], ["l", 17, 160, 245], ["c", 10, "commun"], ["c", 9, "rare"], ["b", 4, "commun"], ["p", 4], ["c", 2.5, "epique"], ["b", .5, "rare"]] },
  { id: "or", name: "Caisse en or", price: 700, rar: "legendaire", col: "#FFC933", dur: 1800, d: "La grosse mise. Elle fait rêver… et elle fait mal.",
    t: [["junk", 20], ["l", 30, 210, 420], ["l", 15, 455, 630], ["c", 12, "rare"], ["c", 8, "epique"], ["b", 5, "commun"], ["b", 5, "rare"], ["p", 2], ["c", 1.5, "legendaire"], ["b", 1, "epique"], ["b", .4, "legendaire"], ["j", .1, 1400]] }];
function shLootRoll(bx, u, u2, sh) {   // pur : même résultat si la transaction est rejouée
  const tot = bx.t.reduce((a, x) => a + x[1], 0); let x = u * tot, e = bx.t[bx.t.length - 1];
  for (const row of bx.t) { x -= row[1]; if (x < 0) { e = row; break; } }
  const k = e[0], pickOf = L => L[Math.min(L.length - 1, Math.floor(u2 * L.length))];
  if (k === "junk") return { k, name: pickOf(SH_JUNK), gain: 0, rar: "commun", dud: true };
  if (k === "l") { const n = e[2] + Math.floor(u2 * (e[3] - e[2] + 1)); return { k, name: "+" + n + " Lingo", gain: n, rar: n >= 350 ? "epique" : n >= 140 ? "rare" : "commun" }; }
  if (k === "j") return { k, name: "JACKPOT : +" + e[2] + " Lingo", gain: e[2], rar: "mythique" };
  if (k === "c") { const it = pickOf(SH_COS.filter(c => c.rar === e[2])), have = (sh.co || []).includes(it.id), ce = sh.ce || [];
    if (have) return { k, def: shDef("c:" + it.id), name: it.name, rar: it.rar, dup: true, gain: Math.round(it.base * .25) };
    return { k, def: shDef("c:" + it.id), name: it.name, rar: it.rar, gain: 0, patch: { co: (sh.co || []).concat(it.id), ce: ce.some(c => BX.cosSlot[c] === it.slot) ? ce : ce.concat(it.id) } }; }
  if (k === "b") { const it = pickOf(SH_BETES.filter(b => b.rar === e[2])), have = (sh.mo || []).includes(it.id);
    if (have) return { k, def: shDef("b:" + it.id), name: it.name, rar: it.rar, dup: true, gain: Math.round(it.base * .25) };
    return { k, def: shDef("b:" + it.id), name: it.name, rar: it.rar, gain: 0, patch: Object.assign({ mo: (sh.mo || []).concat(it.id) }, shMasc(sh) ? {} : { m: it.id }) }; }
  const st = SH_PERKS.filter(p => p.kind === "stock"), p = pickOf(st), n = (sh.pk || {})[p.id] || 0;
  if (n >= p.max) return { k, def: shDef("p:" + p.id), name: p.name, rar: "commun", dup: true, gain: 30 };
  return { k, def: shDef("p:" + p.id), name: p.name, rar: "commun", gain: 0, patch: { pk: Object.assign({}, sh.pk || {}, { [p.id]: n + 1 }) } };
}
function grantAddUnique(list, id) { return [...new Set([...(Array.isArray(list) ? list : []), id])]; }
function grantAllShopItems(shop) {
  const p = Object.assign({}, shop || {});
  p.mo = [...new Set([...(p.mo || []), ...SH_BETES.map(x => x.id)])];
  p.dn = [...new Set([...(p.dn || []), ...SH_DANCES.map(x => x.id)])];
  p.co = [...new Set([...(p.co || []), ...SH_COS.map(x => x.id)])];
  p.own = [...new Set([...(p.own || []), ...SH_COLORS.map(x => x.id)])];
  p.pm = [...new Set([...(p.pm || []), ...SH_PERKS.filter(x => x.kind === "perm").map(x => x.id)])];
  p.pk = Object.assign({}, p.pk || {}); SH_PERKS.filter(x => x.kind === "stock").forEach(x => { p.pk[x.id] = x.max; });
  p.freeze = Math.max(p.freeze || 0, 1);
  p.bd = DQ.today(); p.bi = grantAddUnique(p.bd === DQ.today() ? p.bi : [], "fz");
  if (!p.m && SH_BETES.length) p.m = SH_BETES[0].id;
  if (!p.dc && SH_DANCES.length) p.dc = SH_DANCES[0].id;
  if (!p.av && SH_COLORS.length) p.av = SH_COLORS[0].id;
  return p;
}
// Banque étendue (questions.json, rangée côté serveur) : mêmes filtres que le site
try {
  require("./_banque.json").forEach(q => DQ_BANK.push(q));   // banque intégrée + questions.json (déjà filtrée), dans le même ordre que l'ancien site
  DQ.reset();
} catch (e) { console.error("banque", e); }
module.exports = { shuffleArray, RK, RKS, rkSoloGoal, RK_DIF, rkLevel, rkBank, LG, DQ_KEY, DQ_DAYS, DQ_EPOCH, DQ_N, DQ_CATS, DQ, DQ_BANK, SH, SH_COLORS, SH_SNOW, SH_RAR, SH_RK, SH_BT, SH_BETES, SH_CT, SH_COS, SH_SLOTN, SH_PERKS, SH_STOCK, SH_DANCES, SH_GATE_TYPES, SH_OWN_KEY, SH_JUNK, SH_BOXES, BX, shRng, shRoll, shKey, shPx, shFzMax, shMasc, shDef, shOffers, shGate, shLimited, shMaxOf, shSk, shEquipCos, shWorn, shDcur, shLootRoll, grantAddUnique, grantAllShopItems };

// Génère api/_jeu.js : copie EXACTE (depuis index.html) des règles du jeu dont le serveur a besoin
// (rang RK, barèmes Lingo, quiz du jour, banque, boutique, caisses), pour que le serveur calcule
// exactement comme le site. À relancer après avoir modifié ces règles dans index.html :
//   node outils/extraire-jeu.js
const fs = require("fs"), path = require("path");
let acorn; try { acorn = require("acorn"); } catch (e) { acorn = require(process.env.ACORN || "acorn"); }

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const blocks = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const srcs = blocks.filter(b => b.length > 2000);

const WANT = new Set([
  "shuffleArray",
  "RK", "RKS", "rkSoloGoal", "RK_DIF", "rkLevel", "rkBank", "LG",
  "DQ_KEY", "DQ_DAYS", "DQ_EPOCH", "DQ_N", "DQ_CATS", "DQ", "DQ_BANK",
  "SH", "SH_COLORS", "SH_SNOW", "SH_RAR", "SH_RK", "SH_BT", "SH_BETES", "SH_CT", "SH_COS", "SH_SLOTN", "SH_PERKS", "SH_STOCK", "SH_DANCES",
  "SH_GATE_TYPES", "SH_OWN_KEY", "SH_JUNK", "SH_BOXES", "BX",
  "shRng", "shRoll", "shKey", "shPx", "shFzMax", "shMasc", "shDef", "shOffers", "shGate", "shLimited", "shMaxOf", "shSk", "shEquipCos", "shWorn", "shDcur",
  "shLootRoll", "grantAddUnique", "grantAllShopItems"
]);
const names = n => n.type === "FunctionDeclaration" ? [n.id.name] : n.type === "VariableDeclaration" ? n.declarations.map(d => d.id.name).filter(Boolean) : [];
const got = new Set(), parts = [];
for (const src of srcs) for (const n of acorn.parse(src, { ecmaVersion: "latest", sourceType: "script" }).body) {
  const ns = names(n);
  let take = ns.some(x => WANT.has(x));
  // LG.trOk = … ; (réglages ajoutés après la déclaration)
  if (!take && n.type === "ExpressionStatement" && n.expression.type === "SequenceExpression" === false) {
    const e = n.expression; const tgt = e.type === "AssignmentExpression" ? e.left : null;
    if (tgt && tgt.type === "MemberExpression" && tgt.object.name === "LG") take = true;
  }
  if (!take && n.type === "ExpressionStatement" && n.expression.type === "SequenceExpression")
    take = n.expression.expressions.every(e => e.type === "AssignmentExpression" && e.left.type === "MemberExpression" && e.left.object.name === "LG");
  if (take) { parts.push(src.slice(n.start, n.end)); ns.forEach(x => got.add(x)); }
}
const missing = [...WANT].filter(x => !got.has(x));
if (missing.length) { console.error("Introuvable dans index.html :", missing.join(", ")); process.exit(1); }

const out = `// ⚠️ FICHIER GÉNÉRÉ par outils/extraire-jeu.js à partir de index.html — ne pas modifier à la main.
// Règles du jeu partagées avec le site : le serveur calcule exactement comme lui.
/* eslint-disable */
const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const progDirty = () => {};
${parts.join("\n")}
// Banque étendue (questions.json, rangée côté serveur) : mêmes filtres que le site
try {
  require("./_banque.json").forEach(q => DQ_BANK.push(q));   // banque intégrée + questions.json (déjà filtrée), dans le même ordre que l'ancien site
  DQ.reset();
} catch (e) { console.error("banque", e); }
module.exports = { ${[...WANT].join(", ")} };
`;
fs.writeFileSync(path.join(root, "api", "_jeu.js"), out);
console.log("api/_jeu.js :", parts.length, "blocs,", Math.round(out.length / 1024), "Ko");

// Retour de Google après « Autoriser l'accès au Drive ». Range le jeton dans secrets/drive (lisible seulement par le serveur).
const crypto = require("crypto");
const L = require("./_lib");

const page = (res, ok, msg) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
  res.status(ok ? 200 : 400).send('<!doctype html><meta name="viewport" content="width=device-width"><body style="font:17px system-ui;background:#0b0b12;color:#fff;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><div style="font-size:48px">' + (ok ? "✅" : "❌") + '</div><p>' + msg + '</p><a href="/" style="color:#8ab4ff">Retour au site</a></div>');
};

module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, "https://x"), code = u.searchParams.get("code"), state = u.searchParams.get("state") || "";
    if (!code) return page(res, false, "Autorisation annulée.");
    const s = await L.secrets(true), [ts, sig] = state.split(".");
    const good = ts && sig && Date.now() - +ts < 600000 && Date.now() >= +ts &&
      crypto.timingSafeEqual(Buffer.from(sig.padEnd(64, "0").slice(0, 64)), Buffer.from(crypto.createHmac("sha256", Buffer.from(s.dataKey, "hex")).update("drive:" + ts).digest("hex")));
    if (!good) return page(res, false, "Lien expiré ou invalide. Relance la connexion depuis le site.");
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: "https://" + host + "/api/drive-callback", grant_type: "authorization_code" }) });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) { console.error("drive-callback", j); return page(res, false, "Google n'a pas donné l'accès. Réessaie."); }
    await L.fs().doc("secrets/drive").set({ refreshToken: j.refresh_token, connectedAt: Date.now() }, { merge: true });
    page(res, true, "Google Drive connecté. Les données du site y seront rangées, chiffrées.");
  } catch (e) { console.error(e); page(res, false, "Erreur serveur."); }
};

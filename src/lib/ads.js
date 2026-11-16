/* ============ VIDEO AD BREAK — Monetag (In-App Interstitial / Rewarded) ============
   Har 3rd chat question ke baad chat screen pe hi ek video ad chalta hai.

   SETUP (5 min, jab tum ready ho):
   1. https://monetag.com pe signup karo (email se)
   2. "Zones" → naya zone banao → format: "In-App Interstitial" (ya "Rewarded")
   3. Jo zone ID mile (numbers, e.g. 1234567) → niche MONETAG_ZONE me daalo
   4. index.html me Monetag jo script de wo paste karo, aise:
      <script src="https://<monetag-domain>/tag.js" data-zone="ZONE_ID" data-sdk="show_ZONE_ID" async></script>
      (script ka exact link Monetag dashboard me "Get code" me milega)

   NOTE: Jab tak MONETAG_ZONE empty hai → demo overlay dikhega (test mode) —
   UX preview ke liye, koi real ad nahi. Zone daalte hi REAL video ad chalega. */

export const MONETAG_ZONE = "12275698"; /* Monetag dashboard se mila — LIVE */

const EVERY_N = 3; /* har 3rd question ke baad ad */
let count = 0;

/* naya user question hua → ad break aaya? (Chat.jsx call karta hai) */
export function bumpChatCount() {
  count++;
  return count % EVERY_N === 0;
}

/* video ad chalao — promise complete hone pe chat wapas free */
export async function runVideoAd() {
  /* SDK async load hota hai — show_12275698 ke aane tak max ~3s ruko */
  const showFn = await waitShowFn();
  if (typeof showFn === "function") {
    /* REAL ad — Monetag SDK khud full-screen video + close handle karta hai */
    try { showFn(); return; } catch { /* SDK fail → demo pe gir jao */ }
  }
  await demoAd();
}

function waitShowFn() {
  const name = "show_" + MONETAG_ZONE;
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const f = typeof window !== "undefined" ? window[name] : null;
      if (typeof f === "function" || Date.now() - t0 > 3000) {
        clearInterval(iv);
        resolve(f);
      }
    }, 150);
  });
}

/* demo overlay (test mode) — jab zone connect nahi hai */
function demoAd() {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(); return; }
    const back = document.createElement("div");
    back.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(17,17,17,.93);display:flex;align-items:center;justify-content:center;padding:20px";
    const card = document.createElement("div");
    card.style.cssText = "max-width:420px;width:100%;background:var(--paper,#fff);border:4px solid var(--black,#111);box-shadow:10px 10px 0 var(--black,#111);padding:22px;text-align:center;font-family:inherit";
    card.innerHTML = `
      <div style="font-weight:900;font-size:1.05rem">📺 AD BREAK</div>
      <div style="font-size:.72rem;font-weight:700;opacity:.65;margin:6px 0 14px">TEST MODE — Monetag zone jodne par yahan REAL video ad chalega</div>
      <div style="height:170px;background:var(--cyan,#5EDFFF);border:3px solid var(--black,#111);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:2.4rem;margin-bottom:12px">🎬</div>
      <div style="font-weight:900;font-size:1.4rem">SKIP IN <span data-t>5</span>s</div>`;
    const btn = document.createElement("button");
    btn.style.cssText = "margin-top:12px;width:100%;padding:10px;border:3px solid var(--black,#111);box-shadow:4px 4px 0 var(--black,#111);background:var(--yellow,#FFDE59);font-weight:900;cursor:pointer;opacity:.4;pointer-events:none";
    btn.textContent = "CONTINUE →";
    card.appendChild(btn);
    back.appendChild(card);
    document.body.appendChild(back);

    let t = 5;
    const iv = setInterval(() => {
      t--;
      const el = card.querySelector("[data-t]");
      if (el) el.textContent = String(Math.max(0, t));
      if (t <= 0) {
        clearInterval(iv);
        btn.style.opacity = "1";
        btn.style.pointerEvents = "auto";
        btn.onclick = () => { back.remove(); resolve(); };
      }
    }, 1000);
  });
}

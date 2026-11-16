import { useEffect, useRef, useState } from "react";
import { sessionEmail, sessionUser, loadState, loadBuddy, saveBuddy } from "../lib/store.js";
import { geminiBuddyReply } from "../lib/gemini.js";
import { speakVoice, stopVoice, SR } from "../lib/voice.js";

/* phases: idle (wake-word sun rahi) → listen (student bol raha) → think → speak */
const EXIT = /\b(bye sakura|bye|stop|chup|band karo|so jao|goodbye|alvida)\b/i;
const WAKE = /sakura/i;

function contextFor(state) {
  const u = sessionUser() || {};
  const g = state.game || {};
  const nbs = state.notebooks || [];
  const topics = nbs
    .flatMap(nb => (nb.chat || []).filter(m => m.role === "user").map(m => m.text).filter(Boolean))
    .slice(-8);
  return `- naam: ${u.name || "dost"}
- level: ${g.xp || 0} XP, streak: ${g.streak || 0} din
- notebooks: ${nbs.length} (titles: ${nbs.map(nb => nb.title).slice(0, 5).join(", ") || "none yet"})
- recent topics jo student ne pooche: ${topics.length ? topics.join(" | ") : "kuch nahi poocha abhi"}`;
}

/* SVG anime chibi — blink + mouth talk + sway */
function SakuraFace({ thinking }) {
  return (
    <svg className="sakura-svg" viewBox="0 0 100 100" aria-hidden="true">
      <path className="hair-back" d="M50 8 C25 8 18 30 18 48 C18 66 24 84 30 90 L70 90 C76 84 82 66 82 48 C82 30 75 8 50 8 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      <path className="tail tail-l" d="M20 40 C8 46 6 66 12 82 C16 90 24 92 28 86 C22 74 20 58 24 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      <path className="tail tail-r" d="M80 40 C92 46 94 66 88 82 C84 90 76 92 72 86 C78 74 80 58 76 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      <circle cx="23" cy="44" r="5" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
      <circle cx="77" cy="44" r="5" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
      <ellipse cx="50" cy="52" rx="26" ry="27" fill="#FFE8D6" stroke="#111" strokeWidth="3" />
      <path className="bangs" d="M24 44 C24 24 38 14 50 14 C62 14 76 24 76 44 C70 36 64 33 58 34 C60 30 58 26 54 24 C48 28 38 30 30 40 C28 42 26 44 24 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      <g className="flower" transform="translate(70 30)">
        <circle r="3.2" fill="#FFDE59" stroke="#111" strokeWidth="1.5" />
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="0" cy="-6" rx="3" ry="4.6" fill="#FF5EA8" stroke="#111" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
      </g>
      <ellipse cx="34" cy="62" rx="5" ry="3" fill="#FFB6C8" opacity=".85" />
      <ellipse cx="66" cy="62" rx="5" ry="3" fill="#FFB6C8" opacity=".85" />
      <g className="eyes">
        <g className="eye">
          <ellipse cx="38" cy="53" rx="5.4" ry="6.8" fill="#111" />
          <circle cx="39.6" cy="50.6" r="1.9" fill="#fff" />
          <circle cx="36.6" cy="55.6" r="1" fill="#7CE38B" opacity=".9" />
        </g>
        <g className="eye">
          <ellipse cx="62" cy="53" rx="5.4" ry="6.8" fill="#111" />
          <circle cx="63.6" cy="50.6" r="1.9" fill="#fff" />
          <circle cx="60.6" cy="55.6" r="1" fill="#7CE38B" opacity=".9" />
        </g>
      </g>
      <path d="M33 43 Q38 40.5 43 43" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M57 43 Q62 40.5 67 43" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 58 l1.6 2.4" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
      <path className="mouth-closed" d={thinking ? "M45 67 Q50 64 55 67" : "M44 66 Q50 71 56 66"} fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse className="mouth-open" cx="50" cy="68" rx="5" ry="4" fill="#8B3A3A" stroke="#111" strokeWidth="2" />
      <path d="M34 96 L38 88 L50 94 L62 88 L66 96 Z" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
    </svg>
  );
}

export default function Sakura() {
  const email = sessionEmail();
  const [phase, setPhase] = useState("idle"); // idle | listen | think | speak
  const [caption, setCaption] = useState(""); // live voice captions (typing feature nahi — sirf mic feedback)
  const [micErr, setMicErr] = useState(false);
  const phaseRef = useRef("idle");
  const aliveRef = useRef(true);
  const recRef = useRef(null);
  const activatingRef = useRef(false); // wake double-fire guard
  const lastWakeRef = useRef(0); // heartbeat — recognition zinda hai?
  phaseRef.current = phase;

  useEffect(() => {
    const el = document.querySelector(".sakura-caption");
    if (el) el.scrollTop = el.scrollHeight;
  });

  function stopRec() {
    try { recRef.current?.abort?.(); } catch { /* */ }
    try { recRef.current?.stop?.(); } catch { /* */ }
    recRef.current = null;
  }

  function setP(p) { setPhase(p); phaseRef.current = p; }

  /* ---------- TTS wrapper: bolne ke baad next() chalta hai ---------- */
  function say(text, next) {
    setCaption(text);
    setP("speak");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setCaption("");
      next?.();
    };
    /* safety: onEnd kabhi na chale (blocked TTS) to loop hang na ho */
    const guard = setTimeout(finish, Math.min(35000, 4000 + text.length * 95));
    speakVoice(text, { onEnd: () => { clearTimeout(guard); finish(); } });
  }

  /* ---------- wake-word loop: "hey sakura" ka intezaar
     Chrome continuous rec ko ~60s baad kill kar deta hai →
     isliye SHORT cycles (continuous=false) + self-restart + watchdog ---------- */
  function wakeListen() {
    if (!SR || !aliveRef.current) { if (!SR) setMicErr(true); return; }
    if (recRef.current) return;
    lastWakeRef.current = Date.now();
    try {
      const r = new SR();
      recRef.current = r;
      r.lang = "en-IN";
      r.continuous = false; /* short cycle — Chrome kill nahi karega */
      r.interimResults = true;
      r.onresult = (e) => {
        lastWakeRef.current = Date.now();
        if (phaseRef.current !== "idle" || activatingRef.current) return;
        let text = "";
        for (const res of e.results) text += res[0].transcript;
        if (WAKE.test(text)) {
          activatingRef.current = true; // double-fire guard
          stopRec();
          recRef.current = null;
          activate(text);
          setTimeout(() => { activatingRef.current = false; }, 1500);
        }
      };
      r.onend = () => {
        recRef.current = null;
        lastWakeRef.current = Date.now();
        if (aliveRef.current && phaseRef.current === "idle" && !activatingRef.current) {
          setTimeout(() => { if (phaseRef.current === "idle" && !recRef.current) wakeListen(); }, 300);
        }
      };
      r.onerror = () => {
        /* no-speech / network / aborted → onend bhi fire hota hai, restart ho jayega */
        recRef.current = null;
      };
      r.start();
    } catch { setMicErr(true); recRef.current = null; }
  }

  /* ---------- activate: "hey sakura" mila ---------- */
  function activate(wakeText) {
    stopRec();
    const said = wakeText.replace(WAKE, "").replace(/\b(hey|ok|are|hello|hi)\b/gi, "").trim();
    const greet = said
      ? `Haan! 🌸 "${said.slice(0, 60)}" — main sun rahi hoon, bolo!`
      : `Hai main yahin hoon! 🌸 bolo, kya poochna hai?`;
    say(greet, () => userListen());
  }

  /* ---------- listen: student bol raha hai (ek utterance) ---------- */
  function userListen() {
    if (!SR || !aliveRef.current) { deactivate(); return; }
    setP("listen");
    setCaption("");
    stopRec();
    try {
      const r = new SR();
      recRef.current = r;
      r.lang = "en-IN";
      r.continuous = false;
      r.interimResults = true;
      let final = "";
      r.onresult = (e) => {
        let interim = "";
        for (const res of e.results) {
          if (res.isFinal) final += res[0].transcript;
          else interim += res[0].transcript;
        }
        setCaption("👂 " + (final || interim));
      };
      r.onend = () => {
        const t = final.trim();
        setCaption("");
        if (EXIT.test(t)) { deactivate(); return; }  // "bye sakura" → alvida bolo
        if (!t) {                                     // silence → chupke wapas wake mode
          setP("idle");
          wakeListen();
          return;
        }
        handleUser(t);
      };
      r.onerror = () => {                             // no-speech etc → wapas wake mode
        setCaption("");
        setP("idle");
        wakeListen();
      };
      r.start();
    } catch { deactivate(); }
  }

  function deactivate() {
    stopRec();
    if (!aliveRef.current) return;
    say("Chalo, main yahin hoon — 'Hey Sakura' bolo jab zaroorat ho! 🌸", () => {
      setP("idle");
      wakeListen();
    });
  }

  /* ---------- brain: doubt answer + question / evaluation ---------- */
  async function handleUser(t) {
    setP("think");
    const next = [...loadBuddy(email).msgs, { role: "user", text: t }];
    saveBuddy(email, { msgs: next.slice(-40) });
    try {
      const state = loadState(email);
      const { say: reply } = await geminiBuddyReply(next.slice(-14), contextFor(state));
      const all = [...loadBuddy(email).msgs, { role: "bot", text: reply }];
      saveBuddy(email, { msgs: all.slice(-40) });
      say(reply, () => userListen()); // jawab ke baad phir se suno (loop zinda)
    } catch {
      say("network ne dosti tod di 😅 thodi der baad 'Hey Sakura' bolna!", () => {
        setP("idle");
        wakeListen();
      });
    }
  }

  /* boot: wake listener TURANT start (gesture gate hataya) + TTS unlock + watchdog */
  useEffect(() => {
    aliveRef.current = true;
    if (SR) wakeListen(); else setMicErr("unsupported");
    /* Chrome TTS unlock: pehle interaction pe silent utterance */
    const prime = () => {
      try {
        if ("speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(" ");
          u.volume = 0;
          speechSynthesis.speak(u);
        }
      } catch { /* noop */ }
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    /* watchdog: rec chupchap mar gayi (koi onend nahi) → restart */
    const iv = setInterval(() => {
      if (!aliveRef.current || !SR) return;
      if (phaseRef.current === "idle" && (!recRef.current || Date.now() - lastWakeRef.current > 20000)) {
        stopRec();
        recRef.current = null;
        wakeListen();
      }
    }, 3000);
    return () => {
      aliveRef.current = false;
      clearInterval(iv);
      stopRec();
      stopVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls = "sakura phase-" + phase;

  return (
    <>
      {/* anime character — side mein khadi */}
      <div className={cls} title={micErr ? "mic blocked — browser permission do" : "hey Sakura bolo! 🌸"}>
        <span className="sakura-ring" />
        <SakuraFace thinking={phase === "think"} />
        <span className="sakura-tag">SAKURA</span>
        {phase === "listen" ? <span className="sakura-live">● LIVE</span> : null}
      </div>

      {/* live status pill — wake hint ya current phase */}
      <div className="sakura-hint">
        {phase === "listen" ? "👂 sun rahi hoon… bolo!"
          : phase === "think" ? "💭 soch rahi hoon…"
          : phase === "speak" ? "🔊 bol rahi hoon…"
          : micErr === "blocked" ? "🎙️ mic BLOCKED — address bar se permission do"
          : micErr ? "🎙️ mic chahiye — Chrome me kholo"
          : '🎧 "HEY SAKURA" bolo'}
      </div>
      {caption ? <div className="buddy-bubble sakura-caption">{caption}</div> : null}
    </>
  );
}

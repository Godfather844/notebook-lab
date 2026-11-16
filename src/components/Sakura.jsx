import { useEffect, useRef, useState } from "react";
import { sessionEmail, sessionUser, loadState, loadBuddy, saveBuddy } from "../lib/store.js";
import { geminiBuddyReply } from "../lib/gemini.js";
import { speakVoice, stopVoice, SR } from "../lib/voice.js";

const QUICK = [
  ["quiz", "🎯 Quiz le lo"],
  ["doubt", "🤔 Doubt hai"],
  ["plan", "📚 Aaj kya padhun?"],
  ["motivate", "💪 Motivate me"],
];

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

/* SVG anime chibi — blink + mouth talk + moods */
function SakuraFace({ listening, speaking, thinking }) {
  return (
    <svg className={"sakura-svg" + (listening ? " ear" : "")} viewBox="0 0 100 100" aria-hidden="true">
      {/* back hair */}
      <path className="hair-back" d="M50 8 C25 8 18 30 18 48 C18 66 24 84 30 90 L70 90 C76 84 82 66 82 48 C82 30 75 8 50 8 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      {/* twin tails */}
      <path className="tail tail-l" d="M20 40 C8 46 6 66 12 82 C16 90 24 92 28 86 C22 74 20 58 24 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      <path className="tail tail-r" d="M80 40 C92 46 94 66 88 82 C84 90 76 92 72 86 C78 74 80 58 76 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      {/* scrunchies */}
      <circle cx="23" cy="44" r="5" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
      <circle cx="77" cy="44" r="5" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
      {/* face */}
      <ellipse cx="50" cy="52" rx="26" ry="27" fill="#FFE8D6" stroke="#111" strokeWidth="3" />
      {/* bangs */}
      <path className="bangs" d="M24 44 C24 24 38 14 50 14 C62 14 76 24 76 44 C70 36 64 33 58 34 C60 30 58 26 54 24 C48 28 38 30 30 40 C28 42 26 44 24 44 Z" fill="#FF9BC4" stroke="#111" strokeWidth="3" />
      {/* hair flower */}
      <g className="flower" transform="translate(70 30)">
        <circle r="3.2" fill="#FFDE59" stroke="#111" strokeWidth="1.5" />
        {[0, 72, 144, 216, 288].map(a => (
          <ellipse key={a} cx="0" cy="-6" rx="3" ry="4.6" fill="#FF5EA8" stroke="#111" strokeWidth="1.5" transform={`rotate(${a})`} />
        ))}
      </g>
      {/* blush */}
      <ellipse cx="34" cy="62" rx="5" ry="3" fill="#FFB6C8" opacity=".85" />
      <ellipse cx="66" cy="62" rx="5" ry="3" fill="#FFB6C8" opacity=".85" />
      {/* eyes (blink CSS) */}
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
      {/* brows */}
      <path d="M33 43 Q38 40.5 43 43" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      <path d="M57 43 Q62 40.5 67 43" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" />
      {/* nose */}
      <path d="M50 58 l1.6 2.4" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
      {/* mouth — speaking pe open/close */}
      <path className="mouth-closed" d={thinking ? "M45 67 Q50 64 55 67" : "M44 66 Q50 71 56 66"} fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse className="mouth-open" cx="50" cy="68" rx="5" ry="4" fill="#8B3A3A" stroke="#111" strokeWidth="2" />
      {/* collar */}
      <path d="M34 96 L38 88 L50 94 L62 88 L66 96 Z" fill="#FFDE59" stroke="#111" strokeWidth="2.5" />
    </svg>
  );
}

export default function Sakura() {
  const email = sessionEmail();
  const [msgs, setMsgs] = useState(() => loadBuddy(email).msgs);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hear, setHear] = useState("");
  const [input, setInput] = useState("");
  const [handsFree, setHandsFree] = useState(false);
  const [muted, setMuted] = useState(false);
  const [bubble, setBubble] = useState(null);
  const areaRef = useRef(null);
  const recRef = useRef(null);
  const openRef = useRef(open);
  const handsRef = useRef(handsFree);
  const mutedRef = useRef(muted);
  openRef.current = open; handsRef.current = handsFree; mutedRef.current = muted;

  useEffect(() => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  function persist(next) {
    setMsgs(next);
    saveBuddy(email, { msgs: next.slice(-40) });
  }

  function greet() {
    const b = loadBuddy(email);
    if (!b.msgs.length) {
      const u = sessionUser() || {};
      const hello = `Kon'nichiwa ${u.name?.split(" ")[0] || "senpai"}! 🌸 main SAKURA hoon — tumhari anime study partner.\nMic dabao aur bolo, ya type karo. Quiz bhi khelete hain!`;
      persist([{ role: "bot", text: hello }]);
      if (!mutedRef.current) { setSpeaking(true); speakVoice(hello, { onEnd: () => setSpeaking(false) }); }
    }
  }

  /* proactive nudge (panel band ho to) */
  useEffect(() => {
    const TIPS = [
      "mic dabao aur bolo na 🌸",
      "ek quiz? 2 min ka 🎯",
      "streak mat todo! aao padhein 🔥",
      "aaj ka doubt kya hai? 👂",
      "bol do… main sun rahi hoon 😌",
    ];
    const iv = setInterval(() => {
      if (openRef.current || document.hidden) return;
      setBubble(TIPS[Math.floor(Math.random() * TIPS.length)]);
      setTimeout(() => setBubble(null), 5200);
    }, 42000);
    return () => clearInterval(iv);
  }, []);

  /* unmount pe mic/voice band */
  useEffect(() => () => { try { recRef.current?.stop?.(); } catch { /* */ } stopVoice(); }, []);

  function startListen() {
    if (!SR || busy || speaking) return;
    stopVoice();
    try {
      const r = new SR();
      recRef.current = r;
      r.lang = "en-IN";
      r.interimResults = true;
      r.continuous = false;
      let final = "";
      r.onresult = (e) => {
        let interim = "";
        for (const res of e.results) {
          if (res.isFinal) final += res[0].transcript;
          else interim += res[0].transcript;
        }
        setHear(final || interim);
      };
      r.onend = () => {
        setListening(false);
        setHear("");
        const t = final.trim();
        if (t) send(t);
      };
      r.onerror = () => { setListening(false); setHear(""); };
      r.start();
      setListening(true);
    } catch { setListening(false); setHear(""); }
  }

  function stopListen() {
    try { recRef.current?.stop?.(); } catch { /* */ }
    setListening(false); setHear("");
  }

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    stopVoice();
    setInput("");
    const next = [...loadBuddy(email).msgs, { role: "user", text: t }];
    persist(next);
    setBusy(true);
    try {
      const state = loadState(email);
      const { say } = await geminiBuddyReply(next.slice(-14), contextFor(state));
      persist([...loadBuddy(email).msgs, { role: "bot", text: say }]);
      setBusy(false);
      if (!mutedRef.current) {
        setSpeaking(true);
        speakVoice(say, {
          onEnd: () => {
            setSpeaking(false);
            if (handsRef.current && openRef.current) startListen(); /* hands-free loop */
          },
        });
      } else if (handsRef.current && openRef.current) {
        startListen();
      }
    } catch {
      persist([...loadBuddy(email).msgs, { role: "bot", text: "network ne dosti tod di 😅 phir se bolo!" }]);
      setBusy(false);
    }
  }

  const quick = (kind) => {
    const lines = {
      quiz: "Mujhe mere topics pe quiz do! Ek question poocho 🎯",
      doubt: "Ek doubt hai —",
      plan: "Aaj kya padhun? Mere recent topics dekh ke batao 📚",
      motivate: "Mujhe motivate karo 💪",
    };
    send(lines[kind]);
  };

  return (
    <>
      {/* anime character — floating */}
      <button
        className={"sakura" + (listening ? " is-listen" : "") + (speaking ? " is-speak" : "") + (busy ? " is-think" : "")}
        onClick={() => { setOpen(o => !o); stopVoice(); stopListen(); if (!open) greet(); }}
        title="Sakura se baat karo 🌸"
      >
        <span className="sakura-ring" />
        <SakuraFace listening={listening} speaking={speaking} thinking={busy} />
        <span className="sakura-tag">SAKURA</span>
        {!open && listening ? <span className="sakura-live">● LIVE</span> : null}
      </button>

      {/* live transcript (sunte waqt) */}
      {hear && !open ? <div className="buddy-bubble">👂 {hear}</div> : null}
      {bubble && !open && !hear ? (
        <div className="buddy-bubble" onClick={() => { setOpen(true); greet(); }}>{bubble}</div>
      ) : null}

      {/* voice panel */}
      {open ? (
        <div className="buddy-panel">
          <div className="buddy-head">
            <span className="buddy-head-face">🌸</span>
            <b>SAKURA</b>
            <small>{speaking ? "bol rahi hoon 🔊" : listening ? "sun rahi hoon 👂" : busy ? "soch rahi hoon…" : "voice assistant"}</small>
            <button className="buddy-x" onClick={() => { setOpen(false); stopVoice(); stopListen(); }}>✕</button>
          </div>
          <div className="buddy-area" ref={areaRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"buddy-msg " + (m.role === "user" ? "me" : "him")}>
                <div className="buddy-bubble-msg">{m.text}</div>
              </div>
            ))}
            {hear && listening ? <div className="buddy-msg me"><div className="buddy-bubble-msg live">👂 {hear}</div></div> : null}
            {busy ? <div className="buddy-msg him"><div className="buddy-bubble-msg typing"><i /><i /><i /></div></div> : null}
          </div>
          <div className="buddy-chips">
            {QUICK.map(([k, label]) => (
              <button key={k} className="buddy-chip" disabled={busy} onClick={() => quick(k)}>{label}</button>
            ))}
          </div>
          <div className="buddy-input-row">
            <button className={"mic-btn" + (listening ? " on" : "")} disabled={!SR || busy || speaking}
              title={SR ? "bol ke poochho" : "mic not supported — type karo"}
              onClick={() => (listening ? stopListen() : startListen())}>
              {listening ? "👂" : "🎤"}
            </button>
            <input className="nb-input buddy-input" value={input} placeholder="type ya mic se bolo…"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }} />
            <button className="btn btn--primary buddy-send" disabled={busy} onClick={() => send()}>⚡</button>
            <button className={"tgl" + (handsFree ? " on" : "")} title="hands-free: jawab ke baad mic auto-on"
              onClick={() => setHandsFree(h => !h)}>🔁</button>
            <button className={"tgl" + (muted ? " on" : "")} title={muted ? "voice off — sirf text" : "voice on"}
              onClick={() => { setMuted(m => !m); stopVoice(); }}>{muted ? "🔇" : "🔊"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useReducer, useRef, useState } from "react";
import { sessionEmail, sessionUser, loadState, loadBuddy, saveBuddy } from "../lib/store.js";
import { geminiBuddyReply } from "../lib/gemini.js";
import { go } from "../lib/helpers.js";

const QUICK = [
  ["quiz", "🎯 Quiz le lo"],
  ["doubt", "🤔 Doubt hai"],
  ["plan", "📚 Aaj kya padhun?"],
  ["motivate", "💪 Motivate me"],
];

const MOOD_FACE = { happy: "😊", excited: "🤩", thinking: "🤔", wink: "😉" };

function contextFor(state) {
  const u = sessionUser() || {};
  const g = state.game || {};
  const nbs = state.notebooks || [];
  const topics = nbs
    .flatMap(nb => (nb.chat || []).filter(m => m.role === "user").map(m => m.text).filter(Boolean))
    .slice(-8);
  const names = nbs.map(nb => nb.title).slice(0, 5);
  return `- naam: ${u.name || "dost"}
- level: ${g.xp || 0} XP, streak: ${g.streak || 0} din
- notebooks: ${nbs.length} (titles: ${names.join(", ") || "none yet"})
- recent topics jo student ne pooche: ${topics.length ? topics.join(" | ") : "kuch nahi poocha abhi"}`;
}

export default function Buddy() {
  const email = sessionEmail();
  const [msgs, setMsgs] = useState(() => loadBuddy(email).msgs);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState("happy");
  const [input, setInput] = useState("");
  const [bubble, setBubble] = useState(null); // proactive nudge
  const [, force] = useReducer(x => x + 1, 0);
  const areaRef = useRef(null);
  const openRef = useRef(open);
  openRef.current = open;

  /* auto-scroll */
  useEffect(() => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  /* panel khulte hi focus */
  useEffect(() => {
    if (open) force();
  }, [open]);

  function persist(next) {
    setMsgs(next);
    saveBuddy(email, { msgs: next.slice(-40) });
  }

  /* greeting — pehli baar panel kholo */
  function firstGreeting() {
    const b = loadBuddy(email);
    if (!b.msgs.length) {
      const u = sessionUser() || {};
      persist([{ role: "bot", text: `Oi ${u.name?.split(" ")[0] || "dost"}! 🤖 main DOODLE hoon — tumhara study robot.\nDoubt poocho, main quiz bhi khela sakta hoon! Kya scene hai?` }]);
    }
  }

  /* proactive nudges — panel band ho to beech-beech me baat kare */
  useEffect(() => {
    const TIPS = [
      "psst… ek doubt poocho na 🤖",
      "quiz karein? 2 min ka 🎯",
      "streak mat todo kal aana 🔥",
      "bhookh lagi? knowledge ki 😋",
      "poochho kya padha aaj… main check karunga 😈",
    ];
    const iv = setInterval(() => {
      if (openRef.current || document.hidden) return;
      setBubble(TIPS[Math.floor(Math.random() * TIPS.length)]);
      setTimeout(() => setBubble(null), 5200);
    }, 42000);
    return () => clearInterval(iv);
  }, []);

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    setInput("");
    const next = [...msgs, { role: "user", text: t }];
    persist(next);
    setBusy(true);
    setMood("thinking");
    try {
      const state = loadState(email);
      const { say, mood: m } = await geminiBuddyReply(next.slice(-14), contextFor(state));
      setMood(m);
      persist([...next, { role: "bot", text: say }]);
    } catch (err) {
      setMood("happy");
      persist([...next, { role: "bot", text: "network ne dosti tod di 😅 ek baar phir bhejo!" }]);
    }
    setBusy(false);
    force();
  }

  const quick = (kind) => {
    const lines = {
      quiz: "Mujhe mere topics pe quiz de! Ek question poocho 🎯",
      doubt: "Ek doubt hai —",
      plan: "Aaj kya padhun? Mere recent topics dekh ke batao 📚",
      motivate: "Mujhe motivate karo 💪",
    };
    send(lines[kind]);
  };

  return (
    <>
      {/* character — floating */}
      <button className={"buddy" + (busy ? " busy" : "") + " mood-" + mood} onClick={() => { setOpen(o => !o); if (!open) firstGreeting(); }} title="Doodle se baat karo">
        <span className="buddy-antenna" />
        <span className="buddy-screen">
          <i className="eye eye-l" /><i className="eye eye-r" />
          <i className="mouth" />
        </span>
        <span className="buddy-feet"><i /><i /></span>
        {!open && !bubble ? <span className="buddy-zzz">?</span> : null}
      </button>

      {/* proactive speech bubble */}
      {bubble && !open ? (
        <div className="buddy-bubble" onClick={() => { setOpen(true); firstGreeting(); }}>{bubble}</div>
      ) : null}

      {/* chat panel */}
      {open ? (
        <div className="buddy-panel">
          <div className="buddy-head">
            <span className="buddy-head-face">{busy ? "💭" : MOOD_FACE[mood]}</span>
            <b>DOODLE 🤖</b>
            <small>study buddy · live</small>
            <button className="buddy-x" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="buddy-area" ref={areaRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"buddy-msg " + (m.role === "user" ? "me" : "him")}>
                <div className="buddy-bubble-msg">{m.text}</div>
              </div>
            ))}
            {busy ? (
              <div className="buddy-msg him"><div className="buddy-bubble-msg typing"><i /><i /><i /></div></div>
            ) : null}
          </div>
          <div className="buddy-chips">
            {QUICK.map(([k, label]) => (
              <button key={k} className="buddy-chip" disabled={busy} onClick={() => quick(k)}>{label}</button>
            ))}
          </div>
          <div className="buddy-input-row">
            <input className="nb-input buddy-input" value={input} placeholder="Doodle se poochho…"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }} />
            <button className="btn btn--primary buddy-send" disabled={busy} onClick={() => send()}>⚡</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

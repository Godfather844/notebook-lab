import { useState, useReducer, useEffect } from "react";
import { sessionEmail, loadState, saveState } from "../lib/store.js";
import { uid, toast, go } from "../lib/helpers.js";
import { award, dailyBonus, celebrate } from "../lib/game.js";
import { Modal } from "../components/Chrome.jsx";

const COLORS = ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--purple)", "var(--green)"];
const EMOJIS = ["📓", "🚀", "🐸", "🦊", "🧪", "🎸", "🛸", "🧠"];
const LANGS = [["english", "🇬🇧 ENGLISH"], ["hinglish", "🔥 HINGLISH"], ["hindi", "🇮🇳 हिंदी"]];

export default function Home() {
  const email = sessionEmail();
  const [state] = useState(() => loadState(email));
  const [, force] = useReducer(x => x + 1, 0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [lang, setLang] = useState("english");

  /* roz aane pe: streak update + daily bonus (once/day) */
  useEffect(() => {
    const evts = dailyBonus(state);
    if (evts.length) { saveState(email, state); celebrate(evts); }
    window.dispatchEvent(new Event("nb-user"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openModal() {
    setTitle(""); setColor(COLORS[0]); setEmoji(EMOJIS[0]); setLang("english");
    setOpen(true);
  }

  function create() {
    const t = title.trim();
    if (!t) { toast("name your notebook first ⚡"); return; }
    const nb = {
      id: uid(), title: t, color, emoji, lang,
      chat: [{ role: "bot", text: "Hey! Ask me anything, or 📎 attach a PDF. Every reply gets a ❓ quiz chip — padho pehle, phir quiz! 🎨" }],
      created: Date.now(),
    };
    state.notebooks.unshift(nb);
    const evts = award(state, "notebook");
    saveState(email, state);
    celebrate(evts);
    window.dispatchEvent(new Event("nb-user"));
    force();
    setOpen(false);
    go(`/chat?nb=${nb.id}`);
  }

  const nbs = state.notebooks || [];
  return (
    <main className="screen">
      <section className="hero">
        <h1 className="hero-title">THINK<br /><span className="hero-accent">LOUD</span> ✦</h1>
        <p className="hero-sub">Ask. Attach a PDF. Get exam-ready answers & quizzes — powered by Gemini.</p>
      </section>

      <section className="notebook-section">
        <div className="section-head">
          <h2 className="section-title">YOUR NOTEBOOKS</h2>
          <button className="btn btn--primary" onClick={openModal}>+ CREATE NOTEBOOK</button>
        </div>
        <div className="notebook-grid">
          {nbs.map((nb, i) => {
            const topics = nb.chat.filter(m => m.role === "user").length;
            const arts = nb.chat.filter(m => m.role === "bot" && m.artifact).length;
            const last = [...nb.chat].reverse().find(m => m.role === "user");
            return (
              <article key={nb.id} className="nb-card" style={{ background: nb.color }} onClick={() => go(`/chat?nb=${nb.id}`)}>
                {i === 0 && nbs.length > 2 ? <span className="sticker">FRESH ⚡</span> : null}
                <div>
                  <span className="emoji">{nb.emoji}</span>
                  <h3>{nb.title}</h3>
                  <p className="desc">{topics ? "last: " + String(last?.text || "").slice(0, 26) : "no topics yet"}</p>
                </div>
                <div className="meta">
                  <span className="chip chip--n">{topics} TOPICS</span>
                  <span className="chip chip--s">{arts} ARTIFACTS</span>
                </div>
              </article>
            );
          })}
        </div>
        {nbs.length === 0 ? <p className="empty-note">No notebooks yet. Smash that <b>+ CREATE NOTEBOOK</b> button ☝️</p> : null}
      </section>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="modal-title">NEW NOTEBOOK ✦</h3>
        <div className="modal-row"><label>Name*</label>
          <input className="nb-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Biology crash course" autoFocus
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); create(); } }} /></div>
        <div className="modal-row"><label>Vibe colour</label>
          <div className="color-row">
            {COLORS.map(c => (
              <div key={c} className={"color-dot" + (c === color ? " sel" : "")} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div></div>
        <div className="modal-row"><label>Pick a mascot</label>
          <div className="emoji-row">
            {EMOJIS.map(e2 => (
              <button key={e2} className={"emoji-opt" + (e2 === emoji ? " sel" : "")} onClick={() => setEmoji(e2)}>{e2}</button>
            ))}
          </div></div>
        <div className="modal-row"><label>Chat & quiz language</label>
          <div className="emoji-row">
            {LANGS.map(([l, label]) => (
              <button key={l} className={"emoji-opt lang-opt" + (l === lang ? " sel" : "")} onClick={() => setLang(l)}>{label}</button>
            ))}
          </div></div>
        <p style={{ fontSize: ".75rem", fontWeight: 600, opacity: .7 }}>Inside you'll chat: ask questions or attach PDFs, then turn any reply into a quiz 🎯.</p>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn--primary" onClick={create}>CREATE ⚡</button>
        </div>
      </Modal>
    </main>
  );
}

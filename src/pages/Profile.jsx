import { useState, useReducer } from "react";
import { sessionUser, sessionEmail, GUEST_EMAIL, getUsers, saveUsers, loadState, logoutSession } from "../lib/store.js";
import { toast, go } from "../lib/helpers.js";
import { Modal } from "../components/Chrome.jsx";

const COLORS = ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--purple)", "var(--green)"];
const AVATARS = ["🧑‍🎓", "🦊", "🚀", "🐸", "🧪", "🧠", "🎸", "🛸", "🎒"];

export default function Profile() {
  const u = sessionUser();
  const email = sessionEmail();
  const [state] = useState(() => loadState(email));
  const [, force] = useReducer(x => x + 1, 0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(u?.name || "");
  const [emoji, setEmoji] = useState(u?.emoji || "🧑‍🎓");
  const [color, setColor] = useState(u?.color || "var(--yellow)");

  if (!u) return null;

  const days = Math.max(1, Math.ceil((Date.now() - (u.joined || Date.now())) / 86400000));
  const nbs = state.notebooks || [];
  const chats = nbs.reduce((a, nb) => a + nb.chat.filter(m => m.role === "user").length, 0);
  const quizzes = nbs.reduce((a, nb) => a + nb.chat.filter(m => m.artifact && m.artifact.kind === "quiz").length, 0);

  function save() {
    const users = getUsers();
    const me = users.find(x => x.email === u.email);
    if (!me) return;
    if (name.trim()) me.name = name.trim();
    me.emoji = emoji;
    me.color = color;
    saveUsers(users);
    window.dispatchEvent(new Event("nb-user"));
    setOpen(false);
    force();
    toast("profile updated ✦");
  }

  function logout() {
    logoutSession();
    window.dispatchEvent(new Event("nb-user"));
    go("/login");
    toast("logged out 👋 see you soon!");
  }

  return (
    <main className="screen">
      <section className="profile-wrap">
        <div className="profile-card">
          <div className="p-head" style={{ background: u.color || "var(--yellow)" }}>
            <span className="p-avatar">{u.emoji || "🧑‍🎓"}</span>
            <div className="p-id">
              <h2 className="p-name">{u.name}</h2>
              <p className="p-mail">{u.email === GUEST_EMAIL ? "guest session (data sirf is browser me)" : u.email}</p>
              <span className="chip chip--s">{u.email === GUEST_EMAIL ? "GUEST MODE" : `MEMBER SINCE ${new Date(u.joined).toLocaleDateString()}`}</span>
            </div>
          </div>
          <div className="p-stats">
            <div className="stat" style={{ "--c": "var(--yellow)" }}><b>{nbs.length}</b><span>NOTEBOOKS</span></div>
            <div className="stat" style={{ "--c": "var(--pink)" }}><b>{chats}</b><span>QUESTIONS</span></div>
            <div className="stat" style={{ "--c": "var(--cyan)" }}><b>{quizzes}</b><span>QUIZZES</span></div>
            <div className="stat" style={{ "--c": "var(--green)" }}><b>{days}</b><span>DAY STREAK</span></div>
          </div>
          <div className="p-actions">
            <button className="btn btn--primary" onClick={() => { setName(u.name); setEmoji(u.emoji || "🧑‍🎓"); setColor(u.color || "var(--yellow)"); setOpen(true); }}>✏️ EDIT PROFILE</button>
            <button className="btn btn--danger" onClick={logout}>🚪 LOGOUT</button>
          </div>
          <button className="btn btn--ghost p-back" onClick={() => go("/")}>← BACK TO LAB</button>
        </div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="modal-title">EDIT PROFILE ✦</h3>
        <div className="modal-row"><label>Name</label>
          <input className="nb-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="modal-row"><label>Avatar</label>
          <div className="emoji-row">
            {AVATARS.map(a2 => (
              <button key={a2} className={"emoji-opt" + (a2 === emoji ? " sel" : "")} onClick={() => setEmoji(a2)}>{a2}</button>
            ))}
          </div></div>
        <div className="modal-row"><label>Vibe colour</label>
          <div className="color-row">
            {COLORS.map(c => (
              <div key={c} className={"color-dot" + (c === color ? " sel" : "")} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div></div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn--primary" onClick={save}>SAVE ⚡</button>
        </div>
      </Modal>
    </main>
  );
}

import { useEffect, useState, useReducer } from "react";
import { sessionUser, sessionEmail, loadState, GUEST_EMAIL } from "../lib/store.js";
import { levelInfo } from "../lib/game.js";

export function ToastHost() {
  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer;
    const onToast = (e) => { setMsg(e.detail); setVisible(true); clearTimeout(timer); timer = setTimeout(() => setVisible(false), 2600); };
    window.addEventListener("nb-toast", onToast);
    return () => { window.removeEventListener("nb-toast", onToast); clearTimeout(timer); };
  }, []);
  return <div className="toast" hidden={!visible}>{msg}</div>;
}

export function TopBar() {
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    window.addEventListener("nb-user", tick);
    return () => window.removeEventListener("nb-user", tick);
  }, []);
  const u = sessionUser();
  const chip = u ? `${u.emoji || "🧑"} ${u.name.split(" ")[0].toUpperCase()}` : "🧑 PROFILE";
  /* live game chip — XP/level/streak (nb-user event pe refresh hota hai) */
  const st = loadState(sessionEmail());
  const info = levelInfo(st.game?.xp || 0);
  const streak = st.game?.streak || 0;
  return (
    <header className="topbar">
      <a id="logoBtn" className="logo sticker-tilt-left" href="#/">📓 NOTEBOOK<span>LAB</span></a>
      <nav className="topnav">
        <a className="nav-chip nav-chip--green game-chip" href="#/profile" title={`${info.name} · ${info.xp} XP · ${streak}-day streak`}>
          {streak ? `🔥${streak}` : "🔥"} · L{info.lvl} {info.name}
        </a>
        <a className="nav-chip nav-chip--purple" href="#/profile">{chip}</a>
      </nav>
    </header>
  );
}

export function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" id="modalOverlay">
      <div className="modal" role="dialog" aria-modal="true">
        {children}
        <button className="modal-x" onClick={onClose} title="close">✕</button>
      </div>
    </div>
  );
}

export { GUEST_EMAIL };

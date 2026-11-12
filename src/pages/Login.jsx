import { useState } from "react";
import { getUsers, saveUsers, findUser, loginSession, hashPass, GUEST_EMAIL } from "../lib/store.js";
import { pick, toast, go } from "../lib/helpers.js";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  function submit(e) {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr("sahi email daalo 📧"); return; }
    if (pass.length < 4) { setErr("password min 4 characters ka rakho 🔒"); return; }
    const users = getUsers();

    if (mode === "signup") {
      if (!name.trim()) { setErr("apna naam likho ✍️"); return; }
      if (users.some(u => u.email === em)) { setErr("ye email already registered hai — LOGIN karo"); return; }
      const nu = { name: name.trim(), email: em, pass: hashPass(pass), emoji: pick(["🧑‍🎓", "🦊", "🚀", "🐸", "🧪", "🧠", "🎸", "🛸"]), color: "var(--yellow)", joined: Date.now() };
      users.push(nu); saveUsers(users);
      loginSession(nu.email);
      window.dispatchEvent(new Event("nb-user"));
      go("/");
      toast(`welcome to the lab, ${nu.name.split(" ")[0]}! 💥`);
    } else {
      const u = findUser(em);
      if (!u || u.pass !== hashPass(pass)) { setErr("email ya password galat hai 😕"); return; }
      loginSession(u.email);
      window.dispatchEvent(new Event("nb-user"));
      go("/");
      toast(`wapas aane ke liye shukriya, ${u.name.split(" ")[0]}! ✦`);
    }
  }

  function guest() {
    const users = getUsers();
    let g = findUser(GUEST_EMAIL);
    if (!g) {
      g = { name: "Guest Explorer", email: GUEST_EMAIL, pass: "", emoji: "🎒", color: "var(--cyan)", joined: Date.now() };
      users.push(g); saveUsers(users);
    }
    loginSession(GUEST_EMAIL);
    window.dispatchEvent(new Event("nb-user"));
    go("/");
    toast("guest mode on — data is browser ke andar hi saved 🎒");
  }

  return (
    <main className="screen">
      <section className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">📓 NOTEBOOK<span>LAB</span></div>
          <p className="auth-tag">bold your research — every account gets its own notebooks 💥</p>
          <div className="auth-tabs">
            <button className={"auth-tab" + (mode === "login" ? " sel" : "")} onClick={() => { setMode("login"); setErr(""); }}>LOGIN</button>
            <button className={"auth-tab" + (mode === "signup" ? " sel" : "")} onClick={() => { setMode("signup"); setErr(""); }}>SIGN UP</button>
          </div>
          <form onSubmit={submit} autoComplete="off">
            {mode === "signup" && (
              <div className="modal-row"><label>NAME</label>
                <input className="nb-input" value={name} onChange={e => setName(e.target.value)} placeholder="your name…" /></div>
            )}
            <div className="modal-row"><label>EMAIL</label>
              <input className="nb-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="modal-row"><label>PASSWORD</label>
              <input className="nb-input" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="min 4 characters" /></div>
            <button className="btn btn--primary auth-big" type="submit">{mode === "login" ? "LOGIN ⚡" : "CREATE MY LAB ⚡"}</button>
            {err ? <p className="auth-err">{err}</p> : null}
            <button type="button" className="btn btn--ghost auth-guest" onClick={guest}>🎒 NO ACCOUNT? ENTER AS GUEST</button>
          </form>
        </div>
      </section>
    </main>
  );
}

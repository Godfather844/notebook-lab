import { useState } from "react";
import { fbSignup, fbLogin, fbGuest, fbErr } from "../lib/store.js";
import { toast, go } from "../lib/helpers.js";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr("sahi email daalo 📧"); return; }
    if (pass.length < 6) { setErr("password min 6 characters ka rakho 🔒"); return; }
    setBusy(true);
    setErr("");
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("apna naam likho ✍️"); setBusy(false); return; }
        await fbSignup(name, em, pass);
        toast(`welcome to the lab, ${name.trim().split(" ")[0]}! 💥`);
      } else {
        const u = await fbLogin(em, pass);
        const nice = u.email?.split("@")[0] || "dost";
        toast(`wapas aane ke liye shukriya, ${nice}! ✦`);
      }
      window.dispatchEvent(new Event("nb-user"));
      go("/");
    } catch (ferr) {
      setErr(fbErr(ferr));
    } finally {
      setBusy(false);
    }
  }

  async function guest() {
    if (busy) return;
    setBusy(true);
    try {
      await fbGuest();
      window.dispatchEvent(new Event("nb-user"));
      go("/");
      toast("guest mode on — data cloud me bhi safe 🎒");
    } catch (ferr) {
      setErr(fbErr(ferr));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <section className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">📓 NOTEBOOK<span>LAB</span></div>
          <p className="auth-tag">bold your research — account + data cloud me safe ☁️</p>
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
              <input className="nb-input" type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="min 6 characters" /></div>
            <button className="btn btn--primary auth-big" type="submit" disabled={busy}>
              {busy ? "⏳ HO RAHA HAI…" : (mode === "login" ? "LOGIN ⚡" : "CREATE MY LAB ⚡")}
            </button>
            {err ? <p className="auth-err">{err}</p> : null}
            <button type="button" className="btn btn--ghost auth-guest" onClick={guest} disabled={busy}>🎒 NO ACCOUNT? ENTER AS GUEST</button>
          </form>
        </div>
      </section>
    </main>
  );
}

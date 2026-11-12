import { useEffect, useReducer, useRef, useState } from "react";
import { TYPES, TYPE_ORDER, geminiChatReply, geminiArtifact } from "../lib/gemini.js";
import { sessionEmail, loadState, saveState } from "../lib/store.js";
import { uid, toast, extractPdfText, fileSizeStr, MAX_CTX_CHARS, go } from "../lib/helpers.js";
import { Modal } from "../components/Chrome.jsx";

/* quiz artifact — the only rendered kind (baaki data me safe rehte hain) */
function QuizArtifact({ a, onRetry, onSave }) {
  const [answered, setAnswered] = useState({});
  const [busy, setBusy] = useState(false);
  const qs = a.data.questions;
  const all = Object.keys(answered).length === qs.length;
  const correct = Object.entries(answered).filter(([qi, oi]) => qs[qi] && qs[qi].a === oi).length;

  return (
    <section className={"artifact" + (busy ? " regen" : "")}>
      <div className="artifact-head">
        <h3 className="artifact-title">{a.title || TYPES[a.kind].label}</h3>
        <span className="artifact-kind">{TYPES[a.kind].label} · GEMINI ✦</span>
        {a.ctx ? (
          <button className="artifact-retry" disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try { await onRetry(a); }
              catch (err) { toast("retry fail: " + (err.message || "unknown") + " — dobara try karo"); }
              finally { setBusy(false); }
            }}>
            {busy ? "⏳ NAYA QUIZ BAN RAHA HAI…" : "🔄 NEW QUIZ"}
          </button>
        ) : null}
        <button className="artifact-save" onClick={() => onSave(a)}>💾 SAVE .TXT</button>
      </div>
      <div className="artifact-body">
        <div>
          {qs.map((q, qi) => (
            <div className="quiz-item" key={qi}>
              <span className="quiz-q">{qi + 1}. {q.q}</span>
              {q.opts.map((o, oi) => {
                const done = answered[qi] !== undefined;
                const cls = "quiz-opt" + (done ? (oi === q.a ? " correct" : (oi === answered[qi] ? " wrong" : "")) : "");
                return (
                  <button key={oi} className={cls} disabled={done}
                    onClick={() => setAnswered(prev => ({ ...prev, [qi]: oi }))}>{o}</button>
                );
              })}
            </div>
          ))}
          <div className="quiz-score" hidden={!all}>
            SCORE: {correct}/{qs.length} {correct === qs.length ? "→ PERFECT 💥" : correct >= qs.length / 2 ? "→ not bad 😎" : "→ RETRY 🔁"}
          </div>
        </div>
      </div>
    </section>
  );
}

function artifactToText(a) {
  const L = [];
  try {
    switch (a.kind) {
      case "sticky": a.data.notes.forEach((n, i) => L.push(`[${i + 1}] ${n.head}\n${n.body}\n`)); break;
      case "video": L.push("STORYBOARD:\n" + a.data.frames.map(f => `  FR${f.n} — ${f.shot} (${f.dur}) ${f.caption}`).join("\n") + "\n\nSCRIPT:\n" + a.data.script); break;
      case "audio": L.push(a.data.transcript); break;
      case "quiz": a.data.questions.forEach((q, i) => L.push(`Q${i + 1}. ${q.q}\n   ${q.opts.join(" | ")}\n   ✓ ${q.opts[q.a]}\n`)); break;
      case "flash": a.data.cards.forEach((c, i) => L.push(`[${i + 1}] ${c.front} → ${c.back}\n`)); break;
      case "mind": a.data.branches.forEach(b => L.push(`${b.label}\n  · ${b.sub.join(" · ")}\n`)); break;
    }
  } catch { /* partial save ok */ }
  return L.join("\n");
}

export default function Chat({ bookId }) {
  const email = sessionEmail();
  const [state] = useState(() => loadState(email));
  const [, force] = useReducer(x => x + 1, 0);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(null); // { name, size, file }
  const [delOpen, setDelOpen] = useState(false);
  const pdfRef = useRef(null);
  const areaRef = useRef(null);
  const nb = state.notebooks.find(n => n.id === bookId) || null;

  useEffect(() => {
    if (nb) saveState(email, state);
    else toast("ye notebook nahi mili — home se kholo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  if (!nb) {
    return (
      <main className="screen">
        <section className="hero">
          <h1 className="hero-title">404 ✦</h1>
          <p className="hero-sub">Notebook not found.</p>
          <button className="btn btn--primary" onClick={() => go("/")}>← BACK TO LAB</button>
        </section>
      </main>
    );
  }

  const busy = () => nb.chat.some(m => m.typing);

  /* send question / pdf */
  async function sendMessage() {
    const text = input.trim();
    const file = pending;
    if (!text && !file) { toast("type something or attach a PDF ✍️"); return; }
    if (busy()) { toast("one moment — still generating ✨"); return; }
    setInput("");
    setPending(null);

    let pdfText = "";
    if (file) {
      const typingIdx = nb.chat.push({ role: "bot", typing: true, text: "reading PDF 📖…" }) - 1;
      nb.chat.push({ role: "user", text: "", file: file.name });
      saveState(email, state); force();
      try {
        pdfText = await extractPdfText(file.file);
        if (!pdfText) throw new Error("no selectable text found in this PDF (scanned image?) — try pasting key text instead");
      } catch (err) {
        nb.chat.splice(typingIdx, 2);
        saveState(email, state); force();
        toast(err.message);
        return;
      }
      nb.chat.splice(typingIdx, 1); // remove reading indicator; keep user msg
    } else {
      nb.chat.push({ role: "user", text });
    }

    nb.chat.push({ role: "bot", typing: true, text: "Gemini is writing…" });
    saveState(email, state); force();

    try {
      const { say, summary } = await geminiChatReply({
        text: text || (file ? "Summarize this PDF for studying." : ""),
        pdfText, fileName: file?.name, lang: nb.lang,
      });
      const typingIdx = nb.chat.findIndex(m => m.typing);
      const msg = {
        role: "bot", say, summary, options: true,
        ctx: `STUDENT INPUT: ${text || "(PDF: " + file.name + ")"}\nMATERIAL:\n${(pdfText ? pdfText.slice(0, MAX_CTX_CHARS) : summary)}`,
        topic: text || file.name.replace(/\.pdf$/i, ""),
      };
      nb.chat.splice(typingIdx, 1, msg);
    } catch (err) {
      const typingIdx = nb.chat.findIndex(m => m.typing);
      nb.chat.splice(typingIdx, 1, { role: "bot", error: true, text: err.message || "generation failed" });
    }
    saveState(email, state); force();
  }

  /* option chip → generate artifact from that message's context */
  async function generateForMsg(mi, kind) {
    const m = nb.chat[mi];
    if (!m || !m.summary) return;
    if (busy()) { toast("one moment — still generating ✨"); return; }
    nb.chat.push({ role: "bot", typing: true, text: `Gemini → ${TYPES[kind].label}…` });
    saveState(email, state); force();
    try {
      const { say, data } = await geminiArtifact(kind, m.ctx, m.topic || nb.title, nb.lang);
      const typingIdx = nb.chat.findIndex(x => x.typing);
      const art = { id: uid(), kind, title: `${TYPES[kind].label} — ${(m.topic || nb.title).slice(0, 22)}`, data, say, ctx: m.ctx, topic: m.topic };
      nb.chat.splice(typingIdx, 1, { role: "bot", artifact: art });
      toast(`${TYPES[kind].label} ready 🎉`);
      saveState(email, state); force();
    } catch (err) {
      const typingIdx = nb.chat.findIndex(x => x.typing);
      nb.chat.splice(typingIdx, 1, { role: "bot", error: true, text: err.message || "generation failed" });
    }
    saveState(email, state); force();
  }

  /* 🔄 NEW QUIZ — regenerate the artifact in place */
  async function retryArtifact(a) {
    if (busy()) { toast("one moment — still generating ✨"); return; }
    const fresh = await geminiArtifact(a.kind, a.ctx, a.topic || nb.title, nb.lang);
    a.data = fresh.data;
    a.say = fresh.say;
    a.__v = (a.__v || 0) + 1; // remount → fresh answered state
    saveState(email, state); force();
    toast("naya quiz ready 🎉");
  }

  function saveArtifact(a) {
    const name = (nb.title + " - " + (a.title || TYPES[a.kind].label)).replace(/[\\/*?:"<>|]/g, "_") + ".txt";
    const blob = new Blob([artifactToText(a)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
    toast("saved 💾");
  }

  function doDelete() {
    state.notebooks = state.notebooks.filter(n => n.id !== nb.id);
    saveState(email, state);
    setDelOpen(false);
    go("/");
    toast("deleted 💥");
  }

  const topics = nb.chat.filter(m => m.role === "user").length;

  return (
    <main className="screen">
      <button className="btn btn--ghost back-float" onClick={() => go("/")}>← BACK</button>
      <section className="nb-head">
        <div className="nb-title-wrap">
          <span className="nb-emoji big">{nb.emoji}</span>
          <h2 className="nb-title">{nb.title}</h2>
        </div>
        <span className="chip chip--n">{(nb.lang || "english").toUpperCase()}</span>
        <span className="chip chip--s">💬 {topics}</span>
        <button className="btn btn--danger" onClick={() => setDelOpen(true)}>🗑 DELETE</button>
      </section>

      <div className="chat-wrap">
        <div ref={areaRef} className="chat-area">
          {nb.chat.map((m, mi) => {
            if (m.role === "user") {
              return (
                <div key={mi} className="msg msg--user">
                  <div className="bubble">
                    {m.file ? (<>📄 <b>{m.file}</b><br />{m.text || "summarize this PDF"}</>) : m.text}
                  </div>
                </div>
              );
            }
            if (m.error) {
              return <div key={mi} className="msg msg--bot"><div className="bubble">⚠️ {m.text}</div></div>;
            }
            if (m.typing) {
              return (
                <div key={mi} className="msg msg--bot">
                  <div className="bubble typing"><i /><i /><i /></div>
                  <span className="typing-note">{m.text || "Gemini is thinking…"}</span>
                </div>
              );
            }
            if (m.summary) {
              return (
                <div key={mi} className="msg msg--bot">
                  <div className="bubble">
                    <div className="say">{m.say}</div>
                    <div className="summary">{m.summary}</div>
                    <span className="opt-label">now turn this into…</span>
                    <div className="opt-row">
                      {TYPE_ORDER.map(k => (
                        <button key={k} className="opt-chip" onClick={() => generateForMsg(mi, k)}>
                          {TYPES[k].icon} {TYPES[k].label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            if (m.artifact) {
              const a = m.artifact;
              return (
                <div key={mi} className="msg msg--bot">
                  <div className="bubble"><div className="say">{a.say || "Done ✦"}</div></div>
                  {TYPES[a.kind] && TYPE_ORDER.includes(a.kind) ? (
                    <QuizArtifact key={a.__v || 0} a={a} onRetry={retryArtifact} onSave={saveArtifact} />
                  ) : (
                    <div className="bubble">(ye artifact type abhi render nahi hota — data saved hai 🔒)</div>
                  )}
                </div>
              );
            }
            return (
              <div key={mi} className="msg msg--bot">
                <div className="bubble">{m.text}</div>
              </div>
            );
          })}
        </div>

        <div className="composer">
          {pending ? (
            <div className="file-preview">
              <span className="file-chip">📄 <span className="fname">{pending.name}</span> <small>{fileSizeStr(pending.size)}</small>
                <button className="fx" title="remove" onClick={() => setPending(null)}>✕</button></span>
            </div>
          ) : null}
          <div className="composer-row">
            <button className="attach-btn" title="attach PDF" onClick={() => pdfRef.current?.click()}>📎</button>
            <input ref={pdfRef} type="file" accept="application/pdf,.pdf" hidden
              onChange={e => {
                const f = e.target.files[0];
                if (!f) return;
                if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { toast("only PDFs for now 🙏"); return; }
                setPending({ name: f.name, size: f.size, file: f });
                e.target.value = null;
              }} />
            <input className="nb-input chat-input" value={input} placeholder="ask anything, or attach a PDF…"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }} />
            <button className="btn btn--primary send-btn" onClick={sendMessage}>SEND ⚡</button>
          </div>
        </div>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)}>
        <h3 className="modal-title">DELETE? 💣</h3>
        <p style={{ fontWeight: 600 }}>"{nb.title}" + whole chat will be gone. Forever is long.</p>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={() => setDelOpen(false)}>KEEP IT</button>
          <button className="btn btn--danger" onClick={doDelete}>DELETE 💥</button>
        </div>
      </Modal>
    </main>
  );
}

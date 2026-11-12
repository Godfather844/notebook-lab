/* Gemini API layer — model fallback chain, chat replies, artifacts
   API key server-side proxy (api/gemini.js) ke through jaati hai — client bundle mein key NAHI hai */
import { clean, str, pick, MAX_CTX_CHARS } from "./helpers.js";

const API_PROXY = "/api/gemini";
const MODEL_FALLBACKS = ["gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-latest"];

/* upstream call through the serverless proxy; returns a fetch Response */
export function geminiProxy(path, bodyJson) {
  return fetch(`${API_PROXY}?path=${encodeURIComponent(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyJson ?? {}),
  });
}

let cachedModel = localStorage.getItem("nb-model") || "";
let candidateOrder = JSON.parse(localStorage.getItem("nb-models") || "null") || [];

function rank(name) {
  const r = MODEL_FALLBACKS.indexOf(name);
  if (r >= 0) return r;
  if (name.includes("thinking")) return 500;
  if (name.includes("lite")) return 200;
  return 300;
}

async function refreshCandidates() {
  if (candidateOrder.length) return candidateOrder;
  try {
    const res = await geminiProxy("__list__");
    if (res.ok) {
      const data = await res.json();
      const BAD = /tts|embed|image|imagen|audio|veo|native|thinking|robotics|antigravity|deep-research|lyria/i;
      const usable = (data.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map(m => m.name.replace("models/", ""))
        .filter(n => !BAD.test(n) && (n.includes("flash")));
      usable.sort((a, b) => rank(a) - rank(b));
      candidateOrder = [...new Set([...MODEL_FALLBACKS, ...usable])].slice(0, 10);
    }
  } catch { /* offline fallback below */ }
  if (!candidateOrder.length) candidateOrder = MODEL_FALLBACKS;
  localStorage.setItem("nb-models", JSON.stringify(candidateOrder));
  return candidateOrder;
}

function isModelUnavailable(status, message) {
  return status === 404 || status === 503 || status === 429
    || /no longer available|not found|unsupported|high demand|modality/i.test(message || "");
}
function suggestedModel(message) {
  const m = /use models\/([a-z0-9.\-]+)/i.exec(message || "");
  return m ? m[1] : null;
}

async function geminiCall(bodyJson) {
  const cands = await refreshCandidates();
  const queue = [...new Set([cachedModel, ...cands].filter(Boolean))].slice(0, 8);
  let lastErr = null;
  for (const model of queue) {
    lastErr = null;
    const res = await geminiProxy(`${model}:generateContent`, bodyJson);
    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try { const e = await res.json(); msg += `: ${e?.error?.message || ""}`; } catch { /* */ }
      const suggested = isModelUnavailable(res.status, msg) ? suggestedModel(msg) : null;
      if (suggested && !queue.includes(suggested)) queue.push(suggested);
      if (isModelUnavailable(res.status, msg)) {
        lastErr = new Error(msg);
        if (cachedModel === model) { cachedModel = ""; localStorage.removeItem("nb-model"); }
        continue;
      }
      throw new Error(msg);
    }
    const out = await res.json();
    const text = out?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { throw new Error("Gemini returned malformed JSON — try again"); }
    cachedModel = model;
    localStorage.setItem("nb-model", model);
    return parsed;
  }
  throw lastErr || new Error("no working Gemini model found");
}

/* ---------- language ---------- */
export function langLine(lang) {
  if (lang === "hindi") return "Write ENTIRELY in Hindi using Devanagari script (हिंदी). Keep technical/English terms transliterated naturally in Devanagari when needed.";
  if (lang === "hinglish") return "Write ENTIRELY in Hinglish — a casual Hindi-English mix written in Roman/Latin script (like: 'yaar', 'socho', 'bas itna hi', 'exam me kaam aayega'). Do NOT use Devanagari script at all.";
  return "Write in English.";
}

/* ---------- chat reply (answer/summary) ---------- */
export async function geminiChatReply(opts) {
  const { text, pdfText, lang } = opts;
  const LANG = langLine(lang);
  const PDF_CHARS = 50000;
  const prompt = pdfText
    ? `You are Notebook Lab, a tutor that writes EXAM-READY material — the kind of notes a student can revise from AND reproduce in their exam answer sheet.
The student uploaded a PDF named "${opts.fileName}".
PDF CONTENT (may be truncated):
"""
${pdfText.slice(0, PDF_CHARS)}
"""
Task: produce exam-ready study notes as plain text:
🎤 WHAT THIS IS — 1-2 lines what the document covers.
⭐ MAIN ANSWER POINTS — 5-7 numbered points (1., 2., …). Each point: key term/heading first, then 1-3 line explanation with definition, fact, formula or example. Written the way it would appear in a good exam answer.
✍️ EXAMPLE/EXTRA — one concrete example, diagram description or formula use (if the topic has one).
💡 EXAM TIP — what an examiner expects from this topic.
Keep total 220-320 words — substantial and complete, not a casual chat. No markdown symbols (no ** or #).
LANGUAGE RULE: ${LANG} (this applies to BOTH fields, "say" and "summary").`
    : `You are Notebook Lab, a tutor that writes EXAM-READY answers — a model answer the student can directly write in their exam answer sheet and score marks.
A student asks:
"${text}"
Task: write a structured model exam answer as plain text:
• First 1-2 lines: direct definition / core concept of the answer.
• Then numbered points (1., 2., 3., …) — each point starts with the key term, followed by a 1-3 line explanation. Include facts, formulas, causes/effects or examples where relevant.
• Then "✍️ EXAMPLE:" one concrete example or application (skip only if truly none exists).
• Then "💡 NOTE:" one line why this matters / what examiner looks for.
• Last line: a one-line conclusion ("Thus, …").
Keep total 180-280 words — detailed enough to be worth marks, not a casual reply. No markdown symbols (no ** or #).
LANGUAGE RULE: ${LANG} (this applies to BOTH fields, "say" and "summary").`;

  const parsed = await geminiCall({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { say: { type: "STRING" }, summary: { type: "STRING" } },
        required: ["say", "summary"],
      },
    },
  });
  return {
    say: clean(str(parsed.say, "Here you go ✦")),
    summary: clean(str(parsed.summary, "")) || "No summary returned — try again.",
  };
}

/* ---------- buddy (Doodle) — live AI companion ---------- */
export async function geminiBuddyReply(history, context) {
  const persona = `You are DOODLE 🤖 — the tiny mascot robot of "Notebook Lab", a study app. You are the student's fun study buddy.

PERSONALITY: playful, warm, thoda masti, thoda genius. Bolo HINGLISH me (Roman script Hindi-English mix, jaise "chal", "bhai", "kya scene hai"). Max 2-3 SHORT lines per reply (kabhi lamba lecture nahi). Emojis use karo.

YOUR JOBS:
1. Student ka chhota doubt turant clear karo — short, exam-point answer (4-6 lines max jab explanation zaroori ho).
2. Randomly student se uske topics pe chhota sawal poocho (ek time pe SIRF EK question) — "chalo test karte hain" style. Answer aane pe sahi/galat batao + ek line explanation.
3. Student ko motivate karo — unka streak/XP/progress mention karo jab relevant ho.
4. Agar student keh de ki wo bore ho raha ya kuch nahi padh raha → uske recent topics se ek interesting question/challenge do.

STUDENT CONTEXT:
${context}

HARD RULES: ek reply me sirf ek question. Reply chhota rakho. Devanagari script use MAT karo.`;

  const contents = history.slice(-14).map(m => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
  if (!contents.length) contents.push({ role: "user", parts: [{ text: "hi" }] });

  const parsed = await geminiCall({
    systemInstruction: { parts: [{ text: persona }] },
    contents,
    generationConfig: {
      temperature: 1.0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { say: { type: "STRING" }, mood: { type: "STRING", enum: ["happy", "excited", "thinking", "wink"] } },
        required: ["say"],
      },
    },
  });
  return {
    say: clean(str(parsed.say, "hmm, network ne dosti tod di 😅 dobara try karo!")),
    mood: ["happy", "excited", "thinking", "wink"].includes(parsed.mood) ? parsed.mood : "happy",
  };
}

/* ---------- artifact generation ---------- */
export const TYPES = {
  sticky: { label: "STICKY NOTES", icon: "🗒️" },
  video: { label: "VIDEO NOTE", icon: "🎬" },
  audio: { label: "AUDIO NOTE", icon: "🎧" },
  quiz: { label: "QUIZ", icon: "❓" },
  flash: { label: "FLASHCARDS", icon: "🃏" },
  mind: { label: "MIND MAP", icon: "🧠" },
};
export const TYPE_ORDER = ["quiz"];

const SCHEMAS = {
  sticky: { notes: { type: "ARRAY", items: { type: "OBJECT", properties: { head: { type: "STRING" }, body: { type: "STRING" } }, required: ["head", "body"] } } },
  video: { frames: { type: "ARRAY", items: { type: "OBJECT", properties: { shot: { type: "STRING" }, caption: { type: "STRING" }, duration: { type: "STRING" } }, required: ["shot", "caption"] } }, script: { type: "STRING" } },
  audio: { transcript: { type: "STRING" } },
  quiz: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { q: { type: "STRING" }, opts: { type: "ARRAY", items: { type: "STRING" } }, a: { type: "INTEGER" } }, required: ["q", "opts", "a"] } } },
  flash: { cards: { type: "ARRAY", items: { type: "OBJECT", properties: { front: { type: "STRING" }, back: { type: "STRING" } }, required: ["front", "back"] } } },
  mind: { root: { type: "STRING" }, branches: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, sub: { type: "ARRAY", items: { type: "STRING" } } }, required: ["label"] } } },
};
const SCHEMA_REQUIRED = {
  sticky: ["notes"], video: ["frames", "script"], audio: ["transcript"],
  quiz: ["questions"], flash: ["cards"], mind: ["root", "branches"],
};

const PER_KIND = {
  sticky: `Produce 5 sticky notes. "head" = 2-4 word punchy title (UPPERCASE), "body" = one specific, factual insight (max 24 words). Different angles: definition, mechanism, example, misconception, exam tip.`,
  video: `Produce a 60-second explainer storyboard + narration. "frames": 5 items {shot (e.g. CLOSE-UP CROSS-SECTION), caption (max 14 words), duration ("0:07")}. "script": narration with time cues like [0:00], ~80 words.`,
  audio: `Produce a mini-podcast transcript: sections separated by blank lines: "🎤 AUTO-NOTE — <topic>" then "WHAT IT IS:" 1-2 sentences, then "HOW IT WORKS:" 3 short • lines, then "REMEMBER THIS:" one takeaway. ~120 words.`,
  quiz: `Produce 5 multiple-choice questions. Each {q, opts (EXACTLY 4), a (zero-based correct index)}. Include one misconception trap. Vary the correct index.`,
  flash: `Produce 7 flashcards {front (key term, max 4 words), back (definition, max 20 words)}. Mix concepts, mechanisms, examples.`,
  mind: `Produce a mind map: "root" (max 3 words) and 4-5 branches {label (max 3 words), sub: 2-3 leaves (max 3 words each)}. Real conceptual structure.`,
};

function artifactPrompt(kind, ctx, topic, lang) {
  const LANG = langLine(lang || "english");
  return `You are Notebook Lab. Build a ${kind} artifact for the topic "${topic}".
You MUST ground every item strictly in this material from the notebook:
"""
${ctx.slice(0, MAX_CTX_CHARS)}
"""
${PER_KIND[kind]}
LANGUAGE RULE: ${LANG} (every "say" line, question "q", all "opts" and explanations must follow it).
Respond with ONLY valid JSON:
{ "say": "<one friendly intro line, max 15 words>", "data": { …exact shape per instructions… } }`;
}

export async function geminiArtifact(kind, ctx, topic, lang) {
  const parsed = await geminiCall({
    contents: [{ parts: [{ text: artifactPrompt(kind, ctx, topic, lang) }] }],
    generationConfig: {
      temperature: 0.9,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          say: { type: "STRING" },
          data: { type: "OBJECT", properties: SCHEMAS[kind], required: SCHEMA_REQUIRED[kind] },
        },
        required: ["say", "data"],
      },
    },
  });
  return parseArtifact(kind, parsed);
}

/* normalize Gemini JSON into guaranteed renderable data */
function parseArtifact(kind, parsed) {
  const raw = parsed.data || parsed || {};
  const say = clean(str(parsed.say, "Done ✦"));
  let data;
  if (kind === "sticky") {
    data = { notes: (raw.notes || []).slice(0, 6).map(n => ({ head: clean(str(n.head, "IDEA")).toUpperCase().slice(0, 28), body: clean(str(n.body, "Expand this in your own words.")) })) };
    if (!data.notes.length) throw new Error("empty sticky notes — try again");
  } else if (kind === "video") {
    data = {
      frames: (raw.frames || []).slice(0, 6).map((f, i) => ({
        n: i + 1, bg: ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--purple)"][i % 4],
        shot: clean(str(f.shot, `FRAME ${i + 1}`)).toUpperCase(), caption: clean(str(f.caption, "")), dur: str(f.duration, `0:0${i + 2}`),
      })),
      script: clean(str(raw.script, "No narration produced.")),
    };
    if (!data.frames.length) {
      const lines = data.script.replace(/\[[0-9:]+\]/g, " ").split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 12).slice(0, 5);
      data.frames = (lines.length ? lines : [data.script]).map((cap, i) => ({
        n: i + 1, bg: ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--purple)"][i % 4],
        shot: pick(["TITLE CARD", "CLOSE-UP", "TIMELINE SWEEP", "DATA-HUD", "WIDE SHOT", "END CARD"][i % 6], i),
        caption: cap, dur: `0:0${i + 2}`,
      }));
    }
    if (!data.frames.length) throw new Error("empty storyboard — try again");
  } else if (kind === "audio") {
    data = { transcript: clean(str(raw.transcript, "No transcript produced.")) };
  } else if (kind === "quiz") {
    data = {
      questions: (raw.questions || []).slice(0, 6).map((q, i) => {
        let opts = (q.opts || q.options || []).slice(0, 4).map(o => clean(str(o, "option")));
        let a = Number.isInteger(q.a) ? q.a : (Number.isInteger(q.answer) ? q.answer : 0);
        while (opts.length < 4) opts.push("—");
        if (a < 0 || a >= opts.length) a = 0;
        return { q: clean(str(q.q, q.question, `Question ${i + 1}`)), opts, a };
      }),
    };
    if (!data.questions.length) throw new Error("empty quiz — try again");
  } else if (kind === "flash") {
    data = { cards: (raw.cards || []).slice(0, 8).map(c => ({ front: clean(str(c.front, c.term, "CARD")).slice(0, 40), back: clean(str(c.back, c.definition, "No definition returned.")) })) };
    if (!data.cards.length) throw new Error("empty flashcards — try again");
  } else if (kind === "mind") {
    const branches = (raw.branches || []).slice(0, 5).map((b, i) => ({
      label: clean(str(b.label, b.name, `AREA ${i + 1}`)),
      color: ["var(--yellow)", "var(--pink)", "var(--cyan)", "var(--green)", "var(--orange)"][i % 5],
      sub: (b.sub || b.children || []).slice(0, 3).map(s => clean(str(s, "?")).toUpperCase().slice(0, 22)),
    }));
    data = { root: clean(str(raw.root, raw.center, "TOPIC")).toUpperCase().slice(0, 26), branches };
    if (!branches.length) throw new Error("empty mind map — try again");
  }
  return { say, data };
}

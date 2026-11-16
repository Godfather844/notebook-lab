/* Sakura voice engine — mic (Web Speech) + voice playback (browser TTS, instant)
   NOTE: Gemini TTS (tts.js) latency-heavy hai — voice loop me browser voice use hoti hai */
export const SR = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices();
    return vs.find(v => /^hi/i.test(v.lang))
      || vs.find(v => /en[-_]IN/i.test(v.lang))
      || vs.find(v => /female|zira|samantha|heera|swara|kalpana/i.test(v.name))
      || null;
  } catch { return null; }
}

function speakBrowserWithEnd(text, onEnd) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
    u.rate = 1.08; u.pitch = 1.2; /* anime-ish bright voice */
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    speechSynthesis.speak(u);
  } catch { onEnd?.(); }
}

/* text → voice; onEnd = bolna khatam (hands-free loop isse resume hota hai)
   SPEED FIRST: browser ki native voice (zero network wait) — Gemini TTS 3-5s late karta hai */
export async function speakVoice(text, { onEnd } = {}) {
  speakBrowserWithEnd(text, onEnd);
}

export function stopVoice() {
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* noop */ }
}

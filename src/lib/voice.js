/* Sakura voice engine — mic (Web Speech) + voice playback (browser TTS, instant)
   Hindi voice: voices async load hote hain → cache + voiceschanged listener */
export const SR = typeof window !== "undefined"
  ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
  : null;

let voiceCache = [];
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const refresh = () => { try { voiceCache = speechSynthesis.getVoices() || []; } catch { /* */ } };
  refresh();
  try { speechSynthesis.addEventListener("voiceschanged", refresh); } catch { /* */ }
  /* kuch devices voices bahut late dete hain — poll bhi */
  setInterval(refresh, 2000);
}

function pickVoice() {
  const vs = voiceCache.length ? voiceCache : (() => { try { return speechSynthesis.getVoices() || []; } catch { return []; } })();
  /* Hindi voice sabse pehle (Google हिन्दी / hi-IN), warna Indian English */
  return vs.find(v => /^hi[\b_-]/i.test(v.lang) || /hindi/i.test(v.name))
    || vs.find(v => /en[-_]IN/i.test(v.lang))
    || vs.find(v => /female|zira|samantha|swara|heera|kalpana/i.test(v.name))
    || null;
}

function speakBrowserWithEnd(text, onEnd) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    else u.lang = "hi-IN"; /* Hinglish Roman script — hi engine pehle try hoga */
    u.rate = 1.02; u.pitch = 1.15;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    speechSynthesis.speak(u);
  } catch { onEnd?.(); }
}

/* text → voice; onEnd = bolna khatam (hands-free loop isse resume hota hai)
   SPEED FIRST: browser ki native voice (zero network wait) */
export async function speakVoice(text, { onEnd } = {}) {
  speakBrowserWithEnd(text, onEnd);
}

export function stopVoice() {
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* noop */ }
}

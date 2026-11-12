/* AUDIO GENERATION — Gemini TTS → real audio file (WAV), speechSynthesis fallback
   calls go through the serverless proxy — key never touches the client */
import { geminiProxy } from "./gemini.js";

const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];

async function geminiTTS(text) {
  let lastErr = null;
  for (const model of TTS_MODELS) {
    try {
      const res = await geminiProxy(`${model}:generateContent`, {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        },
      });
      if (!res.ok) { lastErr = new Error(`TTS ${res.status}`); continue; }
      const out = await res.json();
      const part = out?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!part) { lastErr = new Error("TTS returned no audio"); continue; }
      return { b64: part.inlineData.data, mime: part.inlineData.mimeType || "audio/L16;rate=24000" };
    } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error("TTS unavailable");
}

/* 16-bit mono LE PCM → WAV wrapper */
function pcmBase64ToWav(b64, sampleRate) {
  const bin = atob(b64);
  const len = bin.length;
  const buf = new ArrayBuffer(44 + len);
  const view = new DataView(buf);
  const wstr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); view.setUint32(4, 36 + len, true); wstr(8, "WAVE");
  wstr(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  wstr(36, "data"); view.setUint32(40, len, true);
  for (let i = 0; i < len; i++) view.setUint8(44 + i, bin.charCodeAt(i));
  return buf;
}

/* main entry: text → real audio file blob URL; falls back to browser voice
   returns { kind:"file", url, ext } | { kind:"browser" } */
export async function makeAudio(text) {
  try {
    const { b64, mime } = await geminiTTS(text);
    const rate = +(/rate=(\d+)/.exec(mime)?.[1] || 24000);
    const wav = pcmBase64ToWav(b64, rate);
    return { kind: "file", url: URL.createObjectURL(new Blob([wav], { type: "audio/wav" })), ext: "wav" };
  } catch {
    return { kind: "browser" };
  }
}

/* browser voice fallback (no file, direct playback) */
export function speakBrowser(text) {
  if (!("speechSynthesis" in window)) { return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 900));
    u.rate = 1.05; u.pitch = 1.08;
    speechSynthesis.speak(u);
  } catch { /* noop */ }
}

export function stopBrowserVoice() {
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch { /* noop */ }
}

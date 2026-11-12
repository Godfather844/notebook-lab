/* REAL VIDEO RENDER — AI scene images (Pollinations, no key)
   → Ken Burns motion → MediaRecorder → MP4/WebM
   voice-over: Gemini TTS mixed into the recording */
import { toast } from "./helpers.js";
import { geminiTTS, pcmBase64ToWav } from "./tts.js";

const IMG_CACHE = new Map();

function scenePromptFor(frame, i) {
  const words = String(frame.caption || "").replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2).slice(0, 14).join(" ");
  const shot = String(frame.shot || "").toLowerCase();
  return `flat 2D vector graphic poster, bold thick black outlines, solid bright flat colors yellow and pink and cyan, simple geometric shapes, poster art, no text no words no letters — scene: ${words}, ${shot}`;
}

function sceneSeed(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100000;
}

function fetchSceneImg(prompt) {
  const key = prompt;
  if (IMG_CACHE.has(key)) return Promise.resolve(IMG_CACHE.get(key));
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&seed=${sceneSeed(key)}`;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { IMG_CACHE.set(key, img); resolve(img); };
    img.onerror = () => { IMG_CACHE.delete(key); resolve(null); };
    img.src = url;
    setTimeout(() => { if (!img.complete) { img.src = ""; resolve(null); } }, 100000);
  });
}

function loanFrameImg(frames) {
  return Promise.all(frames.map((f, i) =>
    new Promise(res => setTimeout(() => fetchSceneImg(scenePromptFor(f, i)).then(img => { f._img = img; res(img); }), i * 1200))
  ));
}

function setVerse(f) {
  const C = { yellow: "#FFD93D", pink: "#FF6B9D", cyan: "#6FE7F5", purple: "#C9A7FF", green: "#A2F5A2", white: "#FFFFFF", black: "#111" };
  const k = (f.shot || "").toUpperCase();
  if (k.includes("TIMELINE") || k.includes("HISTORY")) return [C.yellow, C.pink];
  if (k.includes("DATA") || k.includes("CHART") || k.includes("HUD") || k.includes("STATS")) return [C.cyan, C.green];
  if (k.includes("CROSS") || k.includes("SECTION") || k.includes("ZOOM")) return [C.purple, C.pink];
  if (k.includes("TITLE") || k.includes("END") || k.includes("INTRO")) return [C.pink, C.yellow];
  if (k.includes("B-ROLL") || k.includes("MONTAGE") || k.includes("WIDE")) return [C.green, C.cyan];
  return [f.bg === "var(--pink)" ? C.pink : f.bg === "var(--cyan)" ? C.cyan : f.bg === "var(--purple)" ? C.purple : C.yellow, C.pink];
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/);
  let line = "", yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export function paintScene(ctx, frame, t, W, H, prog) {
  const [bg, accent] = setVerse(frame);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const anim = (t / 1000);
  const inSlide = Math.min(1, prog / 0.35);
  const slx = (1 - inSlide) * -60;
  ctx.save(); ctx.translate(slx, (1 - inSlide) * 20);
  const k = (frame.shot || "").toUpperCase();
  ctx.lineWidth = 5; ctx.strokeStyle = "#111";

  if (frame._img && frame._img.complete && frame._img.naturalWidth) {
    const iw = frame._img.naturalWidth, ih = frame._img.naturalHeight;
    const z = 1.06 + prog * 0.11;
    const base = Math.max(W / iw, H / ih) * z;
    const dw = iw * base, dh = ih * base;
    const sgnX = (frame.n || 1) % 2 ? 1 : -1, sgnY = (frame.n || 2) % 2 ? 1 : -1;
    const pnx = sgnX * (prog - 0.5) * 42, pny = sgnY * (prog - 0.5) * 28;
    ctx.drawImage(frame._img, (W - dw) / 2 + pnx, (H - dh) / 2 + pny, dw, dh);
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, W, 5); ctx.fillRect(0, H - 5, W, 5);
    ctx.fillRect(0, 0, 5, H); ctx.fillRect(W - 5, 0, 5, H);
  } else if (k.includes("TIMELINE") || k.includes("HISTORY")) {
    ctx.beginPath(); ctx.moveTo(60, H / 2); ctx.lineTo(W - 60, H / 2); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * (W - 200) / 4;
      const r = 14 + Math.sin(anim * 3 + i) * 4;
      ctx.fillStyle = i < Math.floor(prog * 5) ? accent : "#111";
      ctx.beginPath(); ctx.arc(x, H / 2, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "#111"; ctx.fillRect(80, 90, 240, 44); ctx.strokeRect(80, 90, 240, 44);
    ctx.fillStyle = accent; ctx.font = "bold 22px 'Space Grotesk', sans-serif"; ctx.fillText("TIMELINE", 100, 120);
  } else if (k.includes("DATA") || k.includes("CHART") || k.includes("HUD") || k.includes("STATS")) {
    for (let i = 0; i < 5; i++) {
      const h = (60 + ((i * 47) % 160)) * Math.min(1, prog * 3);
      const x = 100 + i * 130;
      ctx.fillStyle = i % 2 ? accent : bg; ctx.fillRect(x, H - 120 - h, 70, h); ctx.strokeRect(x, H - 120 - h, 70, h);
    }
    ctx.beginPath(); ctx.moveTo(60, H - 115); ctx.lineTo(W - 60, H - 115); ctx.stroke();
  } else if (k.includes("CROSS") || k.includes("SECTION") || k.includes("ZOOM")) {
    for (const [r, fill] of [[H * 0.42, bg], [H * 0.27, accent], [H * 0.14, bg]]) {
      ctx.fillStyle = fill; ctx.beginPath();
      ctx.arc(W / 2, H / 2 - 30, r + Math.sin(anim * 2.2) * 6, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 30, 10 + Math.sin(anim * 4) * 4, 0, 7); ctx.fill();
  } else if (k.includes("TITLE") || k.includes("END") || k.includes("INTRO")) {
    ctx.save(); ctx.translate(W / 2, H / 2 - 20); ctx.rotate(-0.02 + Math.sin(anim) * 0.01);
    ctx.fillStyle = "#111"; const tw = Math.min(W - 160, 560); ctx.fillRect(-tw / 2, -46, tw, 92); ctx.strokeRect(-tw / 2, -46, tw, 92);
    ctx.fillStyle = accent; ctx.font = "bold 34px 'Archivo Black', sans-serif"; ctx.textAlign = "center";
    ctx.fillText((frame.caption || "SCENE").toUpperCase().slice(0, 26), 0, 8); ctx.textAlign = "left";
    ctx.restore();
  } else if (k.includes("B-ROLL") || k.includes("MONTAGE") || k.includes("WIDE")) {
    for (const [ox, oy, rot, fill] of [[90, 60, -0.06, accent], [280, 130, 0.05, bg], [520, 40, 0.08, "#111"]]) {
      ctx.save(); ctx.translate(ox + Math.sin(anim + ox) * 6, oy); ctx.rotate(rot);
      ctx.fillStyle = fill; ctx.fillRect(0, 0, 230, 150); ctx.strokeRect(0, 0, 230, 150); ctx.restore();
    }
  } else {
    ctx.fillStyle = "#111"; ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 30, 90, 0, 7); ctx.fill(); ctx.stroke();
    for (const [dx, dy, col, phase] of [[150, -30, accent, 0], [-140, 60, accent, 2]]) {
      ctx.fillStyle = col; ctx.beginPath();
      ctx.arc(W / 2 + dx + Math.sin(anim + phase) * 18, H / 2 + dy + Math.cos(anim + phase) * 12, 26, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(W / 2 - 40, H / 2 - 90, 16, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  ctx.font = "bold 18px 'Space Grotesk', sans-serif";
  const badge = `FR•${String(frame.n || "").padStart(2, "0")} · ${(frame.shot || "SCENE").slice(0, 30)}`;
  const bw = ctx.measureText(badge).width + 24;
  ctx.fillStyle = "#fff"; ctx.fillRect(16, 16, bw, 34); ctx.strokeRect(16, 16, bw, 34);
  ctx.fillStyle = "#111"; ctx.fillText(badge, 28, 40);
  const tc = frame.dur || "";
  const tw2 = ctx.measureText(tc).width + 24;
  ctx.fillStyle = "#111"; ctx.fillRect(W - tw2 - 16, 16, tw2, 34);
  ctx.fillStyle = "#fff"; ctx.fillText(tc, W - tw2 - 4, 40);

  ctx.font = "bold 24px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#111";
  const cy0 = H - 40 - 2 * 32;
  ctx.fillRect(16, cy0 - 16, W - 32, 96);
  ctx.fillStyle = "#fff";
  wrapText(ctx, frame.caption || "", 34, cy0 + 16, W - 68, 32);

  ctx.fillStyle = "#FF6B9D"; ctx.fillRect(0, H - 8, W * Math.min(1, prog), 8);
  ctx.strokeStyle = "#111"; ctx.lineWidth = 4; ctx.strokeRect(0, H - 8, W, 8);
}

/* renders a real video; hooks: { setLabel, setFill, onDone(URL, ext) } */
export async function renderActualVideo(a, hooks) {
  const { setLabel, setFill, onDone } = hooks;
  if (typeof MediaRecorder === "undefined") { toast("video encoding not supported in this browser 😕"); return null; }
  const frames = a.data.frames;
  try {
    setLabel("🖼 1/3 — AI SCENE IMAGES…");
    setFill(4);
    const imgJob = loanFrameImg(frames);
    const pollImgs = setInterval(() => {
      const n = frames.filter(f => f._img).length;
      if (n) { setFill(4 + (n / frames.length) * 28); setLabel(`🖼 1/3 — AI SCENE ${n + 1}/${frames.length}…`); }
    }, 800);
    const imgs = await imgJob;
    clearInterval(pollImgs);
    setFill(32);
    const got = imgs.filter(Boolean).length;

    setLabel("🎙 2/3 — VOICE-OVER BAN RAHI HAI…");
    const narration = (a.data.script || "").replace(/\[[0-9:]+\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900) || frames.map(f => f.caption).join(". ");
    let audio = null;
    try { audio = await geminiTTS("Say this naturally, like an energetic explainer narrator: " + narration); }
    catch { /* voice optional */ }

    setLabel(got ? "🎬 3/3 — RENDER (AI visuals)…" : "🎬 3/3 — RENDER…");
    const W = 960, H = 540;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    const parseDur = (s) => { const m = /(\d+):(\d+)/.exec(s || ""); return m ? (+(m[1]) * 60 + +(m[2])) * 1000 : 6000; };
    const rawDurs = frames.map(f => Math.min(12000, Math.max(3000, parseDur(f.dur))));
    const scale = Math.min(1, 45000 / rawDurs.reduce((x, y) => x + y, 0) / 1) || 1;
    const durs = rawDurs.map(d => d * scale);
    const total = durs.reduce((x, y) => x + y, 0);

    let audioCtx = null, destStream = null, srcNode = null;
    if (audio) {
      try {
        const rate = /rate=(\d+)/.exec(audio.mime)?.[1] ? +/rate=(\d+)/.exec(audio.mime)[1] : 24000;
        audioCtx = new AudioContext();
        const wav = pcmBase64ToWav(audio.b64, rate);
        const buf = await audioCtx.decodeAudioData(wav);
        if (buf.duration > 1) {
          destStream = audioCtx.createMediaStreamDestination();
          srcNode = audioCtx.createBufferSource();
          srcNode.buffer = buf;
          srcNode.connect(destStream);
          srcNode.connect(audioCtx.destination);
        }
      } catch { destStream = null; }
    }

    const stream = canvas.captureStream(30);
    if (destStream && destStream.stream.getAudioTracks().length) {
      stream.addTrack(destStream.stream.getAudioTracks()[0]);
    }
    const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"]
      .find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => recorder.onstop = res);

    recorder.start(500);
    if (srcNode && audioCtx) srcNode.start(audioCtx.currentTime + 0.05);

    const start = performance.now();
    await new Promise(resolve => {
      function loop() {
        const t = performance.now() - start;
        let acc = 0, idx = 0;
        for (let i = 0; i < durs.length; i++) { if (t < acc + durs[i]) { idx = i; break; } acc += durs[i]; idx = i; }
        const prog = (t - acc) / durs[idx];
        paintScene(ctx, frames[idx], t, W, H, prog);
        setFill(Math.min(100, (t / total) * 100));
        setLabel(`🎬 RENDERING ${(Math.min(100, t / total) * 100) | 0}% — ${idx + 1}/${frames.length}`);
        if (t >= total + 200) return resolve();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
    recorder.stop();
    await stopped;
    if (audioCtx) audioCtx.close();
    const blob = new Blob(chunks, { type: mime });

    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const url = URL.createObjectURL(blob);
    setLabel("🎬 3/3 — DONE ✦");
    onDone && onDone(url, ext);
    return url;
  } catch (err) {
    toast("render failed: " + (err.message || "unknown"));
    return null;
  }
}

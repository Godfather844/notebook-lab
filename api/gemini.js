/* Vercel serverless function — Gemini API proxy.
   GEMINI_API_KEY env var mein rehti hai (server-side only),
   browser/file bundle mein key kabhi nahi jaati. */
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const PATH_RE = /^[a-z0-9][a-z0-9.\-]*(?::generateContent)?$/i;

export default async function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  const path = String(req.query.path || "");

  if (path === "__list__") {
    // GET-style model list (client calls with POST + empty body)
    try {
      const upstream = await fetch(`${GEMINI_BASE}/models`, {
        headers: { "x-goog-api-key": key },
      });
      const text = await upstream.text();
      res.status(upstream.status).setHeader("Content-Type", "application/json").send(text);
    } catch (err) {
      res.status(502).json({ error: String(err.message || err) });
    }
    return;
  }

  if (req.method !== "POST" || !PATH_RE.test(path)) {
    res.status(400).json({ error: "bad request" });
    return;
  }

  try {
    const upstream = await fetch(`${GEMINI_BASE}/models/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.status).setHeader("Content-Type", "application/json").send(text);
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) });
  }
}

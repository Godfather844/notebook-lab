/* tiny shared helpers */
export const LS_KEY = "notebook-lab-v3";
export const MAX_PDF_CHARS = 60000;
export const MAX_CTX_CHARS = 12000;

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
export function pick(arr, i = Math.floor(Math.random() * arr.length)) { return arr[i % arr.length]; }
export const clean = (s) => String(s).replace(/^[-•*]\s*/gm, "").replace(/\*\*?/g, "").trim();
export const str = (v, f = "") => (typeof v === "string" && v.trim() ? v.trim() : f);
export function fileSizeStr(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : b > 1024 ? (b / 1024).toFixed(0) + " KB" : b + " B"; }

/* toast — global event that ToastHost renders */
export function toast(msg) { window.dispatchEvent(new CustomEvent("nb-toast", { detail: String(msg) })); }

/* hash router helper */
export const go = (hash) => { window.location.hash = hash; };

/* pdf.js — extract selectable text */
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
export async function extractPdfText(file) {
  if (!window.pdfjsLib) throw new Error("PDF reader failed to load (offline?)");
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = Math.min(pdf.numPages, 60);
  let text = "";
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(" ") + "\n\n";
    if (text.length > MAX_PDF_CHARS) break;
  }
  return text.slice(0, MAX_PDF_CHARS).trim();
}

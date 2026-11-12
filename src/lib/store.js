/* accounts + per-user notebook storage (demo-local, browser storage) */
import { LS_KEY } from "./helpers.js";

export const USERS_KEY = "nb-users";
export const SESSION_KEY = "nb-session";
export const GUEST_EMAIL = "guest@lab.local";

export const hashPass = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h.toString(36) + "." + s.length; };
export function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } }
export function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
export function sessionEmail() { return localStorage.getItem(SESSION_KEY) || ""; }
export function findUser(email) { return getUsers().find(u => u.email === email) || null; }
export function sessionUser() { const e = sessionEmail(); return e ? findUser(e) : null; }
export function loginSession(email) { localStorage.setItem(SESSION_KEY, email); }
export function logoutSession() { localStorage.removeItem(SESSION_KEY); }

/* per-account notebook storage: notebook-lab-v3::email */
export function dataKey(email) { return `${LS_KEY}::${email}`; }
export function loadState(email) {
  if (!email) return { notebooks: [] };
  let own = null;
  try { own = JSON.parse(localStorage.getItem(dataKey(email))); } catch { own = null; }
  if (!own || !Array.isArray(own.notebooks)) {
    // first login → migrate legacy shared data once
    try {
      const legacy = JSON.parse(localStorage.getItem(LS_KEY));
      own = (legacy && Array.isArray(legacy.notebooks)) ? legacy : { notebooks: [] };
    } catch { own = { notebooks: [] }; }
  }
  own.notebooks?.forEach(nb => { nb.chat = (nb.chat || []).filter(m => !m.typing); });
  return own;
}
export function saveState(email, state) {
  if (!email) return;
  localStorage.setItem(dataKey(email), JSON.stringify(state));
}

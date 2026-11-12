/* accounts + per-user notebook storage
   Firebase Auth (cloud accounts) + Firestore sync (users/{uid} doc)
   localStorage = offline cache / mirror — app waise hi chalta hai, ab data cloud me bhi safe hai */
import { LS_KEY, pick } from "./helpers.js";
import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInAnonymously, signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export const USERS_KEY = "nb-users";
export const SESSION_KEY = "nb-session";
export const GUEST_EMAIL = "guest@lab.local";

/* module state: current firebase identity */
let me = null; // { uid, email }
let syncTimer = null;

export const hashPass = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h" + h.toString(36) + "." + s.length; };
export function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; } }
export function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }
export function sessionEmail() { return localStorage.getItem(SESSION_KEY) || ""; }
export function findUser(email) { return getUsers().find(u => u.email === email) || null; }
export function sessionUser() { const e = sessionEmail(); return e ? findUser(e) : null; }
export function loginSession(email) { localStorage.setItem(SESSION_KEY, email); }
export function logoutSession() { localStorage.removeItem(SESSION_KEY); }

/* per-account notebook cache: notebook-lab-v3::email */
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
  if (me && email === me.email) queueSync();
}

/* ---------- cloud sync (debounced push) ---------- */
function queueSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushState, 1200);
}
async function pushState() {
  if (!me) return;
  try {
    const state = loadState(me.email);
    await setDoc(doc(db, "users", me.uid),
      { notebooks: state.notebooks, updatedAt: serverTimestamp() },
      { merge: true });
  } catch { /* offline — localStorage cache me data safe hai, agli baar sync hoga */ }
}

/* ---------- profile helpers ---------- */
function guestEmail(uid) { return `anon-${uid.slice(0, 10)}@lab.local`; }

function ensureLocalUser(u, profile) {
  const users = getUsers();
  const email = u.email || guestEmail(u.uid);
  let rec = users.find(x => x.email === email);
  if (!rec) { rec = { email, joined: Date.now() }; users.push(rec); }
  if (profile?.name) rec.name = profile.name;
  if (!rec.name && u.displayName) rec.name = u.displayName;
  rec.emoji = profile?.emoji || rec.emoji || "🧑‍🎓";
  rec.color = profile?.color || rec.color || "var(--yellow)";
  saveUsers(users);
  loginSession(email);
  return rec;
}

async function downloadState(u) {
  const email = u.email || guestEmail(u.uid);
  let profile = null;
  let cloudNotebooks = null;
  try {
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
      profile = snap.data().profile || null;
      cloudNotebooks = Array.isArray(snap.data().notebooks) ? snap.data().notebooks : null;
    }
  } catch { /* offline: cache chalega */ }

  if (cloudNotebooks) {
    // cloud hi source of truth hai
    localStorage.setItem(dataKey(email), JSON.stringify({ notebooks: cloudNotebooks }));
  }
  const rec = ensureLocalUser(u, profile);
  // pehli baar login & cloud empty → local/legacy data cloud pe push karo
  if (!cloudNotebooks) {
    const local = loadState(email);
    try {
      await setDoc(doc(db, "users", u.uid), {
        profile: { name: rec.name, email, emoji: rec.emoji, color: rec.color, joined: rec.joined },
        notebooks: local.notebooks,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch { /* offline — queueSync baad me push karega */ }
  }
  return { email, profile: rec };
}

/* auth state subscribe — App boot pe use hota hai (Firebase session persist hota hai) */
export function subscribeAuth(cb) {
  return onAuthStateChanged(auth, async (u) => {
    if (u) {
      me = { uid: u.uid, email: u.email || guestEmail(u.uid) };
      await downloadState(u);
    } else {
      me = null;
    }
    cb(u ? me : null);
  });
}

/* ---------- auth actions (Login page) ---------- */
export function fbErr(err) {
  const c = err?.code || "";
  if (c.includes("email-already-in-use")) return "ye email already registered hai — LOGIN karo";
  if (c.includes("invalid-email")) return "sahi email daalo 📧";
  if (c.includes("weak-password")) return "password min 6 characters ka rakho 🔒";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "email ya password galat hai 😕";
  if (c.includes("too-many-requests")) return "bahut tries ho gaye — thodi der baad try karo ⏳";
  if (c.includes("network")) return "internet nahi chal raha — baad me try karo 📡";
  return "kuch gadbad ho gayi — dobara try karo (" + c + ")";
}

export async function fbSignup(name, email, pass) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  me = { uid: cred.user.uid, email: cred.user.email };
  const local = loadState(me.email); // pre-signup local kaam migrate ho jaye
  const profile = { name: name.trim(), email: me.email, emoji: pick(["🧑‍🎓", "🦊", "🚀", "🐸", "🧪", "🧠", "🎸", "🛸"]), color: "var(--yellow)", joined: Date.now() };
  try {
    await setDoc(doc(db, "users", me.uid), {
      profile,
      notebooks: local.notebooks,
      updatedAt: serverTimestamp(),
    });
  } catch { /* offline — baad me sync */ }
  ensureLocalUser(cred.user, profile);
  return cred.user;
}

export async function fbLogin(email, pass) {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
  me = { uid: cred.user.uid, email: cred.user.email };
  await downloadState(cred.user); // cloud → local mirror (go("/") se pehle complete)
  return cred.user;
}

export async function fbGuest() {
  const cred = await signInAnonymously(auth);
  me = { uid: cred.user.uid, email: guestEmail(cred.user.uid) };
  await downloadState(cred.user);
  return cred.user;
}

export async function fbLogout() {
  await signOut(auth);
  me = null;
  logoutSession();
}

export async function updateMeProfile({ name, emoji, color }) {
  const u = sessionUser();
  if (!u) return;
  const users = getUsers();
  const rec = users.find(x => x.email === u.email);
  if (rec) { if (name) rec.name = name; if (emoji) rec.emoji = emoji; if (color) rec.color = color; saveUsers(users); }
  if (me) {
    try {
      await setDoc(doc(db, "users", me.uid), {
        profile: { name: name || rec?.name, email: me.email, emoji: emoji || rec?.emoji, color: color || rec?.color },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch { /* offline — local mirror me save ho gaya */ }
  }
}

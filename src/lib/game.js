/* gamification engine — XP, levels, streaks, badges (sab user state ke andar → cloud sync free) */
import { toast } from "./helpers.js";

export const LEVELS = [
  { n: "PADHAKU 🐣", at: 0 },
  { n: "LEARNER ✏️", at: 100 },
  { n: "SCHOLAR 🎓", at: 300 },
  { n: "TOPPER 🏆", at: 600 },
  { n: "PROFESSOR 🧑‍🏫", at: 1000 },
];

export const XP_FOR = { question: 10, quiz: 25, quizdone: 20, perfect: 10, notebook: 15, daily: 20, artifact: 5 };

const dayStr = (d = new Date()) => d.toISOString().slice(0, 10);
const yesterdayStr = () => dayStr(new Date(Date.now() - 86400000));

export function defaultGame() { return { xp: 0, streak: 0, lastDay: "", daily: "", seen: [] }; }

/* derived study stats (badges inhi se bante hain) */
export function deriveStats(state) {
  const nbs = state.notebooks || [];
  return {
    notebooks: nbs.length,
    questions: nbs.reduce((a, nb) => a + (nb.chat || []).filter(m => m.role === "user").length, 0),
    quizzes: nbs.reduce((a, nb) => a + (nb.chat || []).filter(m => m.artifact && m.artifact.kind === "quiz").length, 0),
    artifacts: nbs.reduce((a, nb) => a + (nb.chat || []).filter(m => m.artifact).length, 0),
  };
}

export const BADGES = [
  { id: "first_blood", icon: "💉", name: "FIRST BLOOD", desc: "pehla question poocha", check: s => s.questions >= 1 },
  { id: "bookworm", icon: "📚", name: "BOOKWORM", desc: "5 notebooks banaye", check: s => s.notebooks >= 5 },
  { id: "curious", icon: "🤔", name: "CURIOUS CAT", desc: "25 questions pooche", check: s => s.questions >= 25 },
  { id: "quiz_master", icon: "🧠", name: "QUIZ MASTER", desc: "5 quizzes banaye", check: s => s.quizzes >= 5 },
  { id: "streak_3", icon: "🔥", name: "ON FIRE", desc: "3-day streak", check: (s, g) => g.streak >= 3 },
  { id: "streak_7", icon: "🌑", name: "UNSTOPPABLE", desc: "7-day streak", check: (s, g) => g.streak >= 7 },
  { id: "night_owl", icon: "🌙", name: "NIGHT OWL", desc: "raat 12–5 baje padha", check: (s, g) => (g.nightOwl || false) },
  { id: "xp_500", icon: "⚡", name: "HIGH VOLTAGE", desc: "500 XP tak pahuocha", check: (s, g) => g.xp >= 500 },
];

/* streak/day bookkeeping — har award pe call hota hai */
function touchDay(state, events) {
  const g = state.game;
  const today = dayStr();
  if (g.lastDay === today) return;
  const cont = g.lastDay === yesterdayStr();
  g.streak = cont ? (g.streak || 0) + 1 : 1;
  g.lastDay = today;
  events.push({ type: "streak", n: g.streak });
  const h = new Date().getHours();
  if (h >= 0 && h < 5) g.nightOwl = true;
}

/* award: XP do + streak update + badges unlock detect → events[] return */
export function award(state, kind, extra = 0) {
  if (!state.game) state.game = defaultGame();
  const g = state.game;
  const statsBefore = deriveStats(state);
  const seenBefore = new Set(g.seen || []);
  const lvlBefore = levelOf(g.xp);
  const events = [];

  touchDay(state, events);

  const xp = XP_FOR[kind] || 0;
  if (xp) {
    g.xp += xp + extra;
    events.push({ type: "xp", amount: xp + extra });
  }
  const lvlAfter = levelOf(g.xp);
  if (lvlAfter !== lvlBefore) events.push({ type: "level", name: LEVELS[lvlAfter].n, lvl: lvlAfter + 1 });

  const stats = deriveStats(state);
  for (const b of BADGES) {
    if (!seenBefore.has(b.id) && b.check(stats, g)) {
      g.seen = [...(g.seen || []), b.id];
      events.push({ type: "badge", badge: b });
    }
  }
  return events;
}

/* daily login bonus (Home/Chat pe once/day) */
export function dailyBonus(state) {
  if (!state.game) state.game = defaultGame();
  if (state.game.daily === dayStr()) return [];
  state.game.daily = dayStr();
  return award(state, "daily");
}

export function levelOf(xp) {
  let i = 0;
  for (let j = 0; j < LEVELS.length; j++) if (xp >= LEVELS[j].at) i = j;
  return i;
}

export function levelInfo(xp) {
  const i = levelOf(xp);
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const base = cur.at;
  const span = next ? next.at - base : 1;
  return { lvl: i + 1, name: cur.n, xp, next: next ? next.n : null, pct: next ? Math.min(100, Math.round(((xp - base) / span) * 100)) : 100, toNext: next ? next.at - xp : 0 };
}

/* events → UI celebration (toast + confetti) */
export function celebrate(events) {
  for (const e of events) {
    if (e.type === "level") { confetti(); toast(`🚀 LEVEL UP! ab tum ${e.name} ho (L${e.lvl})`); }
    else if (e.type === "badge") { confetti(60); toast(`${e.badge.icon} BADGE UNLOCKED: ${e.badge.name}`); }
    else if (e.type === "streak") { toast(`🔥 ${e.n}-day study streak!`); }
    else if (e.type === "xp") { /* chhota xp — silent (toast spam roko) */ }
  }
}

/* pure CSS/DOM confetti — koi dependency nahi */
export function confetti(n = 90) {
  try {
    const box = document.createElement("div");
    box.className = "confetti-box";
    const colors = ["#FFDE59", "#FF5EA8", "#5EDFFF", "#B388FF", "#7CE38B", "#111"];
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * .8 + "s";
      p.style.animationDuration = 1.8 + Math.random() * 1.4 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg) scale(${.6 + Math.random() * .9})`;
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3600);
  } catch { /* no-op */ }
}

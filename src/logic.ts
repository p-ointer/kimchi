import { byId, COMBOS, Traits } from "./data";
import { pick, GRADES, BOOM_GRADES, VERDICT, BOOM_VERDICT, TASTE_LINE, makeTitle } from "./names";

export type Bowl = Record<string, number>;
export const MAX_ITEMS = 14;
const KEYS: (keyof Traits)[] = ["spicy", "sweet", "salty", "sour", "umami", "ferment", "weird", "danger"];
export const TASTE_LABEL: Record<string, string> = { spicy: "맵기", sweet: "단맛", salty: "짠맛", sour: "신맛", umami: "감칠맛" };

export function total(bowl: Bowl): Traits {
  const s = Object.fromEntries(KEYS.map((k) => [k, 0])) as Traits;
  for (const [id, n] of Object.entries(bowl)) for (const k of KEYS) s[k] += byId[id][k] * n;
  return s;
}
export const count = (b: Bowl) => Object.values(b).reduce((a, c) => a + c, 0);

export type Result = {
  title: string; note: string; stars: number; boom: boolean; days: number; ferment: number;
  taste: Record<string, number>; weird: number; danger: number; badges: string[]; combo?: string; grade: string; verdict: string; total: number;
};


export function grade(t: number, boom: boolean) {
  if (boom) return pick(BOOM_GRADES);
  return pick(GRADES.find(([m]) => t >= m)![1]);
}
export function verdict(w: number, boom: boolean) {
  if (boom) return pick(BOOM_VERDICT);
  return pick(VERDICT.find(([m]) => w <= m)![1]);
}

// 단계별 점수: salt(0~1), rub(0~1), days
export function judge(bowl: Bowl, saltScore: number, rubScore: number, days: number, luck: number): Result {
  const tr = total(bowl);
  const n = Math.max(1, count(bowl));
  const ids = Object.keys(bowl);
  const combo = COMBOS.filter((c) => c.need.every((x) => ids.includes(x))).sort((a, b) => b.need.length - a.need.length)[0];
  const taste: Record<string, number> = {};
  for (const k of ["spicy", "sweet", "salty", "sour", "umami"] as const) taste[k] = tr[k];
  const ferment = tr.ferment * Math.min(days, 20) / 6 + days / 2; // 숙성 정도
  const boomChance = Math.max(0, tr.danger * 6 + ferment * 1.2 - 8);
  const boom = !!combo?.boom || luck * 100 < boomChance;

  const tv = Object.values(taste);
  const mean = tv.reduce((a, c) => a + c, 0) / 5;
  const spread = Math.sqrt(tv.reduce((a, c) => a + (c - mean) ** 2, 0) / 5);
  let score = 50 + Math.min(25, mean * 2) - Math.min(25, spread * 3) - Math.max(0, tr.weird - 12) * 1.5;
  score += (saltScore - 0.5) * 24 + (rubScore - 0.5) * 12 + (combo?.bonus ?? 0);
  const idealDay = 8 + tr.ferment / 4;
  score -= Math.min(20, Math.abs(days - idealDay) * 1.5);
  if (boom) score = Math.min(score, 15);
  const stars = Math.max(0, Math.min(5, Math.round(score / 20)));
  const wCount = Object.entries(bowl).reduce((a, [id, c]) => a + (byId[id].weird >= 4 ? c : 0), 0);
  const tot100 = Math.max(0, Math.min(100, Math.round(score)));

  const dom = (Object.entries(taste).sort((a, b) => b[1] - a[1])[0] || ["spicy", 0]) as [string, number];
  const top = Object.entries(bowl).sort((a, b) => b[1] - a[1]).map(([id]) => byId[id]);
  const strange = top.filter((i) => i.weird >= 3)[0] ?? top[0];
  const mainsList = Object.entries(bowl).filter(([id]) => byId[id].kind === "main").sort((x, y) => y[1] - x[1] || byId[y[0]].weird - byId[x[0]].weird).map(([id]) => byId[id]);
  const saucesList = Object.entries(bowl).filter(([id]) => byId[id].kind === "sauce").sort((x, y) => y[1] - x[1]).map(([id]) => byId[id]);
  const A = (mainsList.find((i) => i.weird >= 3) ?? mainsList[0] ?? top[0])?.name ?? "배추";
  const B = (mainsList.find((i) => i.name !== A) ?? saucesList[0])?.name ?? "";
  const S = (saucesList.find((i) => i.weird >= 3) ?? saucesList[0])?.name ?? "";
  const title = combo?.title ?? (n <= 1 ? "그냥 배추" : makeTitle(A, B, S, dom[0], boom, stars));
  const vd = verdict(wCount, boom);
  const note = combo?.note ?? (boom ? vd : `${vd} ${pick(TASTE_LINE[dom[0]] ?? TASTE_LINE.umami)}`);
  const badges: string[] = [];
  if (tr.weird >= 20) badges.push("🤪 기괴함 장인");
  if (tr.danger >= 8) badges.push("💥 위험물 취급");
  if (tr.spicy >= 12) badges.push("🔥 불맛 마스터");
  if (tr.sweet >= 12) badges.push("🍭 단짠 아님 단단");
  if (saltScore > 0.85) badges.push("🧂 완벽한 절임");
  if (stars === 5) badges.push("🏆 전설의 손맛");
  if (n === 0) badges.push("🥬 소박한 쌈배추");
  return { title, note, stars, boom, days, ferment, taste, weird: tr.weird, danger: tr.danger, badges, combo: combo?.title, grade: grade(tot100, boom), verdict: vd, total: tot100 };
}

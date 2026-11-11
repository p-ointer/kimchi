import { useEffect, useMemo, useRef, useState } from "react";
import { INGS, byId, GRANDMA_REACT, TINT, PASTE, Ing } from "./data";
const pasteOf = (i: Ing) => (i.kind === "sauce" ? PASTE[i.name] : undefined);
import { Bowl, count, judge } from "./logic";
import { loadMask, spotOn } from "./mask";
const TITLE: [string, string] = ["식약처 몰래 연구소", "※ 지금 이 사이트는 감시당하고 있습니다"];
const MAX_KIND = 8; // 재료 8개, 양념 8개 (각각)

type Stage = "base" | "salt" | "cure" | "mains" | "sauces" | "mix" | "go";
const STAGES: [Stage, string][] = [["base", "배추/무"], ["salt", "소금"], ["cure", "절이기"], ["mains", "재료"], ["sauces", "양념"], ["mix", "버무리기"], ["go", "지도에 뿌리기"]];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const zoneScore = (d: number, w: number) => (d <= w * 0.35 ? 100 : d <= w ? Math.round(100 - (30 * (d - w * 0.35)) / (w * 0.65)) : Math.max(0, Math.round(70 - (d - w) * 6)));
const judgeTxt = (s: number) => (s >= 100 ? "완벽!" : s >= 70 ? "좋아요" : s >= 35 ? "아쉽…" : "실패");

// 이모지 또는 이미지 경로(/img/..)를 같은 자리에 표시
export function Ic({ e }: { e: string }) {
  return e.startsWith("/") ? <img className="ic" src={e} alt="" draggable={false} /> : <>{e}</>;
}

function Grandma({ text }: { text: string }) {
  return (
    <div className="grandma">
      <div className="bubble">{text}</div>
    </div>
  );
}

function SaltBoard({ salt, setSalt, hours, img }: { salt: number; setSalt: (f: (s: number) => number) => void; hours: number; img: string }) {
  type G = { id: number; x: number; y: number; r: number; dx: number; dy: number };
  const [grains, setGrains] = useState<G[]>([]);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // 보드 안 픽셀 좌표 (소금통 중심)
  const [tilt, setTilt] = useState(180);
  const [held, setHeld] = useState(false);
  const off = useRef({ x: 0, y: 0 });
  const acc = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const tiltRef = useRef(180);
  const nid = useRef(0);
  const board = useRef<HTMLDivElement>(null);
  const setT = (t: number) => { tiltRef.current = t; setTilt(t); };
  useEffect(() => { const b = board.current!.getBoundingClientRect(); setPos({ x: b.width * 0.8, y: b.height * 0.15 }); }, []);
  useEffect(() => { if (salt === 0) setGrains([]); }, [salt]);
  useEffect(() => { // 놓으면 흔들리다가 천천히 제자리로 (진자)
    const t = setInterval(() => { const d = 180 - tiltRef.current; if (Math.abs(d) > 0.5) setT(tiltRef.current + d * 0.18); }, 40);
    return () => clearInterval(t);
  }, []);
  const move = (e: React.PointerEvent) => {
    if (!held) return;
    const b = board.current!.getBoundingClientRect();
    const x = Math.min(b.width, Math.max(0, e.clientX - b.left - off.current.x)), y = Math.min(b.height, Math.max(0, e.clientY - b.top - off.current.y));
    setPos({ x, y });
    if (last.current) {
      const dx = x - last.current.x, dy = y - last.current.y;
      const sp = Math.hypot(dx, dy);
      // 휘두르는 방향으로 소금통이 기울어진다 (관성)
      setT(180 + Math.max(-75, Math.min(75, -dx * 3.2)) + Math.max(-25, Math.min(25, dy * 0.8)));
      acc.current += sp;
      const th = (tiltRef.current * Math.PI) / 180;
      const cx = Math.sin(th), cy = -Math.cos(th); // 뚜껑이 향한 방향
      while (acc.current > 22) {
        acc.current -= 22;
        if (cy < 0.05) continue; // 뚜껑이 위를 보면 안 나온다
        const n = 2 + Math.round(Math.min(4, sp / 12));
        const gs: G[] = Array.from({ length: n }).map(() => {
          const sx = x + cx * b.width * 0.03 + (Math.random() - 0.5) * 14, sy = y + cy * 36;
          const fall = 50 + Math.random() * 150;
          const gx = sx + cx * 40 + dx * 3 + (Math.random() - 0.5) * 50, gy = Math.min(b.height - 8, sy + fall);
          return { id: nid.current++, x: gx, y: gy, r: 3 + Math.random() * 3, dx: sx - gx, dy: sy - gy };
        });
        setGrains((g) => [...g, ...gs].slice(-600));
        setSalt((s) => Math.min(120, s + 1));
      }
    }
    last.current = { x, y };
  };
  const end = () => { setHeld(false); last.current = null; };
  return (
    <div ref={board} className="saltboard" onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}>
      <div className="cabbage" style={{ transform: `scale(${1 - hours * 0.012},${1 - hours * 0.025})`, filter: `saturate(${1 - salt / 260}) brightness(${1 - salt / 450})` }}><img src={img} alt="" draggable={false} /></div>
      {grains.map((g) => <i key={g.id} className="grain" style={{ left: g.x, top: g.y, width: g.r, height: g.r, ["--dx" as any]: `${g.dx}px`, ["--dy" as any]: `${g.dy}px` }} />)}
      <div className={held ? "saltshaker held" : "saltshaker"} style={{ left: pos.x, top: pos.y, transform: `translate(-50%,-50%) rotate(${tilt}deg)` }}
        onPointerDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); off.current = { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) }; last.current = null; acc.current = 0; try { (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); } catch (_) { /* noop */ } setHeld(true); }}>🧂</div>
      {!held && salt === 0 && <div className="tip">🧂을 잡고 배추 위에서 휘휘 흔들어보세요!</div>}
    </div>
  );
}

/* ---------------- 절이기: 바늘이 초록 구간에 왔을 때 탁! (3번) ---------------- */
function Cure({ onDone, cabbage }: { onDone: (score: number) => void; cabbage: string }) {
  const W = 9, speeds = [70, 100, 135];
  const st = useRef({ pos: 0, dir: 1, center: 50, round: 0, locked: false, res: [] as number[] });
  const [v, setV] = useState({ pos: 0, center: 50, res: [] as number[], msg: "", done: false, avg: 0 });
  const setup = () => {
    const s = st.current;
    s.center = rnd(20, 80); s.pos = Math.random() < 0.5 ? 0 : 100; s.dir = s.pos ? -1 : 1; s.locked = false;
    setV((x) => ({ ...x, center: s.center, pos: s.pos, msg: "" }));
  };
  useEffect(() => {
    setup();
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const s = st.current, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!s.locked && s.round < 3) {
        s.pos += s.dir * speeds[s.round] * dt;
        if (s.pos >= 100) { s.pos = 100; s.dir = -1; }
        if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
        setV((x) => ({ ...x, pos: s.pos }));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const act = () => {
    const s = st.current;
    if (v.done) return onDone(v.avg);
    if (s.locked) return;
    s.locked = true;
    const sc = zoneScore(Math.abs(s.pos - s.center), W);
    s.res.push(sc);
    setV((x) => ({ ...x, res: [...s.res], msg: judgeTxt(sc) }));
    setTimeout(() => {
      s.round++;
      if (s.round >= 3) { const avg = Math.round(s.res.reduce((a, b) => a + b) / 3); setV((x) => ({ ...x, msg: `절이기 ${avg}점`, done: true, avg })); }
      else setup();
    }, 750);
  };
  return (
    <section className="card">
      <h2>절이기 <small>소금이 배어드는 타이밍! 바늘이 초록 구간에 올 때 탁!</small></h2>
      <div className="bigemo"><img src={cabbage} alt="" /></div>
      <div className="judge">{v.msg}</div>
      <div className="track" onClick={act}>
        <div className="zone" style={{ left: `${v.center - W}%`, width: `${W * 2}%` }} />
        <div className="core" style={{ left: `${v.center - W * 0.35}%`, width: `${W * 0.7}%` }} />
        <div className="marker" style={{ left: `${v.pos}%` }} />
      </div>
      <div className="dots">{[0, 1, 2].map((i) => <b key={i} className={v.res[i] != null ? "done" : ""}>{v.res[i] != null ? `${v.res[i]}점` : `${i + 1}번째`}</b>)}</div>
      <button className="big" onClick={act}>{v.done ? "다음: 재료 고르기 →" : "🧂 절이기!"}</button>
    </section>
  );
}


// 양념이 번진 자국: 평평한 색칠이 아니라 울퉁불퉁한 번짐 + 알갱이/방울 + 광택 (SVG)
const POWDER = new Set(["고춧가루", "통깨", "설탕", "굵은소금", "천일염"]);
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (k > 0 ? (255 - v) * k : v * k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function Splat({ c, seed, powder, w = 92 }: { c: string; seed: number; powder: boolean; w?: number }) {
  const els = useMemo(() => {
    const r = rng(seed * 9973 + 7);
    const out: JSX.Element[] = [];
    if (powder) {
      for (let i = 0; i < 46; i++) {
        const ang = r() * 6.28, d = Math.pow(r(), 0.7) * 36, x = 50 + Math.cos(ang) * d, y = 50 + Math.sin(ang) * d;
        const col = [c, shade(c, -0.35), shade(c, 0.3)][Math.floor(r() * 3)];
        out.push(<ellipse key={i} cx={x} cy={y} rx={1.4 + r() * 3.2} ry={0.8 + r() * 1.6} transform={`rotate(${r() * 180} ${x} ${y})`} fill={col} opacity={0.75 + r() * 0.25} />);
      }
    } else {
      // 번진 자국 (가장자리가 울퉁불퉁하게 일그러짐)
      out.push(<ellipse key="s1" cx="50" cy="50" rx={26 + r() * 6} ry={18 + r() * 6} fill={c} opacity=".5" filter="url(#rag)" />);
      out.push(<ellipse key="s2" cx={48 + r() * 6} cy={50 + r() * 4} rx={16 + r() * 5} ry={11 + r() * 4} fill={shade(c, -0.2)} opacity=".55" filter="url(#rag)" />);
      for (let i = 0; i < 16; i++) { // 튄 방울
        const ang = r() * 6.28, d = 22 + r() * 22, x = 50 + Math.cos(ang) * d, y = 50 + Math.sin(ang) * d * 0.8;
        out.push(<circle key={"d" + i} cx={x} cy={y} r={0.9 + r() * 3.2} fill={r() > 0.5 ? c : shade(c, -0.3)} opacity={0.6 + r() * 0.35} />);
      }
      out.push(<ellipse key="h1" cx={42 + r() * 6} cy={44} rx="6" ry="2.4" fill="#fff" opacity=".35" transform="rotate(-20 45 44)" />);
      out.push(<circle key="h2" cx="58" cy="54" r="1.6" fill="#fff" opacity=".5" />);
    }
    return out;
  }, [c, seed, powder]);
  return <svg viewBox="0 0 100 100" width={w} height={w} className="splat" style={{ overflow: "visible" }}>{els}</svg>;
}
function Filters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="rag" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="16" /></filter>
    </svg>
  );
}

// 걸쭉한 장류: 길쭉하게 늘어진 울퉁불퉁한 덩어리 (SVG)
function Paste({ c, r = 0, w = 96 }: { c: string; r?: number; w?: number }) {
  const path = "M8 40 C 26 8, 44 66, 62 32 S 96 14, 112 36";
  return (
    <svg viewBox="0 0 120 70" width={w} height={w * 0.58} style={{ transform: `rotate(${r}deg)`, overflow: "visible" }} className="paste">
      <path d={path} fill="none" stroke="#2a1608" strokeWidth="27" strokeLinecap="round" opacity=".85" />
      <path d={path} fill="none" stroke={c} strokeWidth="21" strokeLinecap="round" />
      <path d={path} fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="21" strokeLinecap="round" strokeDasharray="1 11" transform="translate(0 3)" />
      <path d={path} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" transform="translate(-1 -6)" strokeDasharray="14 9" />
      <circle cx="30" cy="24" r="2.6" fill="#000" opacity=".3" /><circle cx="76" cy="38" r="2.2" fill="#000" opacity=".3" /><circle cx="98" cy="30" r="2" fill="#000" opacity=".3" />
    </svg>
  );
}

/* ---------------- 재료 / 양념 고르기: 상단 선택 + 배추 위로 떨어지는 모션 ---------------- */
type Landed = { id: number; ing: string; x: number; y: number; r: number };
type Drop = { id: number; ing: Ing; x: number };

function Pick({ kind, bowl, setBowl, setSay, next, cabbage }: { kind: "main" | "sauce"; bowl: Bowl; setBowl: (f: (b: Bowl) => Bowl) => void; setSay: (s: string) => void; next: () => void; cabbage: string }) {
  const items = INGS.filter((i) => i.kind === kind);
  const cats = useMemo(() => [...new Set(items.map((i) => i.cat))], [kind]);
  const [cat, setCat] = useState(cats[0]);
  const [q, setQ] = useState("");
  const [land, setLand] = useState<Landed[]>([]);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [squeeze, setSqueeze] = useState<{ ing: Ing; x: number; y: number } | null>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  useEffect(() => { loadMask(cabbage); }, [cabbage]);
  const nid = useRef(0);
  const list = q ? items.filter((i) => i.name.includes(q)) : items.filter((i) => i.cat === cat);
  const mineIds = Object.keys(bowl).filter((id) => byId[id].kind === kind);
  const kindCount = mineIds.reduce((s, id) => s + bowl[id], 0);

  useEffect(() => {
    // 이전 단계에서 담은 것도 배추 위에 보이게
    const init: Landed[] = [];
    for (const [id, n] of Object.entries(bowl)) if (byId[id].kind === "main" || kind === "sauce") for (let k = 0; k < n; k++) init.push(byId[id].kind === "sauce" ? { id: nid.current++, ing: id, ...spotOn(cabbage, plateRef.current), r: rnd(-40, 40) } : { id: nid.current++, ing: id, x: rnd(20, 80), y: rnd(25, 75), r: rnd(-40, 40) });
    setLand(init);
  }, []);

  const add = (ing: Ing) => {
    if (kindCount >= MAX_KIND) return setSay(ing.kind === "main" ? "재료가 넘친다! 그만 넣거라." : "양념이 넘친다! 그만 짜거라.");
    setBowl((b) => ({ ...b, [ing.id]: (b[ing.id] ?? 0) + 1 }));
    setSay(ing.weird >= 5 ? pick(GRANDMA_REACT.weird) : ing.danger >= 3 ? pick(GRANDMA_REACT.danger) : pick(GRANDMA_REACT.good));
    let { x, y } = { x: rnd(25, 75), y: rnd(30, 72) };
    const id = nid.current++;
    if (ing.kind === "sauce") ({ x, y } = spotOn(cabbage, plateRef.current)); // 양념은 배추/무 안에만
    if (ing.kind === "main") {
      setDrops((d) => [...d, { id, ing, x }]);
      setTimeout(() => { setDrops((d) => d.filter((z) => z.id !== id)); setLand((l) => [...l, { id, ing: ing.id, x, y, r: rnd(-40, 40) }]); }, 650);
    } else {
      setSqueeze({ ing, x, y });
      setTimeout(() => { setSqueeze(null); setLand((l) => [...l, { id, ing: ing.id, x, y, r: rnd(-40, 40) }]); }, 1000);
    }
  };
  const rand3 = () => { for (let k = 0; k < Math.min(3, MAX_KIND - kindCount); k++) add(pick(items)); };
  const undo = (id: string) => {
    setBowl((b) => { const n = { ...b, [id]: b[id] - 1 }; if (n[id] <= 0) delete n[id]; return n; });
    setLand((l) => { const k = [...l].reverse().findIndex((z) => z.ing === id); return k < 0 ? l : l.filter((_, i) => i !== l.length - 1 - k); });
  };

  return (
    <section className="card pickwrap">
      <aside className="picker">
        <h2>{kind === "main" ? "재료 고르기" : "양념 짜기"} <small>{kindCount}/{MAX_KIND}</small></h2>
        <input className="search" placeholder="검색 (예: 전갈)" value={q} onChange={(e) => setQ(e.target.value)} />
        {!q && <div className="tabs">{cats.map((c) => <button key={c} className={c === cat ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}</div>}
        <div className="shelf">
          {list.map((i) => (
            <button key={i.id} className="ing" onClick={() => add(i)} title={i.desc}><span className="em"><Ic e={i.emoji} /></span><span>{i.name}</span></button>
          ))}
        </div>
        <button className="big dice" onClick={rand3}>🎲 귀찮으면 랜덤 3개!</button>
      </aside>
      <div className="stagebox">
        <div className="plate" ref={plateRef}>
          <div className="cab"><img src={cabbage} alt="" draggable={false} /></div>
          {land.map((z) => {
            const i = byId[z.ing];
            return i.kind === "main"
              ? <span key={z.id} className="pile" style={{ left: `${z.x}%`, top: `${z.y}%`, transform: `translate(-50%,-50%) rotate(${z.r}deg)` }}><Ic e={i.emoji} /></span>
              : pasteOf(i) ? <span key={z.id} className="pastewrap" style={{ left: `${z.x}%`, top: `${z.y}%` }}><Paste c={pasteOf(i)!} r={z.r * 2} /></span>
              : <span key={z.id} className="pastewrap splatwrap" style={{ left: `${z.x}%`, top: `${z.y}%`, transform: `translate(-50%,-50%) rotate(${z.r * 3}deg)` }}><Splat c={TINT[i.tag]} seed={z.id + 1} powder={POWDER.has(i.name)} /></span>;
          })}
          {drops.map((d) => <span key={d.id} className="fall" style={{ left: `${d.x}%` }}><Ic e={d.ing.emoji} /></span>)}
          {squeeze && (
            <div className="bottle" key={squeeze.ing.id + count(bowl)} style={{ left: `${squeeze.x}%`, ["--h" as any]: `${Math.max(30, ((plateRef.current?.clientHeight ?? 400) * squeeze.y) / 100 - 70)}px` }}>
              <span className="bt"><Ic e={squeeze.ing.emoji} /></span>
              {pasteOf(squeeze.ing)
                ? <i className="ext" style={{ background: pasteOf(squeeze.ing) }} />
                : Array.from({ length: 9 }).map((_, k) => <i key={k} className="sq" style={{ background: TINT[squeeze.ing.tag], animationDelay: `${0.18 + k * 0.07}s` }} />)}
            </div>
          )}
        </div>
        <div className="chips">
          {mineIds.map((id) => <button key={id} className="chip" onClick={() => undo(id)}><Ic e={byId[id].emoji} /> {byId[id].name} ×{bowl[id]}</button>)}
          {!mineIds.length && <span className="muted">{kind === "main" ? "재료를 눌러 배추 위에 떨어뜨리세요" : "양념을 눌러 짜 보세요"}</span>}
        </div>
        <button className="big" onClick={next}>{kind === "main" ? "다음: 양념 →" : "다음: 버무리기 →"}</button>
      </div>
    </section>
  );
}


function Glove({ down }: { down: boolean }) {
  return <img className={"glove" + (down ? " down" : "")} src="/img/glove.png" alt="" draggable={false} />;
}

/* ---------------- 버무리기: 대야를 문질러 게이지를 초록 구간에 ---------------- */
function Mix({ bowl, base, onDone }: { bowl: Bowl; base: "cabbage" | "radish"; onDone: (score: number) => void }) {
  const DUR = 9, LO = 55, HI = 80;
  const ids = Object.keys(bowl);
  const mains = ids.filter((i) => byId[i].kind === "main");
  const sauces = ids.filter((i) => byId[i].kind === "sauce");
  // 고른 재료를 전부 (개수만큼) 대야에 담는다
  const pieces = useMemo(() => mains.flatMap((id) => Array.from({ length: bowl[id] }, () => byId[id].emoji)).slice(0, 40).map((e) => ({ e, a: rnd(0, 6.28), r: Math.sqrt(rnd(0, 1)) * 27 })), []);
  const [bt, setBt] = useState(0);
  const blobs = useMemo(() => sauces.map((s) => ({ c: TINT[byId[s].tag], p: pasteOf(byId[s]), pw: POWDER.has(byId[s].name), x: rnd(30, 70), y: rnd(30, 70), r: rnd(-40, 40) })), []);
  const [tf, setTf] = useState<string[]>(() => pieces.map(() => ""));
  const s = useRef({ e: 0, t: 0, inb: 0, started: false, done: false, down: false, lx: 0, ly: 0, acc: 0 });
  const [v, setV] = useState({ e: 0, t: 0, inb: 0, done: false, score: 0 });
  const [gl, setGl] = useState({ x: 78, y: 82, rot: 20, down: false });
  useEffect(() => {
    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      const o = s.current, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (o.started && !o.done) {
        o.t += dt; o.e = Math.max(0, o.e - (12 + o.e * 0.35) * dt);
        if (o.e >= LO && o.e <= HI) o.inb += dt;
        if (o.t >= DUR) { o.done = true; const sc = Math.min(100, Math.round((o.inb / (DUR - 1.5)) * 100)); setV({ e: o.e, t: o.t, inb: o.inb, done: true, score: sc }); }
        else setV({ e: o.e, t: o.t, inb: o.inb, done: false, score: 0 });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const hint = !s.current.started ? "👇 대야를 꾹 누른 채 빙글빙글" : v.done ? (v.score >= 90 ? "양념이 속속들이 뱄어요" : v.score >= 60 ? "군데군데 허옇지만 괜찮아요" : "양념 따로, 재료 따로…") : v.e >= LO && v.e <= HI ? "딱 좋아요! 이 손맛 그대로 👍" : v.e > HI ? "너무 세요! 재료가 뭉개져요 😵" : "더 힘차게! 💪";
  return (
    <section className="card">
      <h2>버무리기 <small>대야를 문질러 게이지를 초록 구간에 오래 유지!</small></h2>
      {v.done && <div className="judge good">버무리기 {v.score}점</div>}
      <div className="track"><div className="zone" style={{ left: `${LO}%`, width: `${HI - LO}%` }} /><div className="marker" style={{ left: `${v.e}%` }} /></div>
      <p className="hint">{hint}</p>
      <div className={"mixbowl" + (v.e > HI ? " shake" : "")} style={{ touchAction: "none" }}
        onPointerDown={(e) => { const o = s.current; o.down = true; o.lx = e.clientX; o.ly = e.clientY; { const b = e.currentTarget.getBoundingClientRect(); setGl({ x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100, rot: 0, down: true }); } try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } if (!o.done) o.started = true; }}
        onPointerUp={() => { s.current.down = false; setGl((g) => ({ ...g, down: false })); }} onPointerCancel={() => { s.current.down = false; setGl((g) => ({ ...g, down: false })); }}
        onPointerMove={(e) => {
          const o = s.current; if (!o.down) return;
          { const b = e.currentTarget.getBoundingClientRect(); setGl({ x: Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - b.top) / b.height) * 100)), rot: Math.max(-35, Math.min(35, (e.clientX - o.lx) * 2)), down: true }); }
          if (o.done) return;
          const d = Math.hypot(e.clientX - o.lx, e.clientY - o.ly); o.lx = e.clientX; o.ly = e.clientY;
          o.e = Math.min(100, o.e + d * 0.1); o.acc += d;
          if (o.acc > 70) { o.acc = 0; setBt(rnd(-7, 7)); setTf(pieces.map(() => `translate(${rnd(-26, 26)}px,${rnd(-26, 26)}px) rotate(${rnd(-60, 60)}deg)`)); }
        }}>
        <img className="basin" src="/img/basin.png" alt="" draggable={false} />
        <img className="basebowl" src={base === "radish" ? "/img/radish.png" : "/img/cabbage.png"} alt="" draggable={false} style={{ transform: `rotate(${bt}deg)` }} />
        {base === "cabbage"
          ? <img className="basebowl" src="/img/kimchi.png" alt="" draggable={false} style={{ transform: `rotate(${bt}deg)`, opacity: Math.min(1, (v.inb / DUR) * 1.5) }} />
          : <div className="radtint" style={{ opacity: Math.min(0.55, (v.inb / DUR) * 0.9) }} />}
        <div className={"glove-wrap" + (!gl.down ? " idle" : "")} style={{ left: `${gl.x}%`, top: `${gl.y}%`, transform: `translate(-50%,-30%) rotate(${gl.rot - 10}deg)` }}><Glove down={gl.down} /></div>
        {blobs.map((b, i) => b.p
          ? <span key={i} className="pastewrap" style={{ left: `${b.x}%`, top: `${b.y}%`, opacity: Math.max(0.1, 1 - v.inb / DUR * 1.1) }}><Paste c={b.p} r={b.r} w={80} /></span>
          : <span key={i} className="pastewrap splatwrap" style={{ left: `${b.x}%`, top: `${b.y}%`, opacity: Math.max(0.12, 1 - (v.inb / DUR) * 1.1) }}><Splat c={b.c} seed={i + 11} powder={b.pw} w={78} /></span>)}
        {pieces.map((p, i) => <span key={i} className="pc" style={{ left: `${50 + Math.cos(p.a) * p.r}%`, top: `${50 + Math.sin(p.a) * p.r}%`, transform: tf[i] }}><Ic e={p.e} /></span>)}
      </div>
      <div className="track slim"><div className="fill" style={{ width: `${(v.t / DUR) * 100}%` }} /></div>
      <div className="chips">{ids.map((id) => <span key={id} className="chip static"><Ic e={byId[id].emoji} />{byId[id].name}</span>)}</div>
      <button className="big" disabled={!v.done} onClick={() => onDone(v.score)}>{v.done ? "다음: 지도에 뿌리기 →" : "버무리는 중…"}</button>
    </section>
  );
}

/* ---------------- 지도에 뿌리기 ---------------- */
function Go({ base, bowl, salt, cureScore, mixScore }: { base: string; bowl: Bowl; salt: number; cureScore: number; mixScore: number }) {
  const [nick, setNick] = useState(() => localStorage.getItem("kj-nick") ?? "");
  const [st, setSt] = useState<"idle" | "busy" | "err">("idle");
  const send = async () => {
    setSt("busy"); localStorage.setItem("kj-nick", nick);
    const shake = Math.max(0, 1 - Math.abs(salt - 50) / 50);
    const r = judge(bowl, shake * 0.4 + (cureScore / 100) * 0.6, mixScore / 100, 8, Math.random());
    const list = (k: string) => Object.entries(bowl).filter(([id]) => byId[id].kind === k).map(([id, n]) => ({ e: byId[id].emoji, n: byId[id].name, c: n, t: byId[id].tag, p: PASTE[byId[id].name] ?? "" }));
    try {
      const res = await fetch("/api/kimchi", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: r.title, note: r.note, grade: r.grade, total: r.total, stars: r.stars, boom: r.boom, base, nick, badges: r.badges, mains: list("main"), sauces: list("sauce"), scores: { salt: Math.round(shake * 100), cure: cureScore, mix: mixScore } }) });
      if (!res.ok) throw new Error();
      const j = await res.json();
      location.href = `/map?id=${j.id}`;
    } catch { setSt("err"); }
  };
  return (
    <section className="card">
      <h2>숙성은 생략! 지도에 뿌립니다 🗺️</h2>
      <p>완성된 김치는 한국 어딘가의 항아리에 묻히고, 지도에서 누구나 열어볼 수 있어요.</p>
      <input className="search" placeholder="닉네임 (선택)" maxLength={12} value={nick} onChange={(e) => setNick(e.target.value)} />
      <button className="big" disabled={st === "busy"} onClick={send}>{st === "busy" ? "뿌리는 중…" : "🏺 한국 어딘가에 뿌리기"}</button>
      {st === "err" && <p className="hint">서버에 연결할 수 없습니다.</p>}
    </section>
  );
}

export default function App() {
  const [stage, setStage] = useState<Stage>("base");
  const [base, setBase] = useState<"cabbage" | "radish">("cabbage");
  const [salt, setSalt] = useState(0);
  const [cureScore, setCure] = useState(0);
  const [mixScore, setMix] = useState(0);
  const [bowl, setBowl] = useState<Bowl>({});
  const [say, setSay] = useState("김장 시작이다! 무엇으로 담글 테냐?");
  const go = (s: Stage, msg: string) => { setStage(s); setSay(msg); window.scrollTo(0, 0); };
  const [hot, setHot] = useState<{ title: string; total: number }[]>([]);
  useEffect(() => { // 인기 김치(점수 상위)를 전광판에
    fetch("/api/kimchi").then((r) => r.json()).then((l: { title: string; total: number }[]) => setHot([...l].sort((x, y) => y.total - x.total).slice(0, 5))).catch(() => {});
  }, []);
  const cabbage = base === "radish" ? "/img/radish.png" : "/img/cabbage.png";
  return (
    <div className="app">
      <Filters />
      <header>
        <img className="logo" src="/img/kimchi.png" alt="" draggable={false} />
        <h1 className="wobble" title={TITLE[1]}>{[...TITLE[0]].map((c, i) => <span key={i} style={{ animationDelay: `${i * 0.09}s` }}>{c === " " ? "\u00a0" : c}</span>)}<small>{TITLE[1]}</small></h1>
        <a className="maplink" href="/map">🗺️ 항아리 지도</a>
      </header>
      <div className="ticker"><span>★★ 긴급 속보 ★★ 인기 김치는 직접 담아 드립니다 ★ {hot.length ? hot.map((j, i) => `인기 ${i + 1}위 「${j.title}」 ${j.total}점`).join(" ★ ") : "아직 인기 김치가 없습니다. 첫 주인공이 되어 보세요"} ★ 인기 김치는 직접 담아 드립니다 ★★</span></div>
      <ol className="steps">{STAGES.map(([s, l], i) => <li key={s} className={s === stage ? "on" : ""}>{i + 1}. {l}</li>)}</ol>
      <Grandma text={say} />
      {stage === "base" && (
        <section className="card">
          <h2>무엇으로 담글까? <small>배추김치 vs 깍두기</small></h2>
          <div className="basepick">
            {([["cabbage", "배추", "/img/cabbage.png"], ["radish", "무", "/img/radish.png"]] as const).map(([k, n, im]) => (
              <button key={k} className={"basebtn" + (base === k ? " on" : "")} onClick={() => { setBase(k); setSay(k === "cabbage" ? "역시 배추지!" : "깍두기로 가는 게냐?"); }}>
                <img src={im} alt={n} /><b>{n}</b>
              </button>
            ))}
          </div>
          <button className="big" onClick={() => go("salt", "소금통을 잡고 흔들어보거라.")}>다음: 소금 뿌리기 →</button>
        </section>
      )}
      {stage === "salt" && (
        <section className="card">
          <h2>소금 뿌리기 <small>(소금통을 잡고 흔들어 뿌리세요)</small></h2>
          <SaltBoard salt={salt} setSalt={setSalt} hours={6} img={cabbage} />
          <p className="hint">소금 {salt}g · {salt < 20 ? "더 뿌려야 한다" : salt < 35 ? "조금 싱겁다" : salt <= 65 ? "딱 좋다!" : "소금 폭탄…"}</p>
          <div className="row"><button onClick={() => setSalt(0)}>🧹 소금 털기</button><button className="big" disabled={salt < 15} onClick={() => go("cure", "이제 절여야지. 타이밍이 생명이란다!")}>다음: 절이기 →</button></div>
        </section>
      )}
      {stage === "cure" && <Cure cabbage={cabbage} onDone={(s) => { setCure(s); go("mains", "주재료부터 넣어보거라... 뭐든...") ; }} />}
      {stage === "mains" && <Pick kind="main" bowl={bowl} setBowl={setBowl} setSay={setSay} cabbage={cabbage} next={() => go("sauces", "이제 양념을 짜자!")} />}
      {stage === "sauces" && <Pick kind="sauce" bowl={bowl} setBowl={setBowl} setSay={setSay} cabbage={cabbage} next={() => go("mix", "골고루 버무려야 한다.")} />}
      {stage === "mix" && <Mix bowl={bowl} base={base} onDone={(s) => { setMix(s); go("go", "자, 이제 한국 어딘가에 묻으러 가자!"); }} />}
      {stage === "go" && <Go base={base} bowl={bowl} salt={salt} cureScore={cureScore} mixScore={mixScore} />}
    </div>
  );
}

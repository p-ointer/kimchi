// 배추/무 이미지의 불투명 영역 안에서만 위치를 뽑는다 (양념이 이미지 안에 떨어지게)
type M = { ar: number; cells: [number, number][] };
const cache: Record<string, M | undefined> = {};

export function loadMask(src: string) {
  if (cache[src]) return;
  const im = new Image();
  im.onload = () => {
    const N = 40, c = document.createElement("canvas");
    c.width = N; c.height = N;
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0, N, N);
    const d = g.getImageData(0, 0, N, N).data;
    const op = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && d[(y * N + x) * 4 + 3] > 200;
    const cells: [number, number][] = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!op(x + dx, y + dy)) { ok = false; break; }
      if (ok) cells.push([(x + 0.5) / N, (y + 0.5) / N]);
    }
    cache[src] = { ar: im.naturalWidth / im.naturalHeight, cells };
  };
  im.src = src;
}

/** plate(요소) 안에서 이미지가 차지하는 영역 안의 임의 지점 -> 판 기준 % 좌표 */
export function spotOn(src: string, plate: HTMLElement | null): { x: number; y: number } {
  const m = cache[src];
  if (!m || !plate || !m.cells.length) return { x: 50 + (Math.random() - 0.5) * 20, y: 50 + (Math.random() - 0.5) * 20 };
  const W = plate.clientWidth, H = plate.clientHeight;
  const bw = W * 0.9, bh = H * 0.9;
  const w = Math.min(bw, bh * m.ar), h = w / m.ar;
  const [u, v] = m.cells[Math.floor(Math.random() * m.cells.length)];
  return { x: ((W - w) / 2 + (u + (Math.random() - 0.5) * 0.02) * w) / W * 100, y: ((H - h) / 2 + v * h) / H * 100 };
}

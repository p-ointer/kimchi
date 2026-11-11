"""김장 연구소 서버: 게임(dist) + 항아리 지도(/map) + SQLite 저장. 실행: python server.py --port 8080  (먼저 npm run build)"""
import argparse, json, os, random, sqlite3, threading, time, uuid
import urllib.request, urllib.error
from collections import defaultdict, deque
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("KIMJANG_DB", os.path.join(HERE, "data", "kimchi.db"))
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
lock = threading.Lock()


def load_env():
    out = dict(os.environ)
    p = os.path.join(HERE, ".env")
    if os.path.exists(p):
        for ln in open(p, encoding="utf-8"):
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1)
                out.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return out


ENV = load_env()
TURSO_URL = ENV.get("turso_url") or ENV.get("TURSO_URL") or ""
TURSO_KEY = ENV.get("turso_key") or ENV.get("TURSO_KEY") or ENV.get("TURSO_TOKEN") or ""
SCHEMA = "CREATE TABLE IF NOT EXISTS jars (id TEXT PRIMARY KEY, ts INTEGER, lat REAL, lng REAL, data TEXT)"


class Turso:
    """Turso(libSQL) HTTP API: 별도 패키지 없이 urllib 로 호출"""

    def __init__(self, url, token):
        self.url = url.replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
        self.token = token

    @staticmethod
    def _arg(v):
        if isinstance(v, bool):
            v = int(v)
        if isinstance(v, int):
            return {"type": "integer", "value": str(v)}
        if isinstance(v, float):
            return {"type": "float", "value": v}
        return {"type": "text", "value": str(v)}

    def execute(self, sql, args=()):
        body = {"requests": [{"type": "execute", "stmt": {"sql": sql, "args": [self._arg(a) for a in args]}}, {"type": "close"}]}
        req = urllib.request.Request(self.url, data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            res = json.loads(r.read())["results"][0]
        if res.get("type") == "error":
            raise RuntimeError(res["error"].get("message", "turso error"))
        out = res["response"]["result"]
        return [[(c.get("value") if c.get("type") != "null" else None) for c in row] for row in out.get("rows", [])]


if TURSO_URL and TURSO_KEY:
    remote = Turso(TURSO_URL, TURSO_KEY)
    remote.execute(SCHEMA)
    BACKEND = "turso"

    def db_insert(row):
        remote.execute("INSERT INTO jars VALUES (?,?,?,?,?)", row)

    def db_list():
        return [(r[0], int(r[1]), float(r[2]), float(r[3]), r[4]) for r in remote.execute("SELECT id, ts, lat, lng, data FROM jars ORDER BY ts DESC LIMIT 3000")]
else:
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.execute(SCHEMA)
    db.commit()
    BACKEND = "sqlite"

    def db_insert(row):
        with lock:
            db.execute("INSERT INTO jars VALUES (?,?,?,?,?)", row)
            db.commit()

    def db_list():
        with lock:
            return db.execute("SELECT id, ts, lat, lng, data FROM jars ORDER BY ts DESC LIMIT 3000").fetchall()


CITIES = [(37.566, 126.978), (35.180, 129.075), (35.871, 128.601), (37.456, 126.705), (35.160, 126.851), (36.351, 127.385), (35.539, 129.311), (37.263, 127.029), (37.655, 127.077), (37.452, 126.502), (36.992, 127.113), (35.824, 127.148), (34.811, 126.392), (36.019, 129.343), (35.228, 128.681), (37.751, 128.876), (37.881, 127.730), (36.640, 127.489), (36.789, 127.003), (33.499, 126.531), (35.957, 126.713), (36.561, 126.673), (37.342, 127.920), (36.566, 128.729), (35.549, 126.855), (34.760, 127.662), (36.120, 128.345), (35.332, 129.037), (37.200, 128.330), (35.500, 127.500), (36.800, 128.600), (37.500, 128.400), (35.700, 128.300), (35.100, 127.900)]
hits = defaultdict(deque)


def clip(v, n):
    return str(v or "")[:n]


def items(v, n=14):
    out = []
    for x in list(v or [])[:n]:
        if isinstance(x, dict):
            out.append(dict(e=clip(x.get("e"), 40), n=clip(x.get("n"), 14), c=max(1, min(14, int(x.get("c") or 1))), t=clip(x.get("t"), 1), p=clip(x.get("p"), 9) if str(x.get("p") or "").startswith("#") else ""))
    return out


app = FastAPI()


@app.post("/api/kimchi")
def add(d: dict, request: Request):
    ip = request.client.host if request.client else "?"
    q = hits[ip]
    now = time.time()
    while q and now - q[0] > 600:
        q.popleft()
    if len(q) >= 20:
        raise HTTPException(429, "잠시 후 다시 시도해 주세요")
    q.append(now)
    la, ln = random.choice(CITIES)
    jid = uuid.uuid4().hex[:10]
    data = dict(
        title=clip(d.get("title"), 40), note=clip(d.get("note"), 160), grade=clip(d.get("grade"), 30), nick=clip(d.get("nick"), 12) or "익명의 김장러",
        total=max(0, min(100, int(d.get("total") or 0))), stars=max(0, min(5, int(d.get("stars") or 0))), boom=bool(d.get("boom")), base="radish" if d.get("base") == "radish" else "cabbage",
        badges=[clip(x, 20) for x in list(d.get("badges") or [])[:6]], mains=items(d.get("mains")), sauces=items(d.get("sauces")),
        scores={k: max(0, min(100, int((d.get("scores") or {}).get(k) or 0))) for k in ("salt", "cure", "mix")},
    )
    row = (jid, int(now), round(la + random.uniform(-0.045, 0.045), 5), round(ln + random.uniform(-0.045, 0.045), 5), json.dumps(data, ensure_ascii=False))
    db_insert(row)
    return dict(id=jid, ts=row[1], lat=row[2], lng=row[3], **data)


@app.get("/api/kimchi")
def lst():
    rows = db_list()
    return [dict(id=r[0], ts=r[1], lat=r[2], lng=r[3], **json.loads(r[4])) for r in rows]


@app.get("/map")
def map_page():
    return FileResponse(os.path.join(HERE, "static", "map.html"))


dist = os.path.join(HERE, "dist")
if os.path.isdir(dist):
    app.mount("/", StaticFiles(directory=dist, html=True), name="game")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args()
    print("저장소:", BACKEND)
    uvicorn.run(app, host=a.host, port=a.port)

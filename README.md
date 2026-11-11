# 김치 (식약처 몰래 연구소)

배추/무에 소금 → 절이기 → 재료 → 양념 → 버무리기 → 항아리를 한국 어딘가에 묻는 병맛 김장 게임.
다른 사람이 묻은 항아리는 `/map`(OpenStreetMap)에서 열어볼 수 있습니다.

## 실행
```
npm install
npm run build
python server.py --port 8090      # 게임 http://localhost:8090 , 지도 /map
```
개발 서버: `npm run dev` (게임만, 저장 API는 server.py 필요)

## 저장소(DB)
- `.env` 에 `turso_url`, `turso_key` 가 있으면 Turso(libSQL)에 저장, 없으면 로컬 SQLite(`data/kimchi.db`).
- 환경변수 `TURSO_URL`, `TURSO_KEY` 로도 지정할 수 있습니다. **`.env` 는 커밋하지 마세요.**

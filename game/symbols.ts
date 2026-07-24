// 표식(escapePlan.SYMBOLS) → 아이콘 이미지 경로.
// escapePlan.ts는 서버(EscapePlan.java)와 시드·난수 순서를 맞춰야 하는 순수 로직이라,
// UI 자원(아이콘 경로)은 그 계약과 분리해 여기서 든다. 파일은 public/symbols/{name}.png.
//   - 기본 아이콘: 칩·미니 표시용(작게, 또렷하게)
//   - stamp/: 죄수 낙인 느낌 변형(감방 벽 데칼 등 큰 표시용)
import { SYMBOLS } from "./escapePlan";

// 한글 표식 → 파일명. SYMBOLS 8종과 1:1 대응(서버 순서와 무관, 표시용 매핑).
const FILE: Record<string, string> = {
  닻: "anchor",
  별: "star",
  달: "moon",
  해: "sun",
  새: "bird",
  물고기: "fish",
  열쇠: "key",
  왕관: "crown",
};

// 매핑 누락(표식 추가 시)을 개발 중 바로 잡도록.
if (process.env.NODE_ENV !== "production") {
  const missing = SYMBOLS.filter((s) => !FILE[s]);
  if (missing.length) console.warn("[symbols] 아이콘 매핑 없음:", missing);
}

/** 표식의 아이콘 경로. stamp=true면 낙인 변형. 매핑 없으면 null. */
export function symbolIcon(symbol: string, stamp = false): string | null {
  const name = FILE[symbol];
  if (!name) return null;
  return `/symbols/${stamp ? "stamp/" : ""}${name}.png`;
}

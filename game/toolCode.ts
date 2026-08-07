// 작업장 "비밀번호" 퀴즈 — 도구 이름 → 숫자 표에서 규칙을 찾아 물음표의 수를 맞추는 문제.
//
// 겉보기엔 초성/획수/자음 개수 같은 걸 떠올리게 하지만, 실제 규칙은 이름을 이루는
// **자모(초성+중성+종성) 개수**에 방마다 다른 1차식(k·s + c)을 씌운 것이다.
//   예) 드라이버 = 드(2)+라(2)+이(2)+버(2) = 자모 8개.
//       망치 = 망(3)+치(2) = 5,  니퍼 = 4,  커터칼 = 7,  스패너 = 6.
//   값 = k·(자모 수) + c.  k·c가 방 코드로 매판 랜덤이라 **방마다 답이 다르다**.
//
// 답 검증은 클라(퍼즐 UI)가 한다 — escapePlan과 달리 서버와 시드를 맞출 필요가 없다
// (서버는 solve 신호만 브로드캐스트하고, 규칙·정답은 알 필요가 없다).
//
// 규칙 응용: 기준 지표(jamoCount)나 변환(k·s+c)만 갈아 끼우면 전혀 다른 문제가 된다.

/** 문자열 → 32bit 정수(FNV-1a). escapePlan.ts / minigames/registry.ts와 같은 식. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 시드 고정 선형합동 난수(0~1). escapePlan.ts와 같은 식. */
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 한글 단어의 자모(초성+중성+종성) 총 개수. 한글 음절이 아닌 글자는 세지 않는다. */
export function jamoCount(word: string): number {
  let n = 0;
  for (const ch of word) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = code - 0xac00;
      // 초성·중성은 항상, 종성(받침)은 있을 때만(idx % 28 !== 0).
      n += 2 + (idx % 28 === 0 ? 0 : 1);
    }
  }
  return n;
}

// 도구 풀 — 자모 개수가 모두 달라(4·5·6·7·8), 어느 3개를 보여줘도 규칙을 역산할 수 있다.
// 값 = k·s + c 는 k∈{2,3,4}, c∈{2..9}, s∈{4..8}이라 항상 두 자리(10~41)다.
const TOOLS = ["드라이버", "커터칼", "스패너", "망치", "니퍼"];

// ⚠️ 받침 없는 셋. 이 셋은 자모 수가 정확히 글자 수×2라서(니퍼 2글자=4자모 …),
// 셋만 표에 오르면 "글자 수 × 2k + c"라는 **가짜 규칙도 완벽히 들어맞는다**.
// 그 규칙으로 물음표(망치·커터칼 — 받침이 있어 2배가 깨진다)를 계산하면 진짜 답과 달라
// "규칙대로 했는데 틀린다"가 된다(2026-08-07 실제 신고: 니퍼18·스패너24·드라이버30).
// 그래서 표 3줄에 받침 있는 도구가 최소 하나 끼도록 보정한다 — 받침 도구가 표에 있으면
// 글자 수 규칙은 표에서부터 안 맞아 후보에서 스스로 떨어진다.
const NO_BATCHIM = new Set(["드라이버", "스패너", "니퍼"]);

export interface ToolRow {
  name: string;
  value: number;
}
export interface ToolCode {
  rows: ToolRow[]; // 값이 주어진 도구 3개
  target: string; // 물음표(맞혀야 하는) 도구 이름
  answer: string; // 정답(문자열)
  digits: number; // 정답 자리수(입력 휠 개수)
}

/** 방 코드로 작업장 퀴즈를 만든다. 같은 방이면 모두 같은 표·답을 본다. */
export function toolCode(seed: string): ToolCode {
  const rand = rng(hash(`toolcode|work|${seed || "solo"}`));

  const pool = [...TOOLS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const pick = pool.slice(0, 4);
  // 표 3줄이 전부 받침 없는 도구면(확률 1/10) 물음표와 자리를 바꿔 받침 도구를 표에 넣는다.
  // (rand 소비가 없어 같은 시드면 같은 결과 — 방 전원이 같은 표를 본다.)
  if (pick.slice(0, 3).every((n) => NO_BATCHIM.has(n))) {
    [pick[2], pick[3]] = [pick[3], pick[2]];
  }
  const k = 2 + Math.floor(rand() * 3); // 2~4
  const c = 2 + Math.floor(rand() * 8); // 2~9
  const val = (name: string) => k * jamoCount(name) + c;

  const target = pick[3];
  const rows = pick.slice(0, 3).map((name) => ({ name, value: val(name) }));
  const answer = String(val(target));
  return { rows, target, answer, digits: answer.length };
}

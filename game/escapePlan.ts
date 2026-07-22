// 탈옥 시나리오 플랜 — 방 코드를 시드로 매판 랜덤 생성한다(미니게임 배정과 같은 패턴).
//
// 정보를 인원 수만큼 쪼개 협동을 강제하는 구조:
//   - 감방(A~D)마다 고유 "표식 + 수"가 배정된다. 자기 감방 자물쇠를 풀면(=탈출) 자동 지급(HUD).
//   - 해독 조각 문서 3곳(식당·수감동 복도·연병장)이 규칙을 나눠 갖는다:
//       ① doc-cafe: 표식 → 자릿수 위치(감방 A·B 몫)   ② doc-hall: 나머지(C·D 몫)
//       ③ doc-yard: 보정 산식(수 + shift, 일의 자리만)
//   - 각자는 자기 표식 하나로 "자기 자리 숫자"만 계산할 수 있다 → 채팅 공유가 강제된다.
//   - 빈 감방(사람·봇이 배정되지 않았거나 이탈)의 표식·수는 doc-yard에 "압수 기록"으로 노출된다.
//     이 폴백 덕에 인원이 적어도(솔로 포함) 판이 막히지 않는다.
//
// ⚠️ 서버 EscapePlan.java 와 시드 해시·난수·소비 순서가 **완전히 같아야** 한다(봇이 자기 표식을
//    채팅으로 말한다). 32비트 정수 연산이라 언어가 달라도 결과가 같다 — 한쪽 고치면 양쪽 반영.
import { CELLS } from "./prisonLayout";

/** 표식 풀(8개 중 매판 4개가 뽑힌다). 서버 EscapePlan.SYMBOLS와 같은 값·순서. */
export const SYMBOLS = ["닻", "별", "달", "해", "새", "물고기", "열쇠", "왕관"] as const;

export interface CellClue {
  symbol: string; // 이 감방의 표식
  value: number; // 표식의 수(0~9). 자릿수 숫자 = (value + shift) % 10
  position: number; // 코드에서 이 감방 몫의 자리(0=첫째)
}

export interface EscapePlan {
  code: string; // 탈옥문 4자리 코드
  shift: number; // 보정값(1~9)
  clues: Record<string, CellClue>; // 감방 id("A"~"D") → 단서
}

/** 문자열 → 32bit 정수(FNV-1a). minigames/registry.ts와 같은 식. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 시드 고정 선형합동 난수(0~1). minigames/registry.ts와 같은 식. */
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const cache = new Map<string, EscapePlan>();

/** 방 코드로 플랜 생성(캐시). 같은 방 사람들은 같은 코드·표식을 본다. */
export function escapePlan(seed: string): EscapePlan {
  const key = seed || "solo";
  const hit = cache.get(key);
  if (hit) return hit;

  // ⚠️ rand 소비 순서가 서버와의 계약이다: 표식 셔플 → 자리 셔플 → 수 4개 → 보정.
  const rand = rng(hash(`escape|${key}`));

  const syms = [...SYMBOLS];
  for (let i = syms.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [syms[i], syms[j]] = [syms[j], syms[i]];
  }
  const pos = [0, 1, 2, 3];
  for (let i = pos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pos[i], pos[j]] = [pos[j], pos[i]];
  }
  const values = [0, 1, 2, 3].map(() => Math.floor(rand() * 10));
  const shift = 1 + Math.floor(rand() * 9);

  const clues: Record<string, CellClue> = {};
  const digits = ["0", "0", "0", "0"];
  CELLS.forEach((c, i) => {
    clues[c.id] = { symbol: syms[i], value: values[i], position: pos[i] };
    digits[pos[i]] = String((values[i] + shift) % 10);
  });

  const plan: EscapePlan = { code: digits.join(""), shift, clues };
  cache.set(key, plan);
  return plan;
}

const ORDINAL = ["첫째", "둘째", "셋째", "넷째"];

/** 해독 조각 문서 본문. docId: doc-cafe(A·B 자리) / doc-hall(C·D 자리) / doc-yard(보정 산식). */
export function docText(
  plan: EscapePlan,
  docId: string,
  /** 지금 "주인 없는" 감방 id들 — doc-yard가 압수 기록으로 대신 공개한다. */
  emptyCells: string[],
): string {
  const line = (cellId: string) => {
    const c = plan.clues[cellId];
    return `${c.symbol}는 ${ORDINAL[c.position]} 자리`;
  };
  switch (docId) {
    case "doc-cafe":
      return `배식표 뒷면 낙서 — "${line("A")}, ${line("B")}." 나머지 표식의 자리는 다른 곳에 적혀 있다.`;
    case "doc-hall":
      return `벽에 긁힌 흔적 — "${line("C")}, ${line("D")}." 제 표식이 없는 자는 남에게 물어라.`;
    case "doc-yard": {
      let t = `모래에 눌러 쓴 글 — "제 표식의 수에 ${plan.shift}를 더하라. 10이 넘으면 일의 자리만 쓴다."`;
      for (const cellId of emptyCells) {
        const c = plan.clues[cellId];
        t += ` 곁에 간수의 압수 기록 조각: "${c.symbol}의 수는 ${c.value}."`;
      }
      return t;
    }
    default:
      return "";
  }
}

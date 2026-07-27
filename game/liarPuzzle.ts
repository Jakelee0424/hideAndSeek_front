// 배수관(최종 탈출구) 퍼즐 — "거짓말 탐정" 논리 문제.
//
// 화자 N명(5~6)이 각자 한 문장씩 말한다. 진실을 말하는 자는 정확히 K명(나머지가 거짓말쟁이).
//   - 위치 진술: "왕관 → 2번째"   (진실이면 그 표식의 진짜 자리, 거짓이면 틀린 자리)
//   - 지목 진술: "A는 거짓말을 하고 있다"
//   - 택일 진술: "A와 B 중 진실은 한 명뿐이다"
// 플레이어는 (누가 진실인가) + (표식 4개의 진짜 자리)를 **동시에** 만족하는 유일한 해를
// 논리표로 찾아, 표식 4개를 1~4번째 자리에 배열해 입력한다.
//
// 정답(표식의 진짜 배치)은 escapePlan의 표식·자리(position)를 그대로 재활용한다 — 그래야
// 별관 방 벽 표식(Map.RoomStamps)과 최종 답이 같은 원천을 가리킨다. escapePlan의 난수
// 소비 순서는 건드리지 않으므로 서버 EscapePlan.java와의 시드 계약도 그대로다.
//
// ⚠️ 유일 해 보장이 핵심이다. "4개 표식 전체 배열"을 논리만으로 확정하려면 거짓말쟁이가 거의
//    없어야 한다(위치 진술 대부분이 참이어야 4자리가 다 고정된다). 아래 CONFIGS는 전수검증으로
//    항상 유일 해가 나오는 조합만 추린 것이다(각 100% 수율). 생성은 "정답에서 문장을 만들고 →
//    (진실배정×배열) 전수검증"이며, 유일하지 않으면 시드+attempt로 다시 만든다(결정적).
//    답 검증은 클라가 하므로 서버는 관여하지 않는다.
import { SYMBOLS, escapePlan } from "./escapePlan";

type MetaKind = "liar" | "one";
type Stmt =
  | { kind: "pos"; symbol: string; n: number } // 표식이 n번째(1~4)에 있다
  | { kind: "liar"; who: number } // 화자 who는 거짓말쟁이다
  | { kind: "oneTrue"; a: number; b: number }; // a·b 중 진실은 한 명뿐

export interface LiarPuzzle {
  speakers: { label: string; text: string }[];
  truthCount: number; // 진실을 말하는 사람 수 K
  symbols: string[]; // 배열 입력 후보(4개 표식, 정답 순서를 안 드러내게 정렬)
  answer: string[]; // 정답 배치: answer[i] = (i+1)번째 표식
}

const LABELS = ["A", "B", "C", "D", "E", "F"];

// 전수검증으로 항상 유일 해가 나오는 문제 구성만(각 100% 수율). nPos=위치 진술 수, meta=메타 진술 종류.
const CONFIGS: { N: number; nPos: number; meta: MetaKind[]; K: number }[] = [
  { N: 5, nPos: 3, meta: ["liar", "one"], K: 4 },
  { N: 5, nPos: 3, meta: ["liar", "liar"], K: 4 },
  { N: 5, nPos: 4, meta: ["liar"], K: 4 },
  { N: 6, nPos: 4, meta: ["liar", "one"], K: 4 },
  { N: 6, nPos: 4, meta: ["liar", "one"], K: 5 },
  { N: 6, nPos: 4, meta: ["liar", "liar"], K: 5 },
];

/** 문자열 → 32bit 정수(FNV-1a). 다른 시드 생성기와 같은 식. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 시드 고정 선형합동 난수(0~1). */
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** escapePlan의 표식·자리 → 정답 배치. order[p] = (p+1)번째 자리의 표식. */
function trueOrderOf(seed: string): string[] {
  const clues = escapePlan(seed).clues;
  const order: string[] = new Array(4);
  for (const id of Object.keys(clues)) {
    const c = clues[id];
    order[c.position] = c.symbol;
  }
  return order;
}

/** 배열 셔플(시드 난수). */
function shuffle<T>(rand: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 표식 4개의 모든 배열(4! = 24). 전수 검증용. */
function permutations(arr: string[]): string[][] {
  if (arr.length <= 1) return [arr];
  const out: string[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

/** 진술의 참/거짓 — 특정 (진실배정 assign, 자리배열 perm) 하에서. */
function stmtTruth(st: Stmt, assign: boolean[], perm: string[]): boolean {
  switch (st.kind) {
    case "pos":
      return perm[st.n - 1] === st.symbol;
    case "liar":
      return assign[st.who] === false;
    case "oneTrue":
      return assign[st.a] !== assign[st.b];
  }
}

function textOf(st: Stmt): string {
  switch (st.kind) {
    case "pos":
      return `${st.symbol} → ${st.n}번째`;
    case "liar":
      return `${LABELS[st.who]}는 거짓말을 하고 있다`;
    case "oneTrue":
      return `${LABELS[st.a]}와 ${LABELS[st.b]} 중 진실은 한 명뿐이다`;
  }
}

/** (진실배정×배열) 전수탐색으로 해가 몇 개인지. 2가 되면 즉시 멈춘다(유일 여부만 알면 된다). */
function solutionCount(stmts: Stmt[], K: number, perms: string[][]): number {
  const N = stmts.length;
  let count = 0;
  for (let mask = 0; mask < 1 << N; mask++) {
    const assign: boolean[] = new Array(N);
    let cnt = 0;
    for (let i = 0; i < N; i++) {
      assign[i] = (mask & (1 << i)) !== 0;
      if (assign[i]) cnt++;
    }
    if (cnt !== K) continue;
    for (const perm of perms) {
      let ok = true;
      for (let i = 0; i < N; i++) {
        if (stmtTruth(stmts[i], assign, perm) !== assign[i]) {
          ok = false;
          break;
        }
      }
      if (ok && ++count > 1) return count;
    }
  }
  return count;
}

/** 목표 진실배정 assign·정답배열 trueOrder에 맞는 진술들을 만든다. 만들 수 없으면 null(재시도). */
function buildStmts(
  rand: () => number,
  trueOrder: string[],
  nPos: number,
  meta: MetaKind[],
  assign: boolean[],
): Stmt[] | null {
  const N = assign.length;
  const wrongPos = (truePos: number) => {
    const opts = [1, 2, 3, 4].filter((x) => x !== truePos);
    return opts[Math.floor(rand() * opts.length)];
  };
  // 화자 0..nPos-1: 서로 다른 표식의 위치 진술(진실이면 진짜 자리, 거짓이면 틀린 자리).
  const syms = shuffle(rand, trueOrder).slice(0, nPos);
  const stmts: Stmt[] = syms.map((s, i) => {
    const truePos = trueOrder.indexOf(s) + 1;
    return { kind: "pos", symbol: s, n: assign[i] ? truePos : wrongPos(truePos) };
  });
  // 화자 nPos..N-1: 메타 진술(그 진술의 참/거짓이 자기 진실배정과 같도록 대상을 고른다).
  for (let k = 0; k < meta.length; k++) {
    const m = nPos + k;
    const want = assign[m];
    if (meta[k] === "liar") {
      const cands: number[] = [];
      for (let w = 0; w < N; w++) if (w !== m && assign[w] === !want) cands.push(w);
      if (!cands.length) return null;
      stmts.push({ kind: "liar", who: cands[Math.floor(rand() * cands.length)] });
    } else {
      const pairs: [number, number][] = [];
      for (let a = 0; a < N; a++)
        for (let b = a + 1; b < N; b++)
          if (a !== m && b !== m && (assign[a] !== assign[b]) === want) pairs.push([a, b]);
      if (!pairs.length) return null;
      const [a, b] = pairs[Math.floor(rand() * pairs.length)];
      stmts.push({ kind: "oneTrue", a, b });
    }
  }
  return stmts;
}

/** 방 코드로 거짓말 탐정 문제를 만든다(유일 해 보장). 같은 방이면 모두 같은 문제를 본다. */
export function liarPuzzle(seed: string): LiarPuzzle {
  const trueOrder = trueOrderOf(seed);
  const perms = permutations(trueOrder);
  // 입력 후보는 정답 순서를 안 드러내게 표식 풀(SYMBOLS) 순서로 정렬한다.
  const options = [...trueOrder].sort(
    (a, b) =>
      (SYMBOLS as readonly string[]).indexOf(a) -
      (SYMBOLS as readonly string[]).indexOf(b),
  );

  for (let attempt = 0; attempt < 800; attempt++) {
    const rand = rng(hash(`liar|${seed || "solo"}|${attempt}`));
    const cfg = CONFIGS[Math.floor(rand() * CONFIGS.length)];
    const { N, nPos, meta, K } = cfg;

    // 목표 진실배정: 정확히 K명 진실(무작위 위치).
    const idx = shuffle(rand, [...Array(N).keys()]);
    const assign = new Array(N).fill(false);
    for (let k = 0; k < K; k++) assign[idx[k]] = true;

    const stmts = buildStmts(rand, trueOrder, nPos, meta, assign);
    if (!stmts) continue;

    // 구성이 목표(assign, trueOrder)와 스스로 일치하는지 확인 → 그러면 그 조합은 항상 해 하나다.
    let consistent = true;
    for (let i = 0; i < N; i++) {
      if (stmtTruth(stmts[i], assign, trueOrder) !== assign[i]) {
        consistent = false;
        break;
      }
    }
    if (!consistent) continue;

    // 해가 유일하면(=오직 정답 배열만) 채택. 일치가 보장돼 있으니 count===1이면 그 해는 trueOrder다.
    if (solutionCount(stmts, K, perms) === 1) {
      return {
        speakers: stmts.map((st, i) => ({ label: LABELS[i], text: textOf(st) })),
        truthCount: K,
        symbols: options,
        answer: trueOrder,
      };
    }
  }

  // 폴백(사실상 도달하지 않음): 위치 진술 4개 중 첫 화자만 거짓 + 지목 1개, 진실 4명.
  const fb: Stmt[] = trueOrder.map((s, i) => {
    const truePos = i + 1; // trueOrder[i]는 (i+1)번째
    return i === 0
      ? { kind: "pos", symbol: s, n: (truePos % 4) + 1 } // 첫 화자만 틀린 자리
      : { kind: "pos", symbol: s, n: truePos };
  });
  fb.push({ kind: "liar", who: 0 }); // "A는 거짓말" — 참(A가 유일한 거짓말쟁이)
  return {
    speakers: fb.map((st, i) => ({ label: LABELS[i], text: textOf(st) })),
    truthCount: 4,
    symbols: options,
    answer: trueOrder,
  };
}

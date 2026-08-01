// 의무실 퍼즐 — 두 단계. 둘 다 방 코드로 매판 생성한다(같은 방이면 모두 같은 문제를 본다).
//
// ① 진입(문 밖 복도, lock-med): **혈액형 판정**. 침대 여섯의 혈액형을 단서로 복원해
//    **배치 그대로** 차트에 적어 넣으면 문 옆 금고가 열린다.
//    ⚠️ **2026-08-01에 침대 4 → 6, 혈액형 중복 허용으로 바꿨다.** 예전엔 O·A·B·AB가
//    하나씩이고 답이 "번호 네 자리"였는데, 그건 복원한 배치가 아니라 그 **요약**이라
//    답 공간이 1~4의 순열 = 24가지뿐이었다(스물세 번 찍으면 열렸다). 지금은 4⁶ = 4096이다.
//    혈액 검사 키트는 두 침대 사이 "수혈 가능 여부"만 알려준다(혈액형은 안 알려준다). 2회 한정.
//
// ② 표식(방 안, quiz-med): **감염 경로 추적**. 어제 하루의 접촉 기록(누가 몇 시에 누구와)과
//    증상 발현 시각 셋이 있다. 감염은 접촉 즉시, 발현은 정확히 6시간 뒤, 발현 전에도 옮긴다.
//    ⚠️ **2026-08-01에 "최초 감염자 1명 지목" → "감염 경로표 채우기"로 바꿨다.** 여섯 명이
//    각각 **누구에게서 옮았는지**(또는 외부 유입/미감염)를 전부 채워야 한다. 예전엔 6지선다라
//    다섯 번 찍으면 열렸고, 오답마다 뜨던 반박문이 추론을 대신 해 줬다(그래서 반박문도 뺐다).
//
// 두 문제 다 사용자가 만든 HTML 프로토타입(의무실-혈액형퍼즐 / 의무실-감염경로퍼즐)의 로직을
// 그대로 옮겼다. 다만 **인물 배역은 방 코드로 섞는다** — 정답이 고정이면 한 번 푼 사람이 다음
// 판에 바로 찍는다(옛 탈옥문 고정코드 1863을 폐기한 것과 같은 이유).
//
// 답 검증은 클라가 한다 — 서버는 solve 신호만 중계한다(toolCode·laundryPlan과 같은 방침).

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

function shuffle<T>(rand: () => number, arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── ① 혈액형 판정(문 금고) ────────────────────────────────────────

export type BloodType = "O" | "A" | "B" | "AB";
export const BLOOD_TYPES: BloodType[] = ["O", "A", "B", "AB"];

/** 누가 누구에게 줄 수 있는가. 퍼즐 UI의 수혈 가능표이자 검사 키트의 판정 기준. */
export const GIVES: Record<BloodType, BloodType[]> = {
  O: ["O", "A", "B", "AB"],
  A: ["A", "AB"],
  B: ["B", "AB"],
  AB: ["AB"],
};

/** 병동 침대 수. 1이 창가, 마지막이 문가. */
export const BED_COUNT = 6;

export interface BloodPlan {
  /** 침대 1~BED_COUNT → 혈액형. **중복이 있을 수 있다**(같은 형이 둘 이상 누워 있어도 된다). */
  beds: Record<number, BloodType>;
  clues: string[];
  /** 검사 키트 사용 가능 횟수. */
  charges: number;
  /** 단서로 좁혀지는 배치 수. **항상 1이어야 한다**(전수 검사 스크립트가 이걸 본다). */
  solutions: number;
}

/** 두 침대 사이 수혈이 가능한가(검사 키트). 혈액형은 알려주지 않는다. */
export function canTransfuse(plan: BloodPlan, from: number, to: number): boolean {
  return GIVES[plan.beds[from]].includes(plan.beds[to]);
}

/** 침대를 부르는 말. 양 끝만 창가·문가로 부른다(단서 문장에 그대로 들어간다). */
function bedName(n: number): string {
  if (n === 1) return "1번(창가)";
  if (n === BED_COUNT) return `${BED_COUNT}번(문가)`;
  return `${n}번`;
}

/** 배치 후보 하나. 인덱스 0 = 1번 침대. */
type Layout = BloodType[];
interface ClueDef {
  text: string;
  test: (b: Layout) => boolean;
}

/** 이 사람이 나머지 전원에게 줄 수 있는가 / 아무에게도 못 주는가. */
const givesAll = (b: Layout, i: number) =>
  b.every((t, j) => j === i || GIVES[b[i]].includes(t));
const givesNone = (b: Layout, i: number) =>
  b.every((t, j) => j === i || !GIVES[b[i]].includes(t));

/** 4^BED_COUNT 배치를 모두 만든다(4096개). 유일해 검사에 쓴다. */
function allLayouts(): Layout[] {
  let acc: Layout[] = [[]];
  for (let i = 0; i < BED_COUNT; i++) {
    acc = acc.flatMap((l) => BLOOD_TYPES.map((t) => [...l, t]));
  }
  return acc;
}
const LAYOUTS = allLayouts();

/**
 * 실제 배치에 대해 **참인** 단서 후보를 모두 만든다.
 *
 * 앞쪽 무리부터 고르게 해 뒀다 — 수혈 관계·인원수처럼 추리할 맛이 있는 줄이 먼저 붙고,
 * "N번은 X형이 아니다"는 마지막에 온다. 단, 부정문 18줄이 후보에 늘 들어 있으므로
 * (침대마다 3줄) 어떤 배치든 단서를 다 붙이면 반드시 유일해가 된다 — 생성이 실패할 수 없다.
 */
function clueCandidates(rand: () => number, beds: Layout): ClueDef[] {
  const groups: ClueDef[][] = [];

  // ① 수혈 관계 — 프로토타입의 뼈대(O는 모두에게, AB는 누구에게도)를 그대로 남긴다.
  const rel: ClueDef[] = [];
  for (let i = 0; i < BED_COUNT; i++) {
    if (givesAll(beds, i)) {
      rel.push({
        text: `${bedName(i + 1)} 환자는 나머지 다섯 명 모두에게 수혈해 줄 수 있다.`,
        test: (b) => givesAll(b, i),
      });
    }
    if (givesNone(beds, i)) {
      rel.push({
        text: `${bedName(i + 1)} 환자는 나머지 다섯 명 중 누구에게도 수혈해 줄 수 없다.`,
        test: (b) => givesNone(b, i),
      });
    }
    for (let j = 0; j < BED_COUNT; j++) {
      if (i === j) continue;
      const ok = GIVES[beds[i]].includes(beds[j]);
      rel.push({
        text: `${bedName(i + 1)} 환자는 ${bedName(j + 1)} 환자에게 수혈해 줄 수 ${ok ? "있다" : "없다"}.`,
        test: (b) => GIVES[b[i]].includes(b[j]) === ok,
      });
    }
  }
  groups.push(rel);

  // ② 인원수 — "O형은 두 명이다" / "AB형은 한 명도 없다"
  const counts: ClueDef[] = BLOOD_TYPES.map((t) => {
    const k = beds.filter((x) => x === t).length;
    return {
      text: k === 0 ? `이 병동에 ${t}형은 한 명도 없다.` : `이 병동에 ${t}형은 ${k}명이다.`,
      test: (b: Layout) => b.filter((x) => x === t).length === k,
    };
  });
  groups.push(counts);

  // ③ 두 침대 비교 — 같다 / 다르다
  const pairs: ClueDef[] = [];
  for (let i = 0; i < BED_COUNT; i++) {
    for (let j = i + 1; j < BED_COUNT; j++) {
      const same = beds[i] === beds[j];
      pairs.push({
        text: `${bedName(i + 1)}과 ${bedName(j + 1)} 환자는 ${same ? "같은" : "서로 다른"} 혈액형이다.`,
        test: (b) => (b[i] === b[j]) === same,
      });
    }
  }
  groups.push(pairs);

  // ④ 부정문 — 마지막 수단. 이게 있어 어떤 배치든 반드시 유일해로 좁혀진다.
  const nots: ClueDef[] = [];
  for (let i = 0; i < BED_COUNT; i++) {
    for (const t of BLOOD_TYPES) {
      if (t === beds[i]) continue;
      nots.push({
        text: `${bedName(i + 1)} 환자는 ${t}형이 아니다.`,
        test: (b) => b[i] !== t,
      });
    }
  }
  groups.push(nots);

  return groups.flatMap((g) => shuffle(rand, g));
}

/**
 * 방 코드로 혈액형 문제를 만든다.
 *
 * 배치를 먼저 정하고, **답이 하나로 좁혀질 때까지** 참인 단서를 붙인 뒤 군더더기를 걷어낸다.
 * 손으로 짠 단서 네 줄로는 침대 여섯·중복 허용을 감당할 수 없다(유일해가 깨진다).
 */
function buildBloodPlan(seed: string): BloodPlan {
  const rand = rng(hash(`infirmary|blood|${seed || "solo"}`));

  // 배치: 너무 단조로우면(전원 같은 형 등) 추리가 안 되므로 최소 3종 이상, 한 형 최대 3명.
  let beds: Layout = [];
  for (let tries = 0; tries < 200; tries++) {
    beds = Array.from({ length: BED_COUNT }, () => BLOOD_TYPES[Math.floor(rand() * 4)]);
    const kinds = new Set(beds).size;
    const maxDup = Math.max(...BLOOD_TYPES.map((t) => beds.filter((x) => x === t).length));
    if (kinds >= 3 && maxDup <= 3) break;
  }

  // 유일해가 될 때까지 단서를 붙인다(해집합을 걸러 나가므로 후보 한 바퀴면 끝난다).
  const cands = clueCandidates(rand, beds);
  let sols = LAYOUTS;
  const chosen: ClueDef[] = [];
  for (const c of cands) {
    if (sols.length === 1) break;
    const next = sols.filter((l) => c.test(l));
    if (next.length === sols.length) continue; // 아무것도 못 줄이는 줄은 버린다
    sols = next;
    chosen.push(c);
  }

  // 군더더기 제거 — 빼도 여전히 유일하면 뺀다(순서를 뒤에서부터 훑어야 앞의 강한 줄이 남는다).
  const kept = [...chosen];
  for (let i = kept.length - 1; i >= 0; i--) {
    const without = kept.filter((_, k) => k !== i);
    if (LAYOUTS.filter((l) => without.every((c) => c.test(l))).length === 1) {
      kept.splice(i, 1);
    }
  }

  const bedsRec: Record<number, BloodType> = {};
  beds.forEach((t, i) => (bedsRec[i + 1] = t));
  return {
    beds: bedsRec,
    clues: shuffle(rand, kept).map((c) => c.text),
    charges: 2,
    solutions: LAYOUTS.filter((l) => kept.every((c) => c.test(l))).length,
  };
}

// 모달이 다시 그려질 때마다 4096개를 훑지 않도록 방 코드별로 한 번만 만든다.
const bloodCache = new Map<string, BloodPlan>();

export function bloodPlan(seed: string): BloodPlan {
  const key = seed || "solo";
  let p = bloodCache.get(key);
  if (!p) {
    p = buildBloodPlan(seed);
    bloodCache.set(key, p);
  }
  return p;
}

// ── ② 감염 경로 추적(표식) ────────────────────────────────────────

/**
 * 등장인물 여섯의 <b>배역</b>. 이름만 방 코드로 섞고 접촉·발현 시각은 고정이다 —
 * 시각까지 흔들면 유일해가 깨질 수 있는데, 이름만 섞어도 매판 답이 달라진다.
 *
 *   index  : 최초 감염자. 끝내 증상이 없다(정답)
 *   first  : index가 11:00에 옮김 → 17:00 발현
 *   second : first가 15:00에 옮김 → 21:00 발현
 *   third  : second가 17:00에 옮김 → 23:00 발현
 *   late   : index가 20:00에 옮김 → 발현은 자정 이후라 기록에 없다
 *   extra  : 감염과 무관. 이른 시각 접촉 기록만 둘 있다(함정)
 */
type Role = "index" | "first" | "second" | "third" | "late" | "extra";
const ROLES: Role[] = ["index", "first", "second", "third", "late", "extra"];

const CAST = [
  "청소 담당",
  "배식 담당",
  "간호사",
  "1번 침대 환자",
  "2번 침대 환자",
  "3번 침대 환자",
];

/** 도표의 행 순서(위→아래). 배역이 아니라 자리라, 정답이 늘 같은 줄에 오지 않게 섞는다. */
export interface OutbreakPerson {
  name: string;
  role: Role;
}
export interface Contact {
  /** 24시간제 시각(정시). */
  hour: number;
  a: string;
  b: string;
  /** 이 접촉으로 전파가 일어났는가(도표엔 표시하지 않는다 — 추리로 알아내야 한다). */
  spread: boolean;
}
export interface Onset {
  name: string;
  hour: number;
}
/** 감염원 칸의 특별 선택지. 사람 이름과 같은 자리에 들어간다. */
export const SRC_NONE = "감염되지 않음";
export const SRC_OUTSIDE = "외부에서 들여옴";

export interface OutbreakPlan {
  /** 도표 행 순서 */
  people: OutbreakPerson[];
  contacts: Contact[];
  onsets: Onset[];
  /** 정답(최초 감염자 이름) — 해금 문구에 쓴다. */
  answer: string;
  /** **정답표**: 사람 → 감염원(다른 사람 이름 / SRC_OUTSIDE / SRC_NONE). 이걸 다 채워야 열린다. */
  sourceOf: Record<string, string>;
  /** 정답 뒤 공개하는 전파 경로. */
  chain: string[];
}

/** 감염 후 발현까지(시간). 규칙 문구와 반박 문구가 함께 쓴다. */
export const INCUBATION_H = 6;

const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

/** 방 코드로 감염 경로 문제를 만든다. */
export function outbreakPlan(seed: string): OutbreakPlan {
  const rand = rng(hash(`infirmary|outbreak|${seed || "solo"}`));

  // 배역 ↔ 이름 배정. 이름 여섯을 섞어 배역 여섯에 하나씩 준다.
  const names = shuffle(rand, CAST);
  const of = {} as Record<Role, string>;
  ROLES.forEach((r, i) => (of[r] = names[i]));

  const contacts: Contact[] = [
    // 아무도 아직 감염되지 않은 시각의 접촉들(함정 — 기록은 있지만 아무 일도 없었다)
    { hour: 2, a: of.extra, b: of.second, spread: false },
    { hour: 5, a: of.late, b: of.first, spread: false },
    { hour: 8, a: of.extra, b: of.late, spread: false },
    // 전파 사슬
    { hour: 11, a: of.index, b: of.first, spread: true },
    { hour: 15, a: of.first, b: of.second, spread: true },
    { hour: 17, a: of.second, b: of.third, spread: true },
    // 늦은 전파 — 발현이 자정을 넘겨 기록에 안 남는다
    { hour: 20, a: of.index, b: of.late, spread: true },
  ];

  const onsets: Onset[] = [
    { name: of.first, hour: 11 + INCUBATION_H },
    { name: of.second, hour: 15 + INCUBATION_H },
    { name: of.third, hour: 17 + INCUBATION_H },
  ];

  /**
   * 정답표. 각 줄이 기록 하나로 확정된다:
   *   - 발현자 셋은 발현 −6시간의 접촉 상대가 감염원이다(11·15·17시 접촉 하나씩).
   *   - late는 20:00에 index와 만났고 그때 index는 이미 감염 상태다 → 규칙상 반드시 옮는다.
   *     발현은 자정 넘어서라 기록에 없다.
   *   - extra의 접촉 상대(02시 second·08시 late)는 그 시각 둘 다 미감염 → 옮을 길이 없다.
   *   - index는 감염원이 기록에 없다 → 외부.
   *
   * ⚠️ 규칙 "외부에서 들여온 사람은 끝내 증상이 없었다"가 **유일해의 전제**다. 이게 없으면
   * "first가 외부에서 감염돼(11:00) 같은 자리에서 index에게 옮겼다"는 뒤집은 해석도 성립해
   * 답이 둘이 된다. 화면 규칙 목록(OutbreakQuiz)에 이 줄을 반드시 함께 띄울 것.
   */
  const sourceOf: Record<string, string> = {
    [of.index]: SRC_OUTSIDE,
    [of.first]: of.index,
    [of.second]: of.first,
    [of.third]: of.second,
    [of.late]: of.index,
    [of.extra]: SRC_NONE,
  };

  const chain = [
    `${of.index} → ${of.first} · ${hh(11)} · 발현 ${hh(17)}`,
    `${of.first} → ${of.second} · ${hh(15)} · 발현 ${hh(21)}`,
    `${of.second} → ${of.third} · ${hh(17)} · 발현 ${hh(23)}`,
    `${of.index} → ${of.late} · ${hh(20)} · 발현은 자정 이후`,
  ];

  // 도표 행 순서는 배역과 무관하게 섞는다 — 정답이 늘 같은 줄에 오면 눈에 익는다.
  const people: OutbreakPerson[] = shuffle(
    rand,
    ROLES.map((r) => ({ name: of[r], role: r })),
  );

  return { people, contacts, onsets, answer: of.index, sourceOf, chain };
}

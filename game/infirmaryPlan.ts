// 의무실 퍼즐 — 두 단계. 둘 다 방 코드로 매판 생성한다(같은 방이면 모두 같은 문제를 본다).
//
// ① 진입(문 밖 복도, lock-med): **혈액형 판정**. 침대 넷에 O·A·B·AB가 하나씩 누워 있는데
//    차트의 혈액형 칸만 젖어 지워졌다. 단서 넷을 읽어 배치를 복원하고, O·A·B·AB 순서로
//    그 환자의 침대 번호를 적으면(네 자리) 문 옆 금고가 열린다.
//    혈액 검사 키트는 두 침대 사이 "수혈 가능 여부"만 알려준다(혈액형은 안 알려준다). 2회 한정.
//
// ② 표식(방 안, quiz-med): **감염 경로 추적**. 어제 하루의 접촉 기록(누가 몇 시에 누구와)과
//    증상 발현 시각 셋이 있다. 감염은 접촉 즉시, 발현은 정확히 6시간 뒤, 발현 전에도 옮긴다.
//    이 병동에 감염을 처음 들여온 사람 하나를 지목한다 — 답은 **증상이 끝내 없는 사람**이라
//    발현 기록만 훑어서는 못 찾는다.
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

export interface BloodPlan {
  /** 침대 1~4 → 혈액형. 1이 창가, 4가 문가. */
  beds: Record<number, BloodType>;
  clues: string[];
  /** 정답 네 자리 = O·A·B·AB 환자의 침대 번호. */
  code: string;
  /** 검사 키트 사용 가능 횟수. */
  charges: number;
}

/** 두 침대 사이 수혈이 가능한가(검사 키트). 혈액형은 알려주지 않는다. */
export function canTransfuse(plan: BloodPlan, from: number, to: number): boolean {
  return GIVES[plan.beds[from]].includes(plan.beds[to]);
}

/**
 * 방 코드로 혈액형 문제를 만든다.
 *
 * 단서 구성은 프로토타입 그대로다. 배치가 유일하게 정해지는 근거는 셋뿐이라 이 뼈대를 지킨다:
 *   - O형만 셋 모두에게 줄 수 있다 → O의 자리가 정해진다
 *   - AB형만 누구에게도 못 준다   → AB의 자리가 정해진다
 *   - 남은 둘(A·B)은 **수혈 관계로는 절대 구분되지 않는다**(서로 못 주고, 받는 쪽도 대칭이다).
 *     그래서 A의 자리를 직접 지목하는 단서가 반드시 하나 있어야 한다. 이걸 빼면 답이 둘이 된다.
 * 나머지 한 줄(창가 부정문)은 교차 확인용이고, 언제나 참이 되게 만든다.
 */
export function bloodPlan(seed: string): BloodPlan {
  const rand = rng(hash(`infirmary|blood|${seed || "solo"}`));

  const order = shuffle(rand, BLOOD_TYPES);
  const beds: Record<number, BloodType> = { 1: order[0], 2: order[1], 3: order[2], 4: order[3] };
  const bedOf = (t: BloodType) => Number(Object.keys(beds).find((k) => beds[Number(k)] === t));

  const oBed = bedOf("O");
  const abBed = bedOf("AB");
  const aBed = bedOf("A");

  // 창가(1번) 부정문 — 1번이 아닌 혈액형 중 하나를 고른다(항상 참).
  const notAtWindow = shuffle(rand, BLOOD_TYPES.filter((t) => t !== beds[1]))[0];
  // A의 자리를 지목하는 줄. 창가·문가면 그 말로, 아니면 번호로 부른다.
  const aWhere = aBed === 1 ? "창가 침대" : aBed === 4 ? "문가 침대" : `${aBed}번 침대`;

  const clues = shuffle(rand, [
    `창가 침대 환자는 ${notAtWindow}형이 아니다.`,
    `${oBed}번 침대 환자는 나머지 세 명 모두에게 수혈해 줄 수 있다.`,
    `${abBed}번 침대 환자는 나머지 세 명 중 누구에게도 수혈해 줄 수 없다.`,
    `A형 환자는 ${aWhere}에 있다.`,
  ]);

  return {
    beds,
    clues,
    code: `${oBed}${aBed}${bedOf("B")}${abBed}`,
    charges: 2,
  };
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
export interface OutbreakPlan {
  /** 도표 행 순서 */
  people: OutbreakPerson[];
  contacts: Contact[];
  onsets: Onset[];
  /** 정답(최초 감염자 이름) */
  answer: string;
  /** 지목이 틀렸을 때 보여줄 반박. 이름 → 문구. */
  rebuttals: Record<string, string>;
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

  const rebuttals: Record<string, string> = {
    [of.first]:
      `${hh(17)} 발현이니 감염된 시각은 ${hh(11)}이다. 그 시각에 만난 상대가 따로 있다.`,
    [of.second]:
      `${hh(21)} 발현이니 감염된 시각은 ${hh(15)}이다. 그 시각의 접촉 상대는 ${of.first}다.`,
    [of.third]:
      `${hh(23)} 발현으로 가장 늦다. 감염은 ${hh(17)}, 상대는 ${of.second}다.`,
    [of.extra]:
      `${hh(2)}과 ${hh(8)}에 접촉 기록이 있지만 상대 두 사람 다 그 시각에는 아직 감염 전이었다. ` +
      `${of.extra}가 최초였다면 ${of.second}가 ${hh(8)}에 발현했어야 한다. 실제 발현은 ${hh(21)}이다.`,
    [of.late]:
      `증상 기록이 없어 의심스럽지만, ${of.late}가 최초였다면 ${hh(5)}에 만난 ${of.first}가 ` +
      `${hh(11)}에 발현했어야 한다. ${of.first}의 실제 발현은 ${hh(17)}이다.`,
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

  return { people, contacts, onsets, answer: of.index, rebuttals, chain };
}

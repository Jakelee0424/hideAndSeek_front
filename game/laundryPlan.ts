// 세탁실 퍼즐 — 두 단계. 둘 다 방 코드로 매판 생성한다(같은 방이면 모두 같은 문제를 본다).
//
// ① 진입(문 밖 복도, lock-laundry): 배관 밸브 4개 + 옆에 걸린 "배관 노선도".
//    노선도는 답을 적어 주지 않는다 — 급수 본관에서 세탁조까지 이어지는 관을 따라가며,
//    ①~④ 밸브 자리에서 관이 **어느 쪽으로 이어지는지**를 스스로 읽어야 한다.
//    갈림길마다 죽은 가지(폐수조·보일러·막힘)가 하나씩 붙어 있어 그냥 눈에 띄는 쪽을
//    고르면 틀린다. 밸브는 45°씩 도는 핸들이라 8방향 중 하나를 고르는 셈이다.
//    램프는 **상류부터** 켜진다(물이 그 밸브까지 닿아야 압력이 걸린다) — ①이 틀리면
//    ②~④는 맞아도 안 켜진다. 넷 다 초록이면 문이 열린다.
//
// ② 표식(방 안 건조대, quiz-laundry): 벽의 "오늘 세탁 일정"이 요구하는 관리 기호 4가지
//    (세탁·표백·건조·다림질)와 **네 가지 모두** 일치하는 옷을 건조대에서 찾는다.
//    가짜는 대부분 기호 하나만 다르다 — 한 칸만 보고 고르면 틀린다. 맞히면 세탁실 벽에
//    표식이 드러난다(Map.RoomStamps).
//
// 답 검증은 전부 클라(퍼즐 UI)가 한다 — 서버는 solve 신호만 브로드캐스트하므로 시드를
// 맞출 필요가 없다(toolCode.ts·cafeteriaPlan.ts와 같은 방침).

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

// ── ① 배관 밸브 ───────────────────────────────────────────────────

/** 방향 0~7 = 북에서 시계방향 45°씩. 노선도(위=북)와 밸브 핸들이 같은 기준을 쓴다. */
export type Dir = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DIR_NAMES = ["북", "북동", "동", "남동", "남", "남서", "서", "북서"];
/** 방향 → 격자 이동량. row는 남쪽이 +다(노선도에서 아래쪽). */
export const DIR_STEP: [number, number][] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** 노선도 격자 크기. 관은 급수(col 0)에서 세탁조(col 5)까지 동쪽으로 흐른다. */
export const PIPE_COLS = 6;
export const PIPE_ROWS = 4;

export interface PipeCell {
  col: number;
  row: number;
}
export interface PipeDead {
  from: PipeCell; // 갈라져 나온 밸브 자리
  to: PipeCell; // 죽은 가지 끝(라벨 상자)
  label: string;
}
export interface PipeValve {
  no: number; // ①~④ (상류부터. 밸브 패널 번호와 같다)
  at: PipeCell;
  answer: Dir; // 이 밸브에서 관이 이어지는 방향 = 핸들을 맞춰야 하는 방향
}
export interface PipeMap {
  source: PipeCell; // 급수 본관
  target: PipeCell; // 세탁조
  valves: PipeValve[];
  dead: PipeDead[]; // 죽은 가지(노선도에만 그린다)
}

// 죽은 가지 끝에 붙는 이름. 어느 것도 세탁조가 아니다 — 관을 끝까지 따라가야 구분된다.
const DEAD_LABELS = ["폐수조", "보일러(정비중)", "막힘", "온수 탱크", "구 배관(폐쇄)", "정화조"];

/**
 * 방 코드로 배관 노선도를 만든다.
 *
 * 관은 항상 동쪽으로 한 칸씩 전진하되 위/아래로 꺾일 수 있다(북동·동·남동 셋 중 하나).
 * 그래서 노선도가 스스로 겹치지 않고, 밸브가 가질 수 있는 정답도 세 방향으로 좁혀진다
 * — 8방향 전부를 열어 두면 노선도를 못 읽어도 찍어서 맞을 수 있다.
 */
export function laundryPipes(seed: string): PipeMap {
  const rand = rng(hash(`laundry|pipes|${seed || "solo"}`));

  // 경로: (0,r0) → 밸브 4개(col 1~4) → 세탁조(col 5). 매 칸 북동/동/남동 중 하나로 전진.
  const path: PipeCell[] = [{ col: 0, row: 1 + Math.floor(rand() * 2) }];
  const steps: Dir[] = [];
  for (let i = 0; i < 5; i++) {
    const prev = path[i];
    const options: Dir[] = [2];
    if (prev.row > 0) options.push(1);
    if (prev.row < PIPE_ROWS - 1) options.push(3);
    const d = options[Math.floor(rand() * options.length)];
    steps.push(d);
    path.push({ col: prev.col + 1, row: prev.row + DIR_STEP[d][1] });
  }

  // 밸브 = path[1..4]. 밸브 i의 정답은 **그 밸브를 떠나는** 방향(steps[i]).
  const valves: PipeValve[] = [1, 2, 3, 4].map((i) => ({
    no: i,
    at: path[i],
    answer: steps[i],
  }));

  // 죽은 가지: 밸브마다 1~2개. 경로 칸/다른 가지 끝과 겹치지 않는 이웃 칸으로 한 홉.
  const taken = new Set(path.map((c) => `${c.col},${c.row}`));
  const labels = shuffle(rand, DEAD_LABELS);
  const dead: PipeDead[] = [];
  for (const v of valves) {
    const incoming = steps[v.no - 1]; // 이 밸브로 들어온 방향
    const back = ((incoming + 4) % 8) as Dir; // 들어온 쪽(관이 이미 그려져 있다)
    const cand = ([0, 1, 2, 3, 4, 5, 6, 7] as Dir[]).filter((d) => {
      if (d === v.answer || d === back) return false;
      const to = { col: v.at.col + DIR_STEP[d][0], row: v.at.row + DIR_STEP[d][1] };
      if (to.col < 0 || to.col >= PIPE_COLS || to.row < 0 || to.row >= PIPE_ROWS) return false;
      return !taken.has(`${to.col},${to.row}`);
    });
    const pick = shuffle(rand, cand).slice(0, 1 + Math.floor(rand() * 2));
    for (const d of pick) {
      const to = { col: v.at.col + DIR_STEP[d][0], row: v.at.row + DIR_STEP[d][1] };
      taken.add(`${to.col},${to.row}`);
      dead.push({ from: v.at, to, label: labels[dead.length % labels.length] });
    }
  }

  return { source: path[0], target: path[5], valves, dead };
}

// ── ② 세탁 라벨 대조 ──────────────────────────────────────────────

export const CARE_CATS = ["wash", "bleach", "dry", "iron"] as const;
export type CareCat = (typeof CARE_CATS)[number];

export const CAT_LABELS: Record<CareCat, string> = {
  wash: "세탁",
  bleach: "표백",
  dry: "건조 방식",
  iron: "다림질",
};

/** 관리 기호 변형. key는 CareSymbol이 그리는 모양, label은 표에 적는 말. */
export const CARE_VARIANTS: Record<CareCat, { key: string; label: string }[]> = {
  wash: [
    { key: "30", label: "물 30℃" },
    { key: "40", label: "물 40℃" },
    { key: "60", label: "물 60℃" },
    { key: "hand", label: "손세탁" },
  ],
  bleach: [
    { key: "any", label: "표백 가능" },
    { key: "oxygen", label: "산소계 표백만" },
    { key: "none", label: "표백 금지" },
  ],
  dry: [
    { key: "tumbleLow", label: "기계건조 약" },
    { key: "tumbleNone", label: "기계건조 금지" },
    { key: "line", label: "옷걸이 건조" },
    { key: "flat", label: "뉘어서 건조" },
  ],
  iron: [
    { key: "110", label: "다림질 110℃" },
    { key: "150", label: "다림질 150℃" },
    { key: "200", label: "다림질 200℃" },
    { key: "none", label: "다림질 금지" },
  ],
};

/** 기호 key → 표시용 이름. */
export function careLabel(cat: CareCat, key: string): string {
  return CARE_VARIANTS[cat].find((v) => v.key === key)?.label ?? key;
}

export type CareSet = Record<CareCat, string>;

export interface Garment {
  no: number; // 건조대에 걸린 번호(1~8)
  name: string;
  care: CareSet;
}
export interface CarePlan {
  today: CareSet; // 벽의 "오늘 세탁 일정"
  garments: Garment[]; // 건조대의 옷 8벌
  answerNo: number; // 네 기호가 전부 일치하는 딱 한 벌
}

const GARMENT_NAMES = [
  "죄수복 상의",
  "죄수복 바지",
  "수건",
  "담요",
  "작업복",
  "침대 시트",
  "양말",
  "베갯잇",
  "조끼",
  "앞치마",
];

const GARMENT_COUNT = 8;

/** 방 코드로 세탁 라벨 문제를 만든다. 정답 1벌 + 기호 하나만 다른 가짜들. */
export function laundryCare(seed: string): CarePlan {
  const rand = rng(hash(`laundry|care|${seed || "solo"}`));

  const today = {} as CareSet;
  for (const cat of CARE_CATS) {
    const vs = CARE_VARIANTS[cat];
    today[cat] = vs[Math.floor(rand() * vs.length)].key;
  }

  const key = (c: CareSet) => CARE_CATS.map((k) => c[k]).join("|");
  const used = new Set<string>([key(today)]);
  const fakes: CareSet[] = [];

  // 가짜는 기호를 몇 개 바꿔 만든다. 대부분(6벌) 한 개만 달라 한 칸만 보고는 못 고른다.
  // 마지막 한 벌만 두 개를 바꾼다 — 전부 "한 개 차이"면 "한 칸만 다르면 가짜"라는
  // 엉뚱한 규칙으로도 풀려 버린다.
  const diffPlan = [1, 1, 1, 1, 1, 1, 2];
  for (const diffs of diffPlan) {
    let cand: CareSet | null = null;
    for (let tries = 0; tries < 40 && !cand; tries++) {
      const c = { ...today };
      const cats = shuffle(rand, CARE_CATS).slice(0, diffs);
      for (const cat of cats) {
        const others = CARE_VARIANTS[cat].filter((v) => v.key !== today[cat]);
        c[cat] = others[Math.floor(rand() * others.length)].key;
      }
      if (!used.has(key(c))) cand = c;
    }
    if (!cand) continue; // 조합이 동나는 일은 없지만, 모자라면 그만큼 옷이 줄 뿐이다
    used.add(key(cand));
    fakes.push(cand);
  }

  const names = shuffle(rand, GARMENT_NAMES).slice(0, GARMENT_COUNT);
  // 정답을 아무 자리에나 섞는다(늘 1번이면 찍어서 맞는다).
  const sets = shuffle(rand, [today, ...fakes]);
  const garments: Garment[] = sets.map((care, i) => ({
    no: i + 1,
    name: names[i] ?? `세탁물 ${i + 1}`,
    care,
  }));
  const answer = garments.find((g) => key(g.care) === key(today))!;

  return { today, garments, answerNo: answer.no };
}

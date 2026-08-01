// 세탁실 퍼즐 — 두 단계. 둘 다 방 코드로 매판 생성한다(같은 방이면 모두 같은 문제를 본다).
//
// ① 진입(문 밖 복도, lock-laundry): 배관 밸브 4개 + 옆에 걸린 "배관 노선도".
//    노선도는 답을 적어 주지 않는다 — 급수 본관에서 세탁조까지 이어지는 관을 따라가며,
//    ①~④ 밸브 자리에서 관이 **어느 쪽으로 이어지는지**를 스스로 읽어야 한다.
//    갈림길마다 죽은 가지(폐수조·보일러·막힘)가 하나씩 붙어 있어 그냥 눈에 띄는 쪽을
//    고르면 틀린다. 밸브는 45°씩 도는 핸들이라 8방향 중 하나를 고르는 셈이다.
//    ⚠️ **밸브별 램프는 없앴다(2026-08-01).** 예전엔 상류부터 하나씩 켜져서 ①을 3번 안에
//    맞추고 ②로 넘어가는 식으로 밸브를 **하나씩 독립적으로** 풀 수 있었다(12클릭이면 열렸다).
//    지금은 넷을 다 돌린 뒤 확인을 눌러야 하고, 틀려도 어느 밸브가 어긋났는지 알려주지 않는다.
//
// ② 표식(방 안 건조대, quiz-laundry): 벽의 "오늘 세탁 일정"이 요구하는 관리 기호 4가지
//    (세탁·표백·건조·다림질)와 **네 가지 모두** 일치하는 옷을 건조대에서 찾는다.
//    ⚠️ **정답은 한 벌이 아니라 여러 벌이다(2026-08-01).** 예전엔 딱 한 벌이라 8지선다였고
//    일곱 번 찍으면 열렸다. 지금은 완전 일치하는 옷이 3벌이고 **그걸 전부** 골라야 한다
//    (몇 벌인지는 알려주지 않는다 — 알려주면 C(8,3)=56, 안 알려주면 2^8=256).
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
  /** 급수→세탁조 본선 전체. 밸브가 아닌 꺾임 칸도 들어 있다 — 노선도는 이 선을 그린다. */
  path: PipeCell[];
  valves: PipeValve[];
  dead: PipeDead[]; // 죽은 가지(노선도에만 그린다)
}

/** 본선 칸 수(급수 + 중간 6칸 + 세탁조). 밸브는 이 중 중간 칸 넷에 앉는다. */
const PATH_CELLS = 8;

const cellKey = (c: PipeCell) => `${c.col},${c.row}`;

/** 두 이웃 칸 사이의 방향. 인접하지 않으면 호출하지 않는다. */
function dirBetween(a: PipeCell, b: PipeCell): Dir {
  const dc = b.col - a.col;
  const dr = b.row - a.row;
  return DIR_STEP.findIndex(([x, y]) => x === dc && y === dr) as Dir;
}

/**
 * 급수(col 0)에서 세탁조(마지막 col)까지 PATH_CELLS칸짜리 **단순경로**를 찾는다(8방향 DFS).
 *
 * 칸 수를 가로폭보다 넉넉히 잡은 것이 요점이다. 예전 생성기는 매 칸 동쪽으로 한 칸씩만
 * 전진해서 밸브 정답이 북동·동·남동 **셋뿐**이었다 — 램프를 없앤 지금은 그 제한이 곧
 * 찍기 공간(3⁴=81)이 된다. 여유 칸이 있으면 북·남으로 꺾이는 구간이 생겨 정답이 8방향에
 * 고루 퍼진다. 자기교차는 막는다(관이 겹치면 노선도를 읽을 수 없다).
 */
function findPipePath(rand: () => number, start: PipeCell): PipeCell[] | null {
  const path: PipeCell[] = [start];
  const seen = new Set<string>([cellKey(start)]);
  const ALL: Dir[] = [0, 1, 2, 3, 4, 5, 6, 7];

  function step(): boolean {
    const cur = path[path.length - 1];
    const left = PATH_CELLS - path.length; // 남은 이동 횟수
    if (left === 0) return cur.col === PIPE_COLS - 1;
    for (const d of shuffle(rand, ALL)) {
      const to = { col: cur.col + DIR_STEP[d][0], row: cur.row + DIR_STEP[d][1] };
      if (to.col < 0 || to.col >= PIPE_COLS || to.row < 0 || to.row >= PIPE_ROWS) continue;
      if (seen.has(cellKey(to))) continue;
      // 남은 이동으로 세탁조 열까지 못 닿으면 가지 않는다.
      if (PIPE_COLS - 1 - to.col > left - 1) continue;
      seen.add(cellKey(to));
      path.push(to);
      if (step()) return true;
      path.pop();
      seen.delete(cellKey(to));
    }
    return false;
  }

  return step() ? path : null;
}

/**
 * 방 코드로 배관 노선도를 만든다.
 *
 * 밸브는 본선 중간 칸 여섯 중 넷에 앉는다. 밸브의 정답은 **그 칸을 떠나는** 방향이다.
 * 밸브가 아닌 꺾임 칸이 섞이므로 "밸브에서 밸브로 직선"이라는 짐작이 통하지 않는다.
 */
export function laundryPipes(seed: string): PipeMap {
  const rand = rng(hash(`laundry|pipes|${seed || "solo"}`));

  // 시작 행을 섞어 시도한다. 6×4 격자에 8칸이면 어느 행에서든 경로가 나오지만,
  // 경로를 못 찾은 채 되돌아오면 문이 영영 안 열리므로 전 행을 훑는 폴백을 둔다.
  let path: PipeCell[] | null = null;
  for (const row of shuffle(rand, [0, 1, 2, 3].slice(0, PIPE_ROWS))) {
    path = findPipePath(rand, { col: 0, row });
    if (path) break;
  }
  if (!path) {
    // 여기 오는 시드는 없다(전수 검사 완료). 와도 게임이 막히지 않게 직선으로 깐다.
    path = Array.from({ length: PATH_CELLS }, (_, i) => ({ col: Math.min(i, PIPE_COLS - 1), row: 1 }));
  }

  // 밸브 자리 = 중간 칸(1 … PATH_CELLS-2) 중 넷. 상류부터 ①②③④.
  const middle = Array.from({ length: PATH_CELLS - 2 }, (_, i) => i + 1);
  const valveIdx = shuffle(rand, middle).slice(0, 4).sort((a, b) => a - b);
  const valves: PipeValve[] = valveIdx.map((idx, i) => ({
    no: i + 1,
    at: path![idx],
    answer: dirBetween(path![idx], path![idx + 1]),
  }));

  // 죽은 가지: 밸브마다 1~2개. 본선 칸/다른 가지 끝과 겹치지 않는 이웃 칸으로 한 홉.
  const taken = new Set(path.map(cellKey));
  const labels = shuffle(rand, DEAD_LABELS);
  const dead: PipeDead[] = [];
  valveIdx.forEach((idx, i) => {
    const at = path![idx];
    const back = dirBetween(at, path![idx - 1]); // 관이 이미 그려진 상류 쪽
    const cand = ([0, 1, 2, 3, 4, 5, 6, 7] as Dir[]).filter((d) => {
      if (d === valves[i].answer || d === back) return false;
      const to = { col: at.col + DIR_STEP[d][0], row: at.row + DIR_STEP[d][1] };
      if (to.col < 0 || to.col >= PIPE_COLS || to.row < 0 || to.row >= PIPE_ROWS) return false;
      return !taken.has(cellKey(to));
    });
    const pick = shuffle(rand, cand).slice(0, 1 + Math.floor(rand() * 2));
    for (const d of pick) {
      const to = { col: at.col + DIR_STEP[d][0], row: at.row + DIR_STEP[d][1] };
      taken.add(cellKey(to));
      dead.push({ from: at, to, label: labels[dead.length % labels.length] });
    }
  });

  return { source: path[0], target: path[PATH_CELLS - 1], path, valves, dead };
}

// 죽은 가지 끝에 붙는 이름. 어느 것도 세탁조가 아니다 — 관을 끝까지 따라가야 구분된다.
const DEAD_LABELS = ["폐수조", "보일러(정비중)", "막힘", "온수 탱크", "구 배관(폐쇄)", "정화조"];

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
  /** 네 기호가 전부 일치하는 옷들의 번호(오름차순). 이걸 **전부** 골라야 열린다. */
  answerNos: number[];
}

/** 완전 일치하는 옷 수. 화면에는 알려주지 않는다 — 알려주면 답 공간이 2^8에서 C(8,3)으로 준다. */
const ANSWER_COUNT = 3;

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

/** 방 코드로 세탁 라벨 문제를 만든다. 완전 일치 3벌 + 기호 한둘만 다른 가짜 5벌. */
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

  // 가짜는 기호를 몇 개 바꿔 만든다. 대부분(4벌) 한 개만 달라 한 칸만 보고는 못 고른다.
  // 마지막 한 벌만 두 개를 바꾼다 — 전부 "한 개 차이"면 "한 칸만 다르면 가짜"라는
  // 엉뚱한 규칙으로도 풀려 버린다.
  const diffPlan = [1, 1, 1, 1, 2];
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
  // 정답 3벌은 라벨이 서로 같다(같은 관리 기호를 가진 옷이 여럿인 건 자연스럽다).
  // 자리는 섞는다 — 늘 앞자리에 몰리면 찍어서 맞는다.
  const sets = shuffle(rand, [...Array.from({ length: ANSWER_COUNT }, () => today), ...fakes]);
  const garments: Garment[] = sets.map((care, i) => ({
    no: i + 1,
    name: names[i] ?? `세탁물 ${i + 1}`,
    care,
  }));
  const answerNos = garments.filter((g) => key(g.care) === key(today)).map((g) => g.no);

  return { today, garments, answerNos };
}

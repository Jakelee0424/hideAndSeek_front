// 식당 퍼즐 — 두 단계.
//
// ① 입장: 게임 시작 나레이션이 오늘 요일을 알려준다. 문 좌측 벽 "배식 순서표"에서 오늘 요일
//    줄의 네 자리 코드를 찾아 문 자물쇠(lock-cafe)에 입력 → 입장.
//
// ② 냉장고 코드(표식 획득): 문 좌측 벽 "오늘의 식단표"에 오늘 반찬 4개의 기준량(g)·기준
//    칼로리(kcal)가 적혀 있다(→ 1g당 칼로리). 배식대 위 "식판"을 열면 반찬 4 + 간식 1의
//    실제 담긴 양(g)이 나온다. 실제 양은 기준보다 항상 적으므로 비율로 실제 칼로리를 구한다:
//      반찬 실제칼로리 = (기준칼로리 ÷ 기준량) × 실제량.
//    간식은 식단표에 없으니(기준이 없어 계산 불가) 뺀다 — 함정이다. 반찬 4개 실제칼로리의
//    합이 냉장고 코드(lock-fridge)이고, 풀면 식당 벽에 표식이 드러난다.
//
// 방 코드로 매판 생성(요일·코드·반찬·양 전부 랜덤). 답 검증은 클라가 하므로 서버와 무관하다.
export const DAYS = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];

// 오늘 반찬 후보(4개 뽑는다). 간식 후보(1개 — 식단표엔 안 나온다).
const BANCHAN = [
  "제육볶음",
  "계란말이",
  "시금치나물",
  "어묵볶음",
  "콩나물무침",
  "감자조림",
  "멸치볶음",
  "두부조림",
  "미역줄기볶음",
  "고구마맛탕",
];
const SNACKS = ["요구르트", "사과", "우유", "바나나", "초코바"];

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

function shuffle<T>(rand: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Dish {
  name: string;
  std: number; // 기준 제공량(g)
  cal: number; // 기준량일 때 칼로리(kcal). cal/std = 1g당 칼로리(정수)
}
export interface TrayItem {
  name: string;
  amount: number; // 실제 담긴 양(g)
  snack: boolean; // 간식이면 true — 식단표에 없어 계산 제외
}

export interface CafeteriaPlan {
  today: number; // 오늘 요일 index(0=월 … 6=일)
  order: { day: string; code: string }[]; // ① 배식 순서표(요일 → 네 자리 코드)
  code: string; // ① 입장 정답 — 오늘 요일 줄의 코드
  menu: Dish[]; // ② 오늘의 식단표 — 반찬 4개(기준량·기준칼로리). 간식 없음
  tray: TrayItem[]; // ② 식판 — 반찬 4 + 간식 1의 실제 담긴 양
  fridgeCode: string; // ② 냉장고 정답 — 반찬 4개 실제칼로리의 합
}

/** 방 코드로 식당 퍼즐을 만든다. 같은 방이면 모두 같은 요일·표·식판을 본다. */
export function cafeteriaPlan(seed: string): CafeteriaPlan {
  const rand = rng(hash(`cafeteria|${seed || "solo"}`));

  // ── ① 입장(요일 코드) ──
  const today = Math.floor(rand() * 7);
  const order: { day: string; code: string }[] = [];
  const used = new Set<string>();
  for (const day of DAYS) {
    let code = "";
    do {
      code = "";
      for (let i = 0; i < 4; i++) code += Math.floor(rand() * 10);
    } while (used.has(code));
    used.add(code);
    order.push({ day, code });
  }

  // ── ② 냉장고 코드(반찬 칼로리 합) ──
  const banchan = shuffle(rand, BANCHAN).slice(0, 4);
  const snack = shuffle(rand, SNACKS)[0];
  const menu: Dish[] = [];
  const tray: TrayItem[] = [];
  let sum = 0;
  for (const name of banchan) {
    // 계산이 딱 떨어지게 전부 50 단위로 맞춘다: 1g당 칼로리(density)는 2~4 정수,
    // 기준량·기준칼로리·실제량·실제칼로리는 모두 50의 배수가 된다.
    const density = 2 + Math.floor(rand() * 3); // 1g당 2~4 kcal(정수)
    const std = 150 + 50 * Math.floor(rand() * 4); // 기준량 150/200/250/300 g
    const cal = density * std; // 기준칼로리(cal/std = density, 정수)
    // 실제량: 50g 배수, 50 ~ (기준-50) → 항상 기준보다 적다.
    const amount = 50 * (1 + Math.floor(rand() * (std / 50 - 1)));
    sum += density * amount; // 반찬 실제칼로리(50의 배수)
    menu.push({ name, std, cal });
    tray.push({ name, amount, snack: false });
  }
  // 간식(식단표엔 없음). 실제 양만 있고 계산에서 빠져야 한다. 50/100/150 g.
  tray.push({ name: snack, amount: 50 * (1 + Math.floor(rand() * 3)), snack: true });

  return {
    today,
    order,
    code: order[today].code,
    menu,
    // 식판은 순서를 섞는다 — 간식이 늘 끝에 오면 함정이 티가 난다.
    tray: shuffle(rand, tray),
    fridgeCode: String(sum),
  };
}

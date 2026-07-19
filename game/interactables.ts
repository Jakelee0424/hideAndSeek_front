// 맵에 배치된 상호작용 오브젝트 정의 + 근접/퍼즐 상태(zustand).
//
// 방탈출 구조: 감방(1~4호실)마다 "미션 자물쇠(lockbox)" 하나와 그 답을 알려주는
// "힌트(note)"들을 방 안에 배치한다. 힌트를 조합해 자물쇠를 풀면(solved) 그 방의
// 감방문(cell-X)이 열린다. 방마다 자물쇠 종류(탈출 방법)가 다르다.
//   1호실 A: 숫자 다이얼 / 2호실 B: 색 순서 / 3호실 C: 문자 / 4호실 D: 레버 패턴
//
// 문 열림은 solved에서 파생한다(openDoorsFromSolved). solvedIds는 서버가 매 tick
// 브로드캐스트하므로 협동 플레이에서 문이 모두에게 함께 열린다 — 별도 문 동기화 불필요.
import { create } from "zustand";

/** 색 순서 퍼즐에 쓰는 색 키. */
export type ColorKey = "red" | "yellow" | "green" | "blue";

/** 자물쇠 종류(방마다 다른 탈출 방법). */
export type Puzzle =
  | { kind: "dial"; code: string } // 숫자 다이얼(자리수 = code 길이)
  | { kind: "sequence"; palette: ColorKey[]; answer: ColorKey[] } // 색 버튼을 순서대로
  | { kind: "letters"; answer: string } // A~Z 문자 휠로 단어 맞추기(대문자)
  | { kind: "switches"; answer: boolean[] }; // 레버 on(위)/off(아래) 패턴

export type InteractableType = "lockbox" | "note";

export interface Interactable {
  id: string;
  type: InteractableType;
  position: [number, number, number];
  label: string;
  /** 표시 문구. note면 힌트 본문, lockbox면 짧은 안내. */
  hint?: string;
  /** lockbox 전용: 자물쇠 퍼즐. */
  puzzle?: Puzzle;
  /** lockbox 전용: 풀면 열리는 감방문 id(예: "cell-A"). */
  opensDoor?: string;
}

/** 상호작용 사거리(m, XZ 평면 기준) */
export const INTERACT_RANGE = 2.2;

// ── 방별 상호작용 오브젝트 ────────────────────────────────────────
// 좌표는 각 감방 내부(prisonLayout CELLS 기준). 자물쇠는 문 근처, 힌트는 안쪽 벽에.
export const INTERACTABLES: Interactable[] = [
  // ── 1호실(A): 숫자 다이얼 "725" ──
  {
    id: "note-A1",
    type: "note",
    position: [-11, 0.6, 9.5],
    label: "벽 낙서",
    hint: "탈출 번호의 앞 두 자리 = 72",
  },
  {
    id: "note-A2",
    type: "note",
    position: [-4, 0.6, 9.0],
    label: "변기 뒤 낙서",
    hint: "마지막 자리 = 5",
  },
  {
    id: "lock-A",
    type: "lockbox",
    position: [-7, 0.6, 3.6],
    label: "숫자 자물쇠",
    hint: "세 자리 숫자를 맞춰라. 낙서를 조합하면 나온다.",
    puzzle: { kind: "dial", code: "725" },
    opensDoor: "cell-A",
  },

  // ── 2호실(B): 색 순서 [초록·빨강·파랑·노랑] ──
  {
    id: "note-B1",
    type: "note",
    position: [11, 0.6, 9.5],
    label: "낡은 쪽지",
    hint: "네 개의 색 버튼을 그림 순서대로 눌러라.",
  },
  {
    id: "note-B2",
    type: "note",
    position: [4, 0.6, 9.0],
    label: "벽 그림",
    hint: "잔디 → 피 → 하늘 → 태양",
  },
  {
    id: "lock-B",
    type: "lockbox",
    position: [7, 0.6, 3.6],
    label: "색 순서 자물쇠",
    hint: "그림이 가리키는 색을 순서대로 누른다.",
    puzzle: {
      kind: "sequence",
      palette: ["red", "yellow", "green", "blue"],
      answer: ["green", "red", "blue", "yellow"],
    },
    opensDoor: "cell-B",
  },

  // ── 3호실(C): 문자 자물쇠 "FREE" ──
  {
    id: "note-C1",
    type: "note",
    position: [-11, 0.6, -9.5],
    label: "긁힌 쪽지",
    hint: "네 글자 영어 단어를 새겨라.",
  },
  {
    id: "note-C2",
    type: "note",
    position: [-4, 0.6, -9.0],
    label: "벽 낙서",
    hint: "‘자유’를 영어로 (F _ _ _)",
  },
  {
    id: "lock-C",
    type: "lockbox",
    position: [-7, 0.6, -3.6],
    label: "문자 자물쇠",
    hint: "네 글자를 맞춰라.",
    puzzle: { kind: "letters", answer: "FREE" },
    opensDoor: "cell-C",
  },

  // ── 4호실(D): 레버 패턴 1001 ──
  {
    id: "note-D1",
    type: "note",
    position: [11, 0.6, -9.5],
    label: "쪽지",
    hint: "레버 4개 — 위=1, 아래=0",
  },
  {
    id: "note-D2",
    type: "note",
    position: [4, 0.6, -9.0],
    label: "벽 낙서",
    hint: "암호: 1 0 0 1",
  },
  {
    id: "lock-D",
    type: "lockbox",
    position: [7, 0.6, -3.6],
    label: "레버 패널",
    hint: "레버를 암호에 맞춰 올리고 내려라.",
    puzzle: { kind: "switches", answer: [true, false, false, true] },
    opensDoor: "cell-D",
  },

  // ── 최종 탈옥문: 감방을 나온 뒤의 목표 ──────────────────────────
  //
  // 단서는 감방 "밖"(식당·통로·운동장)에만 둔다. 감방 안에 두면 그 방 자물쇠를 푼 사람만
  // 볼 수 있는데, 혼자 플레이하면 열리는 감방이 둘뿐이라 나머지 단서에 영영 못 닿는다.
  // 밖에 두면 인원수와 무관하게 성립한다.
  //
  // 세 단서를 모으면 1863.
  {
    id: "note-mess",
    type: "note",
    position: [-35, 0.6, 7], // 식당
    label: "배식 당번표",
    hint: "지워진 칸의 위아래가 17과 19다. 앞 두 자리는 그 사이 수.",
  },
  {
    id: "note-west",
    type: "note",
    position: [-20, 0.6, 1.5], // 서통로
    label: "순찰 일지",
    hint: "마지막 줄 — “3시 방향 이상 없음.” 끝자리는 이 수.",
  },
  {
    id: "note-yard",
    type: "note",
    position: [38, 0.6, -8], // 운동장
    label: "담벼락 자국",
    hint: "누군가 긁어놓은 자국이 여섯 줄. 셋째 자리는 이 수.",
  },
  {
    id: "escape-gate",
    type: "lockbox",
    position: [42, 0.6, 0], // 운동장 동쪽 담
    label: "탈옥문",
    hint: "네 자리. 교도소 곳곳에 흩어진 기록을 모아야 한다.",
    puzzle: { kind: "dial", code: "1863" },
    // opensDoor 없음 — 감방문이 아니라 게임의 끝이다. LOCKS에도 잡히지 않는다.
  },
];

/** 최종 탈옥문 id. 이게 solved면 게임 클리어. */
export const ESCAPE_GATE_ID = "escape-gate";

export function findInteractable(id: string | null): Interactable | undefined {
  return id ? INTERACTABLES.find((it) => it.id === id) : undefined;
}

// 문을 여는 자물쇠 목록(모듈 로드 시 1회 계산).
const LOCKS = INTERACTABLES.filter(
  (it): it is Interactable & { opensDoor: string } =>
    it.type === "lockbox" && !!it.opensDoor,
);

// 매 프레임 충돌 계산에서 쓰므로 객체를 재사용한다(프레임마다 new 방지).
const _openDoors: Record<string, boolean> = {};
/** solved 상태로부터 열린 감방문 맵을 만든다. 자물쇠가 풀린 방의 문이 열린다. */
export function openDoorsFromSolved(
  solved: Record<string, boolean>,
): Record<string, boolean> {
  for (const l of LOCKS) _openDoors[l.opensDoor] = !!solved[l.id];
  return _openDoors;
}

// 감방문 id → 그 문을 여는 자물쇠 id (문 비주얼이 열림 여부를 판단하는 데 쓴다).
export const DOOR_TO_LOCK: Record<string, string> = Object.fromEntries(
  LOCKS.map((l) => [l.opensDoor, l.id]),
);
/** 감방문이 열려 있는가(= 그 문을 여는 자물쇠가 solved인가). */
export function isCellDoorOpen(
  doorId: string,
  solved: Record<string, boolean>,
): boolean {
  const lockId = DOOR_TO_LOCK[doorId];
  return lockId ? !!solved[lockId] : false;
}

interface InteractionStore {
  nearId: string | null; // 사거리 내 가장 가까운 오브젝트
  openId: string | null; // 현재 열려 있는 퍼즐/힌트
  solved: Record<string, boolean>;

  setNear: (id: string | null) => void;
  open: (id: string) => void;
  close: () => void;
  markSolved: (id: string) => void;
  /** 서버 스냅샷의 solvedIds를 병합(협동). 실제로 늘어날 때만 갱신. */
  syncSolved: (ids: string[]) => void;
}

export const useInteraction = create<InteractionStore>((set, get) => ({
  nearId: null,
  openId: null,
  solved: {},

  setNear: (id) => {
    if (get().nearId !== id) set({ nearId: id }); // 변화 시에만 리렌더
  },
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
  markSolved: (id) =>
    set((s) => ({ solved: { ...s.solved, [id]: true }, openId: null })),

  syncSolved: (ids) => {
    const cur = get().solved;
    const missing = ids.filter((id) => !cur[id]);
    if (missing.length === 0) return; // 변화 없으면 리렌더 안 함
    const next = { ...cur };
    for (const id of missing) next[id] = true;
    set({ solved: next });
  },
}));

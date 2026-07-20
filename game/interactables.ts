// 맵에 배치된 상호작용 오브젝트 정의 + 근접/퍼즐 상태(zustand).
//
// 방탈출 구조: 감방(1~4호실)마다 "미션 자물쇠(lockbox)" 하나를 둔다. 감방 자물쇠는
// 아케이드 미니게임(테트리스·슈터·스네이크·벽돌깨기…)이고, 한 판을 깨면 그 방의
// 감방문(cell-X)이 열린다. 어느 방에 어느 게임이 걸리는지는 방 코드로 정해진다
// (minigameFor 참고) — 같은 방 사람들은 같은 배치를 본다.
//
// 최종 탈옥문만 코드 입력(dial)으로 남겼다. 감방 밖에 흩어진 쪽지 셋을 모아야 풀리는
// 협동 단계라, 여기까지 반사신경 게임으로 만들면 "같이 단서를 맞춘다"는 축이 사라진다.
//
// 문 열림은 solved에서 파생한다(openDoorsFromSolved). solvedIds는 서버가 매 tick
// 브로드캐스트하므로 협동 플레이에서 문이 모두에게 함께 열린다 — 별도 문 동기화 불필요.
import { create } from "zustand";
import { assignMinigames } from "./minigames/registry";
import type { MinigameDef } from "./minigames/types";

/** 색 순서 퍼즐에 쓰는 색 키. */
export type ColorKey = "red" | "yellow" | "green" | "blue";

/** 자물쇠 종류(방마다 다른 탈출 방법). */
export type Puzzle =
  | { kind: "dial"; code: string } // 숫자 다이얼(자리수 = code 길이)
  | { kind: "sequence"; palette: ColorKey[]; answer: ColorKey[] } // 색 버튼을 순서대로
  | { kind: "letters"; answer: string } // A~Z 문자 휠로 단어 맞추기(대문자)
  | { kind: "switches"; answer: boolean[] } // 레버 on(위)/off(아래) 패턴
  | { kind: "minigame" }; // 아케이드 한 판. 어느 게임인지는 방 코드로 배정된다

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
// 좌표는 각 감방 내부(prisonLayout CELLS 기준). 자물쇠는 문 근처, 쪽지는 안쪽 벽에.
//
// 감방 쪽지는 이제 답을 알려주지 않는다 — 게임을 이기는 것 말고는 열 방법이 없으니
// 알려줄 답 자체가 없다. 대신 분위기와 "실패해도 손해 없다"는 안내를 맡는다.
export const INTERACTABLES: Interactable[] = [
  // ── 1호실(A) ──
  {
    id: "note-A1",
    type: "note",
    position: [-11, 0.6, 9.5],
    label: "벽 낙서",
    hint: "밤이면 자물쇠에서 삐-삐- 소리가 난다. 꼭 오락실 같다.",
  },
  {
    id: "note-A2",
    type: "note",
    position: [-4, 0.6, 9.0],
    label: "변기 뒤 낙서",
    hint: "져도 벌은 없다. 될 때까지 붙어라.",
  },
  {
    id: "lock-A",
    type: "lockbox",
    position: [-7, 0.6, 3.6],
    label: "1호실 게임 자물쇠",
    hint: "간수가 압수한 게임기를 자물쇠에 박아 놨다. 한 판 이겨야 열린다.",
    puzzle: { kind: "minigame" },
    opensDoor: "cell-A",
  },

  // ── 2호실(B) ──
  {
    id: "note-B1",
    type: "note",
    position: [11, 0.6, 9.5],
    label: "낡은 쪽지",
    hint: "방마다 걸린 게임이 다르다더군. 뭐가 나올지는 들어가 봐야 안다.",
  },
  {
    id: "note-B2",
    type: "note",
    position: [4, 0.6, 9.0],
    label: "벽 그림",
    hint: "먼저 나간 놈이 남긴 그림 — 손가락 두 개와 화살표뿐이다.",
  },
  {
    id: "lock-B",
    type: "lockbox",
    position: [7, 0.6, 3.6],
    label: "2호실 게임 자물쇠",
    hint: "화면이 깜빡인다. 한 판 이겨야 열린다.",
    puzzle: { kind: "minigame" },
    opensDoor: "cell-B",
  },

  // ── 3호실(C) ──
  {
    id: "note-C1",
    type: "note",
    position: [-11, 0.6, -9.5],
    label: "긁힌 쪽지",
    hint: "Esc로 물러났다가 다시 붙어도 된다. 판은 처음부터 시작한다.",
  },
  {
    id: "note-C2",
    type: "note",
    position: [-4, 0.6, -9.0],
    label: "벽 낙서",
    hint: "여긴 머리가 아니라 손이 여는 문이다.",
  },
  {
    id: "lock-C",
    type: "lockbox",
    position: [-7, 0.6, -3.6],
    label: "3호실 게임 자물쇠",
    hint: "먼지 앉은 화면에 커서가 깜빡인다. 한 판 이겨야 열린다.",
    puzzle: { kind: "minigame" },
    opensDoor: "cell-C",
  },

  // ── 4호실(D) ──
  {
    id: "note-D1",
    type: "note",
    position: [11, 0.6, -9.5],
    label: "쪽지",
    hint: "감방을 나가면 진짜가 시작된다. 탈옥문은 네 자리 숫자다.",
  },
  {
    id: "note-D2",
    type: "note",
    position: [4, 0.6, -9.0],
    label: "벽 낙서",
    hint: "숫자는 식당·통로·운동장에 나뉘어 있다. 혼자선 다 못 본다.",
  },
  {
    id: "lock-D",
    type: "lockbox",
    position: [7, 0.6, -3.6],
    label: "4호실 게임 자물쇠",
    hint: "조이스틱은 부러졌고 버튼만 남았다. 한 판 이겨야 열린다.",
    puzzle: { kind: "minigame" },
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

/** 미니게임이 걸린 자물쇠 id들(배치 순서 = 1~4호실 순서). */
export const MINIGAME_LOCK_IDS: string[] = INTERACTABLES.filter(
  (it) => it.puzzle?.kind === "minigame",
).map((it) => it.id);

/**
 * 이 자물쇠에 걸린 미니게임. seed(방 코드)가 같으면 항상 같은 배치가 나온다 —
 * 같은 방 사람끼리 "3호실은 뱀이더라" 같은 말이 통해야 하기 때문이다.
 */
export function minigameFor(objectId: string, seed: string): MinigameDef | undefined {
  return assignMinigames(seed || "solo", MINIGAME_LOCK_IDS)[objectId];
}

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

// 맵에 배치된 상호작용 오브젝트 정의 + 근접/퍼즐 상태(zustand).
//
// 방탈출 구조: 감방(A~D)마다 "미션 자물쇠(lockbox)" 하나를 둔다. 감방 자물쇠는
// 아케이드 미니게임(테트리스·슈터·스네이크·벽돌깨기…)이고, 한 판을 깨면 그 방의
// 감방문(cell-X)이 열린다. 어느 방에 어느 게임이 걸리는지는 방 코드로 정해진다
// (minigameFor 참고) — 같은 방 사람들은 같은 배치를 본다.
//
// 지원 방(작업장·의무실·세탁실)은 방 "밖" 복도의 고전 자물쇠(문자·숫자·색 순서)로 연다 —
// 시나리오 필수 관문이 아닌 보너스 콘텐츠다.
//
// 최종 탈옥문은 코드 입력(dial)이고, 코드·단서는 방 시드로 매판 랜덤 생성된다(escapePlan.ts).
// 감방마다 지급되는 "표식 + 수"와 해독 조각 문서 3곳(식당·수감동 복도·연병장)을 모아야
// 풀리는 협동 단계다 — 각자는 자기 자리 숫자만 계산할 수 있어 채팅 공유가 강제된다.
//
// 문 열림은 solved에서 파생한다(openDoorsFromSolved). solvedIds는 서버가 매 tick
// 브로드캐스트하므로 협동 플레이에서 문이 모두에게 함께 열린다 — 별도 문 동기화 불필요.
import { create } from "zustand";
import { useGameStore } from "@/store/gameStore";
import { docText, escapePlan } from "./escapePlan";
import { assignMinigames } from "./minigames/registry";
import type { MinigameDef } from "./minigames/types";
import { CELLS, cellIdAt } from "./prisonLayout";

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

// 감방 자물쇠 넷이 공유하는 안내문. 네 방이 같은 처지이므로 방마다 다르게 쓸 이유가 없고,
// 감방 안 쪽지를 전부 없앤 뒤로는 "나가서 뭘 해야 하는지"를 알려줄 곳이 여기뿐이다.
const CELL_LOCK_HINT =
  "간수가 압수한 게임기를 자물쇠에 박아 놨다. 한 판 이겨야 열린다. " +
  "문이 열리면 이 방의 표식과 수가 지급된다(화면 왼쪽) — 탈옥문 네 자리 중 네 몫이다. " +
  "셈법은 감방 밖 낙서 세 곳에 나뉘어 있고, 남의 자리는 남에게 물어야 한다.";

// ── 방별 상호작용 오브젝트 ────────────────────────────────────────
// 좌표는 prisonLayout BUILDINGS(도면 배치) 기준. 수감동 감방(A~D) 안에는 자물쇠(미니게임) 하나뿐.
// 안에서 시작 → 한 판 이겨 가운데 복도로 나간다. 감방 쪽지는 없앴다(게임엔 답이 없어 읽을 게 없다).
// 별관 지원 방(작업장·의무실·세탁실)은 방 "밖" 복도의 고전 자물쇠로, 최종 탈옥문은 코드로 연다.
export const INTERACTABLES: Interactable[] = [
  {
    id: "lock-A",
    type: "lockbox",
    position: [-30, 0.6, 21],
    label: "1-1 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-A",
  },
  {
    id: "lock-B",
    type: "lockbox",
    position: [-14, 0.6, 21],
    label: "1-2 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-B",
  },
  {
    id: "lock-C",
    type: "lockbox",
    position: [-30, 0.6, 13],
    label: "1-3 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-C",
  },
  {
    id: "lock-D",
    type: "lockbox",
    position: [-14, 0.6, 13],
    label: "1-4 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-D",
  },

  // ── 세탁실(자물쇠 밖, 별관 복도 — 문 x30/z20 앞): 색 순서 [파랑·노랑·빨강·초록] ──
  { id: "note-laundry1", type: "note", position: [25.5, 0.6, 18.4], label: "세탁 안내문", hint: "세제통을 그림 순서대로 눌러라." },
  { id: "note-laundry2", type: "note", position: [34.5, 0.6, 18.4], label: "젖은 쪽지", hint: "하늘 → 태양 → 피 → 잔디" },
  {
    id: "lock-laundry",
    type: "lockbox",
    position: [30, 0.6, 18.4],
    label: "세탁실 문 자물쇠",
    hint: "쪽지가 가리키는 색을 순서대로 누른다.",
    puzzle: {
      kind: "sequence",
      palette: ["red", "yellow", "green", "blue"],
      answer: ["blue", "yellow", "red", "green"],
    },
    opensDoor: "door-laundry",
  },

  // ── 작업장(자물쇠 밖, 별관 복도 — 문 x14/z14 앞): 문자 "TOOL" ──
  { id: "note-work1", type: "note", position: [9.5, 0.6, 15.6], label: "작업 지시서", hint: "네 글자 영어 단어를 새겨라." },
  { id: "note-work2", type: "note", position: [18.5, 0.6, 15.6], label: "공구함 각인", hint: "‘연장’을 뜻하는 영어 (T _ _ L)" },
  {
    id: "lock-work",
    type: "lockbox",
    position: [14, 0.6, 15.6],
    label: "작업장 문 자물쇠",
    hint: "네 글자를 맞춰라.",
    puzzle: { kind: "letters", answer: "TOOL" },
    opensDoor: "door-work",
  },

  // ── 의무실(자물쇠 밖, 별관 복도 — 문 x30/z14 앞): 숫자 "451" ──
  { id: "note-med1", type: "note", position: [25.5, 0.6, 15.6], label: "약장 라벨", hint: "약장 번호 앞 두 자리 = 45" },
  { id: "note-med2", type: "note", position: [34.5, 0.6, 15.6], label: "처방 기록", hint: "마지막 자리 = 1" },
  {
    id: "lock-med",
    type: "lockbox",
    position: [30, 0.6, 15.6],
    label: "의무실 문 자물쇠",
    hint: "세 자리 숫자를 맞춰라.",
    puzzle: { kind: "dial", code: "451" },
    opensDoor: "door-med",
  },

  // ── 해독 조각 문서 3곳(식당·수감동 복도·연병장): 탈옥 코드의 셈법을 나눠 갖는다 ────
  //
  // 본문은 방 시드로 생성되고 doc-yard는 빈 감방 폴백(압수 기록)까지 실어야 해서,
  // 여기엔 자리·라벨만 두고 hint는 findInteractable이 읽는 순간 escapePlan에서 채워 넣는다.
  // ⚠️ 좌표·id는 서버 Interactables.java(봇 POI)와 일치시킬 것.
  // (한때 고정 코드(1863) 단서를 잠긴 별관 방 안에 두는 안(4e5b12f)도 있었으나, 시드 랜덤
  //  + 정보 쪼개기 재설계가 그 흐름을 대체한다 — 별관은 보너스 콘텐츠로 남는다.)
  { id: "doc-cafe", type: "note", position: [14, 0.6, 24], label: "배식표 뒷면 낙서" },
  { id: "doc-hall", type: "note", position: [-26, 0.6, 15], label: "복도 벽의 긁힌 흔적" },
  { id: "doc-yard", type: "note", position: [-34, 0.6, -27.5], label: "담벼락 밑 모래 글씨" },
  {
    id: "escape-gate",
    type: "lockbox",
    position: [0, 0.6, -26], // 파란 정문 앞(최종 탈출구)
    label: "탈옥문",
    hint: "네 자리. 각자의 표식과 낙서 세 곳의 셈법을 모아야 한다.",
    // code는 자릿수 표시용 자리표시자 — 실제 코드는 findInteractable이 방 시드로 채워 넣는다.
    puzzle: { kind: "dial", code: "0000" },
    // 풀면 남벽의 파란 정문(gate-main)이 열린다 — 게임의 끝을 눈으로 보여주는 연출.
    // 서버 Room.LOCK_OPENS에도 같은 매핑이 있다(봇이 근접만으로 정문을 열지 못하게 막는 효과도 겸한다).
    opensDoor: "gate-main",
  },
];

/** 최종 탈옥문 id. 이게 solved면 게임 클리어. */
export const ESCAPE_GATE_ID = "escape-gate";

/** 해독 조각 문서 id들(본문이 방 시드로 생성되는 것들). */
const DOC_IDS = new Set(["doc-cafe", "doc-hall", "doc-yard"]);

/**
 * 지금 "주인 없는" 감방 id들. 게임 시작 시 감방 안에서 목격된 사람(cellOwners)이 없거나,
 * 그 사람이 방을 나가 로스터에서 사라졌으면 빈 방이다 — 그 방의 표식·수는 doc-yard가
 * 압수 기록으로 대신 공개한다(인원이 적어도, 누가 이탈해도 판이 막히지 않게).
 */
function emptyCells(): string[] {
  const gs = useGameStore.getState();
  const present = new Set(gs.playerIds);
  return CELLS.filter((c) => {
    const owner = gs.cellOwners[c.id];
    return !owner || !present.has(owner);
  }).map((c) => c.id);
}

export function findInteractable(id: string | null): Interactable | undefined {
  const base = id ? INTERACTABLES.find((it) => it.id === id) : undefined;
  if (!base) return undefined;
  // 시드 의존 내용(탈옥 코드·문서 본문)은 읽는 순간 주입한다 — 방 코드는 입장 후 확정되고,
  // doc-yard의 압수 기록(빈 감방 폴백)은 인원 이탈에 따라 그때그때 달라진다.
  const seed = useGameStore.getState().roomId;
  if (base.id === ESCAPE_GATE_ID) {
    return { ...base, puzzle: { kind: "dial", code: escapePlan(seed).code } };
  }
  if (DOC_IDS.has(base.id)) {
    return { ...base, hint: docText(escapePlan(seed), base.id, emptyCells()) };
  }
  return base;
}

// 문을 여는 자물쇠 목록(모듈 로드 시 1회 계산).
const LOCKS = INTERACTABLES.filter(
  (it): it is Interactable & { opensDoor: string } =>
    it.type === "lockbox" && !!it.opensDoor,
);

// 감방 자물쇠 id → 그 자물쇠가 있는 감방 id("cell-A" → "A"). 감방 자물쇠에만 둔다 —
// 별관 문 자물쇠(door-*)는 방 밖에서 여는 것이라 이 제한 대상이 아니다.
const LOCK_CELL: Record<string, string> = Object.fromEntries(
  LOCKS.filter((l) => l.opensDoor.startsWith("cell-")).map((l) => [
    l.id,
    l.opensDoor.slice("cell-".length),
  ]),
);

/**
 * 지금 위치에서 이 오브젝트를 만질 수 있는가.
 *
 * 감방 자물쇠는 **그 감방 안에 있을 때만** 만질 수 있다. 사거리(2.2m)만 보면 문 밖에서
 * 창살 너머로 손이 닿아 남의 방을 밖에서 열어 주게 된다 — 각자 자기 방을 푼다는 전제가 깨진다.
 * 별관 문 자물쇠·탈옥문은 감방이 아니므로 제한이 없다(LOCK_CELL에 없어 undefined).
 */
export function canInteract(it: Interactable, x: number, z: number): boolean {
  const cell = LOCK_CELL[it.id];
  return cell === undefined || cell === cellIdAt(x, z);
}

/** 미니게임이 걸린 자물쇠 id들(배치 순서 = 감방 A~D 순서). */
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

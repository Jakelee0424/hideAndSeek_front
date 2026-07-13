// 맵에 배치된 상호작용 오브젝트 정의 + 근접/퍼즐 상태(zustand).
import { create } from "zustand";

export type InteractableType = "lockbox" | "door" | "note";

export interface Interactable {
  id: string;
  type: InteractableType;
  position: [number, number, number];
  label: string;
  /** lockbox/door: 코드 자물쇠. note: 힌트만 표시(코드 없음). */
  puzzle?: { code: string; hint: string };
}

/** 상호작용 사거리(m, XZ 평면 기준) */
export const INTERACT_RANGE = 2.2;

export const INTERACTABLES: Interactable[] = [
  {
    id: "lockbox-1",
    type: "lockbox",
    position: [5, 0.5, -4],
    label: "자물쇠 상자",
    puzzle: { code: "426", hint: "벽 낙서: 4 · 2 · 6" },
  },
  {
    id: "door-1",
    type: "door",
    position: [-8, 1, 0],
    label: "잠긴 문",
    puzzle: { code: "137", hint: "그림 뒤에 적힌 숫자" },
  },
  {
    id: "note-1",
    type: "note",
    position: [0, 0.5, 6],
    label: "낡은 쪽지",
    puzzle: { code: "", hint: "\"문의 열쇠는 하나, 셋, 일곱\"" },
  },
];

export function findInteractable(id: string | null): Interactable | undefined {
  return id ? INTERACTABLES.find((it) => it.id === id) : undefined;
}

interface InteractionStore {
  nearId: string | null; // 사거리 내 가장 가까운 오브젝트
  openId: string | null; // 현재 열려 있는 퍼즐
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

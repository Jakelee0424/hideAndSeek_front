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
    position: [-10, 0.5, 8], // 1호실
    label: "자물쇠 상자",
    puzzle: { code: "426", hint: "벽 낙서: 4 · 2 · 6" },
  },
  {
    id: "door-1",
    type: "door",
    position: [11.8, 1, -8], // 4호실 뒤벽 쪽(탈옥용 문)
    label: "잠긴 문",
    puzzle: { code: "137", hint: "그림 뒤에 적힌 숫자" },
  },
  {
    id: "note-1",
    type: "note",
    position: [10, 0.5, 8], // 2호실
    label: "낡은 쪽지",
    puzzle: { code: "", hint: "\"문의 열쇠는 하나, 셋, 일곱\"" },
  },
];

export function findInteractable(id: string | null): Interactable | undefined {
  return id ? INTERACTABLES.find((it) => it.id === id) : undefined;
}

interface InteractionStore {
  nearId: string | null; // 사거리 내 가장 가까운 오브젝트
  nearDoorId: string | null; // 사거리 내 가장 가까운 감방문(F로 열기/닫기)
  openId: string | null; // 현재 열려 있는 퍼즐
  solved: Record<string, boolean>;
  doorsOpen: Record<string, boolean>; // 감방문 열림 상태(F로 토글, 서버 동기화)
  // 로컬 토글이 서버 확정 전까지 우선하는 기대 상태(깜빡임 방지). 컴포넌트는 읽지 않음.
  pendingDoors: Record<string, { open: boolean; until: number }>;

  setNear: (id: string | null) => void;
  setNearDoor: (id: string | null) => void;
  open: (id: string) => void;
  close: () => void;
  markSolved: (id: string) => void;
  /** 서버 스냅샷의 solvedIds를 병합(협동). 실제로 늘어날 때만 갱신. */
  syncSolved: (ids: string[]) => void;
  /** 감방문 열림 토글(로컬 낙관적 반영). 실제 열림 상태 반환. */
  toggleDoor: (id: string) => boolean;
  /** 서버 스냅샷의 openDoors로 열림 상태를 일치시킨다(토글은 제거가 있어 전체 대체). */
  syncDoors: (ids: string[]) => void;
}

export const useInteraction = create<InteractionStore>((set, get) => ({
  nearId: null,
  nearDoorId: null,
  openId: null,
  solved: {},
  doorsOpen: {},
  pendingDoors: {},

  setNear: (id) => {
    if (get().nearId !== id) set({ nearId: id }); // 변화 시에만 리렌더
  },
  setNearDoor: (id) => {
    if (get().nearDoorId !== id) set({ nearDoorId: id });
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

  toggleDoor: (id) => {
    const nextOpen = !get().doorsOpen[id];
    set((s) => ({
      doorsOpen: { ...s.doorsOpen, [id]: nextOpen },
      // 서버가 확정할 때까지(최대 2초) 로컬 기대값을 우선한다.
      pendingDoors: {
        ...s.pendingDoors,
        [id]: { open: nextOpen, until: performance.now() + 2000 },
      },
    }));
    return nextOpen;
  },

  syncDoors: (ids) => {
    const serverOpen = new Set(ids);
    const now = performance.now();
    const pending = get().pendingDoors;
    // 서버가 기대와 일치하거나 만료된 pending은 해제.
    const nextPending: Record<string, { open: boolean; until: number }> = {};
    for (const [id, p] of Object.entries(pending)) {
      if (serverOpen.has(id) === p.open || now > p.until) continue;
      nextPending[id] = p;
    }
    // 최종 열림 = 서버 상태, 단 미확정 pending은 로컬 기대값으로 덮어씀.
    const next: Record<string, boolean> = {};
    for (const id of ids) next[id] = true;
    for (const [id, p] of Object.entries(nextPending)) next[id] = p.open;

    const cur = get().doorsOpen;
    const curKeys = Object.keys(cur).filter((k) => cur[k]).sort();
    const nextKeys = Object.keys(next).filter((k) => next[k]).sort();
    const sameOpen =
      curKeys.length === nextKeys.length &&
      curKeys.every((k, i) => k === nextKeys[i]);
    const pendingSame =
      Object.keys(nextPending).length === Object.keys(pending).length;
    if (sameOpen && pendingSame) return; // 변화 없으면 리렌더 안 함
    set({ doorsOpen: next, pendingDoors: nextPending });
  },
}));

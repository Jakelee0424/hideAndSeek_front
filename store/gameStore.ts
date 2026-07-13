// 전역 세션/룸 상태(zustand). 3D 트랜스폼은 여기에 두지 않는다(worldState 참고).
// playerIds는 입/퇴장 시에만 바뀌므로, 이 값으로 원격 플레이어 리스트만 리렌더된다.
import { create } from "zustand";
import type { ConnStatus } from "@/net/types";

interface GameStore {
  status: ConnStatus;
  roomId: string;
  myId: string | null;
  myNick: string;
  ready: boolean;
  playerIds: string[];
  nicks: Record<string, string>;

  setStatus: (s: ConnStatus) => void;
  setReady: (v: boolean) => void;
  /** 방 입장 시 초기화 + 본인을 목록에 시드(서버 스냅샷 오기 전까지 표시). */
  reset: (roomId: string, myId: string, nick: string) => void;
  clear: () => void;
  /** 스냅샷의 플레이어 목록을 반영. 목록이 실제로 바뀔 때만 상태 갱신. */
  syncPlayers: (ids: string[], nicks: Record<string, string>) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: "idle",
  roomId: "lobby",
  myId: null,
  myNick: "",
  ready: false,
  playerIds: [],
  nicks: {},

  setStatus: (status) => set({ status }),
  setReady: (ready) => set({ ready }),

  reset: (roomId, myId, nick) =>
    set({
      roomId,
      myId,
      myNick: nick,
      ready: false,
      status: "connecting",
      playerIds: [myId],
      nicks: { [myId]: nick },
    }),

  clear: () =>
    set({ status: "idle", playerIds: [], nicks: {}, ready: false }),

  syncPlayers: (ids, nicks) => {
    const prev = get().playerIds;
    const same =
      prev.length === ids.length && prev.every((id, i) => id === ids[i]);
    if (same) return; // 리렌더 방지
    set({ playerIds: ids, nicks });
  },
}));

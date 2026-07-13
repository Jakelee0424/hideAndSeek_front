// stompClient + gameStore + worldState 를 묶는 세션 오케스트레이션.
// UI는 joinRoom / leaveRoom 만 호출한다.
import { useGameStore } from "@/store/gameStore";
import { worldState } from "./worldState";
import * as stomp from "./stompClient";

export function joinRoom(roomId: string, nick: string): string {
  const myId = crypto.randomUUID();
  useGameStore.getState().reset(roomId, myId, nick);

  stomp.connect(
    roomId,
    { id: myId, nick },
    {
      onStatus: (s) => useGameStore.getState().setStatus(s),
      onSnapshot: (snap) => {
        worldState.apply(snap);
        const ids = snap.players.map((p) => p.id);
        const nicks: Record<string, string> = {};
        for (const p of snap.players) nicks[p.id] = p.nick;
        useGameStore.getState().syncPlayers(ids, nicks);
      },
    },
  );

  return myId;
}

export function leaveRoom(): void {
  stomp.disconnect();
  worldState.clear();
  useGameStore.getState().clear();
}

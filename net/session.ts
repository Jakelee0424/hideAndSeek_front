// stompClient + gameStore + worldState 를 묶는 세션 오케스트레이션.
// UI는 joinRoom / leaveRoom 만 호출한다.
import { useGameStore } from "@/store/gameStore";
import { useInteraction } from "@/game/interactables";
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
        // 로스터(닉네임)는 변경 시에만 실려 온다 → 있을 때만 병합.
        if (snap.roster) useGameStore.getState().applyRoster(snap.roster);
        // 플레이어 목록은 매 tick 상태에서 파생(입·퇴장 즉시 반영).
        useGameStore.getState().syncPlayers(snap.states.map((s) => s.id));
        // 퍼즐 해결 상태 협동 동기화
        if (snap.solvedIds) useInteraction.getState().syncSolved(snap.solvedIds);
        // 진행 단계도 전환 시·입장 시에만 실려 온다 → 있을 때만 반영. 이후 카운트다운은 클라 몫.
        if (snap.phase) {
          useGameStore.getState().setPhase(snap.phase, snap.phaseRemainMs ?? 0);
        }
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

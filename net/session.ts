// stompClient + gameStore + worldState 를 묶는 세션 오케스트레이션.
// UI는 joinRoom / leaveRoom 만 호출한다.
import { useGameStore } from "@/store/gameStore";
import { useInteraction } from "@/game/interactables";
import { worldState } from "./worldState";
import * as stomp from "./stompClient";

/**
 * 방 입장. playerId/token은 대기열을 거쳐 왔을 때 넘긴다 —
 * 대기열은 playerId로 슬롯을 잡으므로 여기서 새 id를 만들면 슬롯과 어긋나 입장이 거부된다.
 */
export function joinRoom(
  roomId: string,
  nick: string,
  opts?: { playerId?: string; token?: string | null },
): string {
  const myId = opts?.playerId ?? crypto.randomUUID();
  useGameStore.getState().reset(roomId, myId, nick);

  stomp.connect(
    roomId,
    { id: myId, nick, token: opts?.token ?? null },
    {
      onStatus: (s) => useGameStore.getState().setStatus(s),
      onSnapshot: (snap) => {
        worldState.apply(snap);
        // 로스터(닉네임)는 변경 시에만 실려 온다 → 있을 때만 병합.
        if (snap.roster) useGameStore.getState().applyRoster(snap.roster);
        // 플레이어 목록은 매 tick 상태에서 파생(입·퇴장 즉시 반영).
        useGameStore.getState().syncPlayers(snap.states.map((s) => s.id));
        // 퍼즐 해결 상태 협동 동기화(감방문 열림은 solved에서 파생 → 함께 동기화됨)
        if (snap.solvedIds) useInteraction.getState().syncSolved(snap.solvedIds);
        // 진행 단계도 전환 시·입장 시에만 실려 온다 → 있을 때만 반영. 이후 카운트다운은 클라 몫.
        if (snap.phase) {
          useGameStore.getState().setPhase(snap.phase, snap.phaseRemainMs ?? 0);
        }
        // AI 지목 현황도 바뀔 때만 실려 온다.
        if (snap.votes) useGameStore.getState().applyVotes(snap.votes);
        // 진짜 AI는 결말에만 공개된다(그 전엔 아예 안 실린다).
        if (snap.aiId) useGameStore.getState().setAiId(snap.aiId);
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

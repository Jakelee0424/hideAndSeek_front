// stompClient + gameStore + worldState 를 묶는 세션 오케스트레이션.
// UI는 joinRoom / leaveRoom 만 호출한다.
import { useGameStore } from "@/store/gameStore";
import { useInteraction } from "@/game/interactables";
import { worldState } from "./worldState";
import * as stomp from "./stompClient";

/**
 * join 후 이 시간 안에 내가 스냅샷에 안 보이면 입장 실패로 본다.
 * 서버는 20Hz로 뿌리므로 정상 입장이면 수십 ms 안에 들어온다 — 넉넉히 잡아도 오탐이 없다.
 */
const JOIN_TIMEOUT_MS = 5000;

// 입장 확인 타이머. 모듈 스코프에 둔다 — joinRoom 안에 가둬 두면 확인 전에 나갔을 때
// 타이머가 살아남아 이미 떠난 세션에 오류 상태를 씌운다.
let joinTimer: ReturnType<typeof setTimeout> | null = null;

function clearJoinTimer(): void {
  if (joinTimer) {
    clearTimeout(joinTimer);
    joinTimer = null;
  }
}

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

  // 서버가 입장을 거절하면(방 정원 초과·대기열 초과) 아무 응답도 오지 않는다. 스냅샷에
  // 내가 안 실려 오는 것으로만 알 수 있으므로, 일정 시간 안에 못 보면 실패로 처리한다.
  // 이게 없으면 거절당한 사람은 연결된 화면에서 영원히 기다린다.
  let joined = false;
  clearJoinTimer();
  joinTimer = setTimeout(() => {
    joinTimer = null;
    if (!joined) {
      // 연결은 됐는데 내가 스냅샷에 없다 = 서버가 거절했다(정원 초과). 서버 장애와 구분한다.
      useGameStore.getState().setStatus("rejected");
      stomp.disconnect();
    }
  }, JOIN_TIMEOUT_MS);

  stomp.connect(
    roomId,
    { id: myId, nick, token: opts?.token ?? null },
    {
      onStatus: (s) => useGameStore.getState().setStatus(s),
      onSnapshot: (snap) => {
        // 내가 스냅샷에 실려 왔다 = 서버가 받아줬다.
        if (!joined && snap.states.some((s) => s.id === myId)) {
          joined = true;
          clearJoinTimer();
        }
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
        // 대기방 준비 상태도 바뀔 때만 실려 온다.
        if (snap.readyIds) useGameStore.getState().applyReady(snap.readyIds);
      },
    },
  );

  return myId;
}

export function leaveRoom(): void {
  clearJoinTimer();
  stomp.disconnect();
  worldState.clear();
  useGameStore.getState().clear();
}

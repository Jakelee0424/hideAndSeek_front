// 재수감 이벤트 버스(싱글턴). 정문 함정이 발동하면 서버가 스냅샷에 ReimprisonEvent를 실어 보내고,
// 렌더/연출 컴포넌트가 여기서 폴링해 쓴다. punches 버스와 같은 이유로 React state가 아니다
// (스냅샷 수신마다 리렌더가 나지 않게).
//
//   - pendingTeleport: victim이 "나"인 경우의 목적지(감방). LocalPlayer가 매 프레임 가져가
//     자기 예측 위치를 그 자리로 하드 스냅한다(넉백과 달리 큰 이동이라 결정론적 복제로는 못 맞춘다).
//   - lastTrapAt / lastVictimAt: 연출용 타임스탬프. TrapOverlay가 값이 커지면 배너를 띄운다.
import type { ReimprisonEvent } from "./types";

let pendingTeleport: { x: number; z: number } | null = null;
let lastTrapAt = 0; // 마지막으로 함정이 발동한 시각(누가 걸렸든 — 방 전체 경보 연출)
let lastVictimAt = 0; // 내가 재수감된 마지막 시각(본인 전용 "다시 갇혔다" 연출)

export const reimprison = {
  /**
   * 스냅샷의 reimprisons를 반영. myId로 내가 걸렸는지 판정한다.
   * onRelock은 다시 잠긴 자물쇠 id를 넘겨 준다 — 호출부가 solved에서 지워 감방문을 닫는다.
   */
  ingest(
    events: ReimprisonEvent[],
    myId: string | null,
    onRelock: (lockId: string) => void,
  ): void {
    if (events.length === 0) return;
    const now = performance.now();
    lastTrapAt = now;
    for (const e of events) {
      onRelock(e.relock);
      if (e.victim === myId) {
        pendingTeleport = { x: e.x, z: e.z };
        lastVictimAt = now;
      }
    }
  },

  /** 대기 중인 순간이동 목적지를 가져가고 비운다(LocalPlayer 전용). 없으면 null. */
  takeTeleport(): { x: number; z: number } | null {
    const t = pendingTeleport;
    pendingTeleport = null;
    return t;
  },

  /** 마지막 함정 발동 시각(연출이 갱신 여부만 보면 된다). */
  trapAt(): number {
    return lastTrapAt;
  },

  /** 내가 마지막으로 재수감된 시각. */
  victimAt(): number {
    return lastVictimAt;
  },

  clear(): void {
    pendingTeleport = null;
    lastTrapAt = 0;
    lastVictimAt = 0;
  },
};

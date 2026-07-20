// 펀치 이벤트 버스(싱글턴). 스냅샷에 실려온 PunchEvent를 렌더 컴포넌트가 폴링해 쓴다.
//   - punchAt: attacker id → 마지막 펀치 수신 시각(performance.now). RemotePlayer/LocalPlayer가
//     이 값이 갱신되면 펀치 모션을 한 번 재생한다.
//   - pendingKnockback: victim이 "나"인 넉백의 방향 임펄스 누적. LocalPlayer가 매 프레임 가져가
//     자기 예측 위치에 KNOCKBACK_SPEED를 곱해 적용한다(서버와 결정론적 복제).
// React state가 아니라 여기 두는 이유는 worldState와 같다 — 스냅샷 수신마다 리렌더가 나지 않게.
import type { PunchEvent } from "./types";

const punchAt = new Map<string, number>();
let pendingKnockback: { x: number; z: number } | null = null;

export const punches = {
  /** 스냅샷의 punches를 반영. myId는 내가 맞았는지 판정용. */
  ingest(events: PunchEvent[], myId: string | null): void {
    const now = performance.now();
    for (const e of events) {
      punchAt.set(e.attacker, now);
      if (e.victim && e.victim === myId) {
        pendingKnockback = {
          x: (pendingKnockback?.x ?? 0) + e.dirX,
          z: (pendingKnockback?.z ?? 0) + e.dirZ,
        };
      }
    }
  },

  /** attacker가 마지막으로 편치를 날린 시각(없으면 0). 렌더가 갱신 여부만 보면 된다. */
  lastPunchAt(id: string): number {
    return punchAt.get(id) ?? 0;
  },

  /** 대기 중인 넉백 방향을 가져가고 비운다(단위 벡터 근사; 세기는 호출부가 곱한다). */
  takeKnockback(): { x: number; z: number } | null {
    const k = pendingKnockback;
    pendingKnockback = null;
    return k;
  },

  clear(): void {
    punchAt.clear();
    pendingKnockback = null;
  },
};

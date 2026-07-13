// 서버(game3d-server)와 주고받는 메시지 스키마.
// 백엔드 DTO(record)와 필드명·좌표 규약(y-up, 미터)을 반드시 일치시킬 것.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Role = "seeker" | "hider";

/** 서버가 확정한 단일 플레이어 상태 */
export interface PlayerState {
  id: string;
  nick: string;
  position: Vec3;
  rotationY: number;
  role?: Role;
}

/** 서버 → 클라: 월드 스냅샷 (tick마다 브로드캐스트) */
export interface WorldSnapshot {
  tick: number;
  players: PlayerState[];
  /** 이 방에서 해결된 퍼즐 오브젝트 id(협동 동기화) */
  solvedIds: string[];
}

/** 클라 → 서버: 퍼즐 해결 알림 */
export interface SolveMessage {
  objectId: string;
}

/** 클라 → 서버: 입장 */
export interface JoinMessage {
  id: string;
  nick: string;
}

/** 클라 → 서버: 이동 "의도"(방향 벡터). 서버가 검증·적용한다. */
export interface InputMessage {
  seq: number;
  move: Vec3; // 정규화된 이동 방향 (y는 미사용)
  rotationY: number;
}

export type ConnStatus = "idle" | "connecting" | "connected" | "error";

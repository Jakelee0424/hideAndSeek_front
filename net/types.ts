// 서버(game3d-server)와 주고받는 메시지 스키마.
// 백엔드 DTO(record)와 필드명·좌표 규약(y-up, 미터)을 반드시 일치시킬 것.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Role = "seeker" | "hider";

/** 서버 → 클라: tick마다 바뀌는 경량 위치 상태(20Hz). nick/role은 싣지 않는다. */
export interface PlayerTick {
  id: string;
  x: number;
  z: number;
  rot: number;
  /**
   * 지면 위 높이(m). 착지 상태면 0 — 서버 내부 절대 좌표(캡슐 중심 0.5)가 아니라
   * "발바닥이 y=0"인 프론트 규약에 맞춘 값이라 그대로 position.y에 넣으면 된다.
   * 점프가 남에게도 보이려면 필요하다(점프 도입 전엔 항상 0이라 싣지 않았다).
   */
  y: number;
}

/** 서버 → 클라: 정적 정보(닉네임). 입·퇴장으로 로스터가 바뀔 때만 전송된다. */
export interface RosterEntry {
  id: string;
  nick: string;
  /** AI 봇 여부. 이동·렌더는 사람과 동일하게 다루되, 방장 선출 등 사람 전용 판단에선 제외할 것. */
  bot: boolean;
}

/** 게임 진행 단계. 백엔드 GamePhase enum의 이름과 일치해야 한다(이중 관리). */
export type GamePhase =
  | "LOBBY"
  | "ONBOARDING"
  | "MISSION"
  | "SHARING"
  | "VOTE"
  | "ENDED";

/**
 * 단계 표시 이름.
 *
 * 기계적인 이름("온보딩"·"개별 미션")이었는데, 엔딩이 자정의 종·배수관이라는 설정을 쓰면서
 * 앞단만 개발 용어로 남으면 이야기가 끊긴다. 같은 세계의 말로 바꿨다.
 * (백엔드 GamePhase.label()과 이중 관리지만, 클라는 enum 이름만 받아 여기서 이름을 붙인다.)
 */
export const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: "수감 대기",
  ONBOARDING: "소등",
  MISSION: "감방 탈출",
  SHARING: "단서 공유",
  VOTE: "색출",
  ENDED: "자정",
};

/** 서버 → 클라: 월드 스냅샷 (tick마다 브로드캐스트) */
export interface WorldSnapshot {
  tick: number;
  /** 매 tick 실리는 경량 위치 상태 */
  states: PlayerTick[];
  /** 정적 정보. 로스터 변경 시에만 존재(그 외 생략) */
  roster?: RosterEntry[] | null;
  /** 이 방에서 해결된 퍼즐 오브젝트 id(협동 동기화) */
  solvedIds: string[];
  /** 현재 열려 있는 감방문 id 목록(F 토글, 매 tick 동기화) */
  openDoors: string[];
  /** 진행 단계. 로스터와 같은 규약 — 전환 시·입장 시에만 존재(그 외 생략) */
  phase?: GamePhase | null;
  /** 그 단계의 남은 시간(ms). phase와 함께만 온다. 카운트다운은 클라가 자체 진행. */
  phaseRemainMs?: number | null;
  /** AI 지목 현황. 로스터와 같은 규약 — 바뀔 때만 존재. */
  votes?: VoteEntry[] | null;
  /**
   * 진짜 AI의 id. ENDED 단계에서만 온다.
   * 그 전까지 서버는 roster.bot도 전부 false로 보낸다 — 미리 알면 투표가 무의미해진다.
   */
  aiId?: string | null;
  /** 대기방에서 준비를 마친 사람들. 로스터와 같은 규약 — 바뀔 때만 존재. */
  readyIds?: string[] | null;
  /** 이 tick에 성사된 펀치들. 일어난 순간에만 존재(그 외 생략). */
  punches?: PunchEvent[] | null;
}

/** 서버 → 클라: 누가 누구를 AI로 지목했는지. 집계는 클라가 한다(표가 몇 안 된다). */
export interface VoteEntry {
  voterId: string;
  targetId: string;
}

/**
 * 서버 → 클라: 이 tick에 성사된 펀치 하나. 백엔드 PunchEvent record와 필드명 일치.
 *   attacker: 펀치 모션을 재생할 대상(원격 시청자·본인). 헛방이어도 모션은 온다.
 *   victim:   맞은 사람 id. 없으면(헛방) null·생략.
 *   dirX/dirZ: 넉백 방향(단위 벡터, attacker→victim). victim이 본인이면 이 방향으로
 *             자기 예측 위치에 같은 넉백을 준다(서버와 동일 감쇠 → 결정론적 복제).
 */
export interface PunchEvent {
  attacker: string;
  victim?: string | null;
  dirX: number;
  dirZ: number;
}

/** 클라 → 서버: AI 지목 투표 */
export interface VoteMessage {
  targetId: string;
}

/** 클라 → 서버: 퍼즐 해결 알림 */
export interface SolveMessage {
  objectId: string;
}

/** 클라 → 서버: 입장 */
export interface JoinMessage {
  id: string;
  nick: string;
  /**
   * 대기열(/api/queue)에서 받은 입장 토큰. 대기열이 꺼져 있거나 한산하면 없어도 통과한다.
   * 정원이 찼는데 토큰이 없으면 서버가 join을 무시한다(스냅샷이 오지 않는다).
   */
  token?: string | null;
}

/** 클라 → 서버: 이동 "의도"(방향 벡터). 서버가 검증·적용한다. */
export interface InputMessage {
  seq: number;
  move: Vec3; // 정규화된 이동 방향 (y는 미사용)
  rotationY: number;
  /** 달리기 의도(Shift). 실제 속도 배수는 서버의 game.sprint-multiplier가 정한다. */
  sprint: boolean;
  /** 점프 의도(Space). 접지 판정은 서버가 하므로 공중에서 눌러도 무시된다. */
  jump: boolean;
}

/**
 * rejected는 "서버는 살아 있는데 나를 안 받아줬다"(방 정원 초과 등)를 뜻한다.
 * error(서버에 못 붙음)와 섞으면 정원이 찬 상황이 "서버 오프라인"으로 표시된다.
 */
export type ConnStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "rejected";

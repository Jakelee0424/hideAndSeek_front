// 감방 자물쇠에 들어가는 아케이드 미니게임의 공통 규약.
//
// 게임 로직은 React를 모른다 — 캔버스에 그리고 키 입력을 읽는 순수 객체다.
// 렌더링·입력 수집·성공 판정 UI는 전부 ArcadeHost가 맡는다. 이렇게 갈라 두면
// 게임을 하나 추가할 때 파일 하나만 쓰면 되고, 훅 규칙이나 리렌더를 신경 쓸 일이 없다.

/** 모든 미니게임이 공유하는 캔버스 논리 크기(px). CSS로는 모달 폭에 맞춰 늘어난다. */
export const ARCADE_W = 320;
export const ARCADE_H = 400;

/** 눌려 있는 키들. KeyboardEvent.code 기준("ArrowLeft", "Space", …). */
export type KeySet = ReadonlySet<string>;

export type ArcadeStatus = "playing" | "won" | "lost";

export interface ArcadeGame {
  /**
   * 한 프레임 진행.
   * @param dt     경과 시간(초). 탭 전환 등으로 튀지 않게 호스트가 상한을 건다
   * @param held   현재 눌려 있는 키
   * @param tapped 이번 프레임에 새로 눌린 키(꾹 누른 자동반복은 제외)
   */
  update(dt: number, held: KeySet, tapped: KeySet): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** 진행도 한 줄(예: "2 / 4줄"). 캔버스 위 HUD에 표시된다. */
  progress(): string;
  status(): ArcadeStatus;
}

export interface MinigameDef {
  id: string;
  /** 모달 제목에 쓰는 이름(예: "테트리스"). */
  name: string;
  /** 클리어 조건 한 줄(예: "4줄을 지워라"). */
  goal: string;
  /** 조작 안내 한 줄. */
  controls: string;
  /** 새 판을 시작한다. 재도전할 때마다 새로 만든다. */
  create(): ArcadeGame;
}

// 감옥 맵 레이아웃 — 단일 소스(시각 + 충돌 + 스폰이 모두 참조).
//
//   식당(CAFETERIA)   서통로   감방블록+복도(CELL BLOCK)   동통로   운동장(YARD)
//     x:-44..-26     -26..-14      x:-14..14            14..26    26..44
//
//   감방블록:                         운동장:
//   ┌────────┬────────┐               넓은 개방 구역(콘크리트 담)
//   │ 1호실  │ 2호실  │ z=+11         농구골대·트랙·벤치
//   │   ▯문──┼──문▯   │ z=+2.5
//   ├─── 복도(corridor) ───┤ ↔ 동/서 통로로 이어짐
//   │   ▯문──┼──문▯   │ z=-2.5
//   │ 3호실  │ 4호실  │ z=-11
//   └────────┴────────┘
//
// ⚠️ 서버 Collision.java(WALL_BOXES·BOUND) / Room.java(CELL_CENTERS) 와 반드시 동일하게 유지.
//    한쪽 바꾸면 양쪽 반영. 좌표가 어긋나면 러버밴딩.

export const WALL_H = 3; // 실내 벽 높이(m)
export const YARD_WALL_H = 4.2; // 운동장 담 높이(m)
export const WALL_T = 0.4; // 벽 두께(m)
export const PLAYER_R = 0.4; // 플레이어 반경(원 충돌)

// 감방 문(개구부) 폭 / 복도 절반 폭
export const CORRIDOR_HALF_Z = 2.5;
export const DOOR_W = 2;

// 안전용 바깥 사각 경계(실제 격리는 벽이 담당; 이 clamp는 탈출 방지 그물).
export const BOUND_X = 44.2;
export const BOUND_Z = 14.2;

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}
export interface WallBox {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}

const toBox = (r: Rect): WallBox => ({
  cx: (r.x0 + r.x1) / 2,
  cz: (r.z0 + r.z1) / 2,
  hx: Math.abs(r.x1 - r.x0) / 2,
  hz: Math.abs(r.z1 - r.z0) / 2,
});

// ── 바닥 영역(구역별 색) ──────────────────────────────────────────
export const FLOORS: { rect: Rect; color: string }[] = [
  { rect: { x0: -14, z0: -11, x1: 14, z1: 11 }, color: "#2a2d34" }, // 감방블록
  { rect: { x0: 14, z0: -2.5, x1: 26, z1: 2.5 }, color: "#30343c" }, // 동통로
  { rect: { x0: -26, z0: -2.5, x1: -14, z1: 2.5 }, color: "#30343c" }, // 서통로
  { rect: { x0: 26, z0: -14, x1: 44, z1: 14 }, color: "#3d4732" }, // 운동장(흙바닥)
  { rect: { x0: -44, z0: -12, x1: -26, z1: 12 }, color: "#3a3f4a" }, // 식당
];

// ── 콘크리트 솔리드 벽(시각+충돌). Rect = 벽의 실제 점유 사각형. ──
export const SOLID_WALLS: { rect: Rect; h?: number }[] = [
  // 감방블록 외벽(복도가 동·서 벽을 관통 → z∈[-2.5,2.5] 개구부)
  { rect: { x0: -14.2, z0: 10.8, x1: 14.2, z1: 11.2 } }, // 북
  { rect: { x0: -14.2, z0: -11.2, x1: 14.2, z1: -10.8 } }, // 남
  { rect: { x0: 13.8, z0: 2.5, x1: 14.2, z1: 11.2 } }, // 동-상
  { rect: { x0: 13.8, z0: -11.2, x1: 14.2, z1: -2.5 } }, // 동-하
  { rect: { x0: -14.2, z0: 2.5, x1: -13.8, z1: 11.2 } }, // 서-상
  { rect: { x0: -14.2, z0: -11.2, x1: -13.8, z1: -2.5 } }, // 서-하
  // 감방 사이 세로 벽
  { rect: { x0: -0.2, z0: 2.5, x1: 0.2, z1: 10.8 } },
  { rect: { x0: -0.2, z0: -10.8, x1: 0.2, z1: -2.5 } },
  // 동통로 벽
  { rect: { x0: 14, z0: 2.3, x1: 26.2, z1: 2.7 } },
  { rect: { x0: 14, z0: -2.7, x1: 26.2, z1: -2.3 } },
  // 서통로 벽
  { rect: { x0: -26.2, z0: 2.3, x1: -14, z1: 2.7 } },
  { rect: { x0: -26.2, z0: -2.7, x1: -14, z1: -2.3 } },
  // 운동장 담(관통 개구부: 서벽 z∈[-2.5,2.5])
  { rect: { x0: 26, z0: 13.8, x1: 44.2, z1: 14.2 }, h: YARD_WALL_H }, // 북
  { rect: { x0: 26, z0: -14.2, x1: 44.2, z1: -13.8 }, h: YARD_WALL_H }, // 남
  { rect: { x0: 43.8, z0: -14.2, x1: 44.2, z1: 14.2 }, h: YARD_WALL_H }, // 동
  { rect: { x0: 25.8, z0: 2.5, x1: 26.2, z1: 14.2 }, h: YARD_WALL_H }, // 서-상
  { rect: { x0: 25.8, z0: -14.2, x1: 26.2, z1: -2.5 }, h: YARD_WALL_H }, // 서-하
  // 식당 벽(관통 개구부: 동벽 z∈[-2.5,2.5])
  { rect: { x0: -44.2, z0: 11.8, x1: -26, z1: 12.2 } }, // 북
  { rect: { x0: -44.2, z0: -12.2, x1: -26, z1: -11.8 } }, // 남
  { rect: { x0: -44.2, z0: -12.2, x1: -43.8, z1: 12.2 } }, // 서
  { rect: { x0: -26.2, z0: 2.5, x1: -25.8, z1: 12.2 } }, // 동-상
  { rect: { x0: -26.2, z0: -12.2, x1: -25.8, z1: -2.5 } }, // 동-하
];

// 감방 정면 창살(문 개구부 x=∓7 제외). 시각=창살, 충돌=솔리드.
export const BAR_SEGMENTS: { z: number; x0: number; x1: number }[] = [
  { z: CORRIDOR_HALF_Z, x0: -13.8, x1: -8 },
  { z: CORRIDOR_HALF_Z, x0: -6, x1: 6 },
  { z: CORRIDOR_HALF_Z, x0: 8, x1: 13.8 },
  { z: -CORRIDOR_HALF_Z, x0: -13.8, x1: -8 },
  { z: -CORRIDOR_HALF_Z, x0: -6, x1: 6 },
  { z: -CORRIDOR_HALF_Z, x0: 8, x1: 13.8 },
];

// 충돌 박스 = 솔리드 벽 + 창살 세그먼트(z±0.2 두께).
export const WALL_BOXES: WallBox[] = [
  ...SOLID_WALLS.map((w) => toBox(w.rect)),
  ...BAR_SEGMENTS.map((s) =>
    toBox({ x0: s.x0, z0: s.z - 0.2, x1: s.x1, z1: s.z + 0.2 }),
  ),
];

export interface Cell {
  id: string;
  label: string;
  cx: number;
  cz: number;
  door: [number, number];
  side: 1 | -1; // 복도가 있는 방향(+z 감방 → -1)
}

// 감방 4개. 문은 x=∓7, z=±2.5.
export const CELLS: Cell[] = [
  { id: "A", label: "1호실", cx: -7, cz: 6.5, door: [-7, CORRIDOR_HALF_Z], side: -1 },
  { id: "B", label: "2호실", cx: 7, cz: 6.5, door: [7, CORRIDOR_HALF_Z], side: -1 },
  { id: "C", label: "3호실", cx: -7, cz: -6.5, door: [-7, -CORRIDOR_HALF_Z], side: 1 },
  { id: "D", label: "4호실", cx: 7, cz: -6.5, door: [7, -CORRIDOR_HALF_Z], side: 1 },
];

// 감방문(닫혀 있으면 개구부를 막는 충돌 박스, F로 열면 통과). 열림 상태는 solved[id]로 동기화.
export interface Door {
  id: string;
  pos: [number, number];
  side: 1 | -1;
}
export const DOORS: Door[] = CELLS.map((c) => ({
  id: `cell-${c.id}`,
  pos: c.door,
  side: c.side,
}));

export interface DoorBox extends WallBox {
  id: string;
}
// 개구부(x=∓7, 폭 2)를 정확히 채우는 박스. solved[id]면 충돌에서 제외 → 통과.
export const DOOR_BOXES: DoorBox[] = DOORS.map((d) => ({
  id: d.id,
  cx: d.pos[0],
  cz: d.pos[1],
  hx: DOOR_W / 2,
  hz: 0.2,
}));

// F로 문을 열/닫을 수 있는 거리(m)
export const DOOR_RANGE = 3.0;

// 랜덤 감방 + 감방 내부 랜덤 위치 스폰(서버 Room.join과 같은 규약). 프론트 단독 실행용.
export function randomCellSpawn(): [number, number] {
  const c = CELLS[Math.floor(Math.random() * CELLS.length)];
  const ox = (Math.random() * 2 - 1) * 2.5;
  const oz = (Math.random() * 2 - 1) * 2.5;
  return [c.cx + ox, c.cz + oz];
}

// 구역 중심(라벨·소품 배치용)
export const YARD = { cx: 35, cz: 0, rect: { x0: 26, z0: -14, x1: 44, z1: 14 } };
export const CAFETERIA = {
  cx: -35,
  cz: 0,
  rect: { x0: -44, z0: -12, x1: -26, z1: 12 },
};

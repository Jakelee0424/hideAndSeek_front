// 교도소 맵 레이아웃 — 단일 소스(시각 + 충돌 + 스폰이 모두 참조).
//
// 실제 교도소 도면(조감도)을 따른다: 본관(감방동) — 중앙 통로 — 별관(미션동) — 정문/운동장.
// 벽·문·바닥은 아래 BUILDINGS(방=사각형 + 문 위치) 스펙에서 **자동 생성**한다 — 좌표를 손으로
// 두 번 쓰지 않으므로 프론트/백 어긋남(러버밴딩)을 원천 차단한다.
//
//   [관리실][통제실]        [관구실]              (북)
//   ┌──┐┌──┐┌──┐┌──┐                    ┌────── 별관(미션동) ──────┐
//   │A ││B ││C ││D │  ← 본관 감방(스폰)    │ 식당(개방) · 세탁실(자물쇠) │
//   └┬─┘└┬─┘└┬─┘└┬─┘                    │ 작업장(자물쇠) · 의무실(자물쇠)│
//    문(남향)                            └──────────┬───────────────┘
//        ───────── 운동장(개활지) ─────────────
//              [정문초소]  교도소 정문(탈옥문)   (남)   감시탑
//
// ⚠️ 서버 Collision.java(같은 BUILDINGS 스펙에서 생성) / Room.java(CELL_CENTERS·cellOf·LOCK_OPENS)
//    / BotNav.java(웨이포인트) / Interactables.java(POI) 와 규약을 맞출 것. 방을 옮기면 이 파일과
//    Collision.java의 BUILDINGS를 같은 값으로 고치면 벽·문은 자동으로 맞는다.

export const WALL_H = 3; // 실내 벽 높이(m)
export const YARD_WALL_H = 4.2; // 담(연병장·외벽) 높이(m)
export const WALL_T = 0.4; // 벽 두께(m)
export const PLAYER_R = 0.4; // 플레이어 반경(원 충돌)
export const DOOR_W = 2; // 잠금 문 개구부 폭(m)

// 안전용 바깥 사각 경계(실제 격리는 외벽이 담당; 이 clamp는 탈출 방지 그물). 외벽 안쪽 면.
export const BOUND_X = 74.6;
export const BOUND_Z = 55.6;

// F로 문을 열/닫을 수 있는 거리(m). 서버 Room.BOT_DOOR_RANGE와 같은 값.
export const DOOR_RANGE = 3.0;

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
  h: number; // 렌더 높이(충돌은 무시)
}
export interface DoorBox {
  id: string;
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}

export type Edge = "N" | "S" | "E" | "W";
export interface Opening {
  edge: Edge;
  at: number; // 개구부 중심(N/S면 x, E/W면 z)
  width: number;
  door?: string; // 있으면 잠금 문(풀면 열림), 없으면 상시 통행 개구부
}
export interface Building {
  id: string;
  label?: string; // 있으면 바닥 위에 라벨 표시
  kind: "perimeter" | "yard" | "cell" | "room" | "gate";
  rect: Rect;
  h?: number; // 벽 높이(기본 WALL_H)
  color?: string; // 바닥 색(없으면 바닥 생략)
  openings?: Opening[];
  noWalls?: boolean; // 개활지(운동장 등): 바닥 색만, 벽 생성 안 함
}

// ── 도면 배치 ──────────────────────────────────────────────────────
// 좌표계: z+ = 북(도면 위쪽). 본관 감방은 북서, 별관 미션동은 동, 운동장·정문은 남.
export const BUILDINGS: Building[] = [
  // 외벽(전체를 감싼다). 바닥 없음 — 개활지는 베이스 지면(Map의 Ground)이 깐다.
  { id: "perimeter", kind: "perimeter", rect: { x0: -75, z0: -56, x1: 75, z1: 56 }, h: 5 },

  // ── 본관(감방동, 북서): 감방 4 + 관리실·통제실(시각) ──
  // 문은 남향(z 작은 쪽). 열면 남쪽 운동장으로 나온다.
  { id: "A", kind: "cell", label: "1-1", rect: { x0: -66, z0: 30, x1: -52, z1: 42 }, color: "#2a2d34", openings: [{ edge: "S", at: -59, width: DOOR_W, door: "cell-A" }] },
  { id: "B", kind: "cell", label: "1-2", rect: { x0: -50, z0: 30, x1: -36, z1: 42 }, color: "#2a2d34", openings: [{ edge: "S", at: -43, width: DOOR_W, door: "cell-B" }] },
  { id: "C", kind: "cell", label: "1-3", rect: { x0: -34, z0: 30, x1: -20, z1: 42 }, color: "#2a2d34", openings: [{ edge: "S", at: -27, width: DOOR_W, door: "cell-C" }] },
  { id: "D", kind: "cell", label: "1-4", rect: { x0: -18, z0: 30, x1: -4, z1: 42 }, color: "#2a2d34", openings: [{ edge: "S", at: -11, width: DOOR_W, door: "cell-D" }] },
  { id: "admin", kind: "room", label: "관리실", rect: { x0: -66, z0: 44, x1: -52, z1: 54 }, color: "#343842", openings: [{ edge: "S", at: -59, width: 4 }] },
  { id: "control", kind: "room", label: "본관 통제실", rect: { x0: -50, z0: 44, x1: -36, z1: 54 }, color: "#39323a", openings: [{ edge: "S", at: -43, width: 4 }] },

  // ── 관구실(중앙 통로 landmark, 시각) ──
  { id: "office", kind: "room", label: "관구실", rect: { x0: 4, z0: 42, x1: 22, z1: 54 }, color: "#343842", openings: [{ edge: "S", at: 13, width: 5 }] },

  // ── 별관(미션동, 동): 식당(개방) · 세탁실 · 작업장 · 의무실 ──
  // 문은 서향(x 작은 쪽). 열면 서쪽 운동장으로.
  { id: "cafeteria", kind: "room", label: "식당", rect: { x0: 42, z0: 28, x1: 68, z1: 50 }, color: "#3a3f4a", openings: [{ edge: "W", at: 39, width: 6 }] },
  { id: "laundry", kind: "room", label: "세탁실", rect: { x0: 42, z0: 2, x1: 68, z1: 24 }, color: "#3a3f46", openings: [{ edge: "W", at: 13, width: DOOR_W, door: "door-laundry" }] },
  { id: "workshop", kind: "room", label: "작업장", rect: { x0: 42, z0: -24, x1: 68, z1: -2 }, color: "#3a3a30", openings: [{ edge: "W", at: -13, width: DOOR_W, door: "door-work" }] },
  { id: "infirmary", kind: "room", label: "의무실", rect: { x0: 42, z0: -50, x1: 68, z1: -28 }, color: "#33403f", openings: [{ edge: "W", at: -39, width: DOOR_W, door: "door-med" }] },

  // ── 운동장(개활지, 정문 앞): 벽 없이 바닥 색만. 트랙·농구골대·감시탑은 Map이 얹는다. ──
  { id: "yard", kind: "yard", label: "운동장", rect: { x0: -40, z0: -46, x1: 38, z1: 28 }, color: "#3d4732", noWalls: true },

  // ── 정문초소(시각) ──
  { id: "post", kind: "room", label: "정문초소", rect: { x0: -16, z0: -54, x1: -6, z1: -48 }, color: "#343842", openings: [{ edge: "N", at: -11, width: 3 }] },
];

// ── 스펙 → 벽/문/바닥 자동 생성 ───────────────────────────────────
const hbox = (xa: number, xb: number, zc: number, h: number): WallBox => ({
  cx: (xa + xb) / 2,
  cz: zc,
  hx: Math.abs(xb - xa) / 2,
  hz: WALL_T / 2,
  h,
});
const vbox = (xc: number, za: number, zb: number, h: number): WallBox => ({
  cx: xc,
  cz: (za + zb) / 2,
  hx: WALL_T / 2,
  hz: Math.abs(zb - za) / 2,
  h,
});

/** [lo,hi] 구간을 openings의 개구부만큼 잘라 남는 벽 구간들을 돌려준다. */
function splitSpan(
  lo: number,
  hi: number,
  openings: Opening[],
): [number, number][] {
  const gaps = openings
    .map((o) => [o.at - o.width / 2, o.at + o.width / 2] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const segs: [number, number][] = [];
  let cur = lo;
  for (const [g0, g1] of gaps) {
    if (g0 > cur) segs.push([cur, g0]);
    cur = Math.max(cur, g1);
  }
  if (cur < hi) segs.push([cur, hi]);
  return segs.filter(([a, b]) => b - a > 1e-6);
}

function buildingWalls(b: Building): WallBox[] {
  if (b.noWalls) return [];
  const { x0, z0, x1, z1 } = b.rect;
  const t = WALL_T;
  const h = b.h ?? WALL_H;
  const ops = b.openings ?? [];
  const on = (e: Edge) => ops.filter((o) => o.edge === e);
  const out: WallBox[] = [];
  // 북/남: 수평. 모서리를 덮도록 x를 t/2씩 넓힌다.
  for (const seg of splitSpan(x0 - t / 2, x1 + t / 2, on("N"))) out.push(hbox(seg[0], seg[1], z1, h));
  for (const seg of splitSpan(x0 - t / 2, x1 + t / 2, on("S"))) out.push(hbox(seg[0], seg[1], z0, h));
  // 동/서: 수직. 모서리는 위 북/남이 덮으므로 z0..z1만.
  for (const seg of splitSpan(z0, z1, on("E"))) out.push(vbox(x1, seg[0], seg[1], h));
  for (const seg of splitSpan(z0, z1, on("W"))) out.push(vbox(x0, seg[0], seg[1], h));
  return out;
}

function buildingDoors(b: Building): DoorBox[] {
  const { x0, z0, x1, z1 } = b.rect;
  const t = WALL_T;
  const out: DoorBox[] = [];
  for (const o of b.openings ?? []) {
    if (!o.door) continue;
    if (o.edge === "N" || o.edge === "S") {
      out.push({ id: o.door, cx: o.at, cz: o.edge === "N" ? z1 : z0, hx: o.width / 2, hz: t / 2 });
    } else {
      out.push({ id: o.door, cx: o.edge === "E" ? x1 : x0, cz: o.at, hx: t / 2, hz: o.width / 2 });
    }
  }
  return out;
}

export const WALL_BOXES: WallBox[] = BUILDINGS.flatMap(buildingWalls);
export const DOOR_BOXES: DoorBox[] = BUILDINGS.flatMap(buildingDoors);
export const FLOORS: { rect: Rect; color: string }[] = BUILDINGS.filter(
  (b) => b.color,
).map((b) => ({ rect: b.rect, color: b.color! }));

// ── 렌더/스폰용 파생 메타 ─────────────────────────────────────────
export interface DoorMeta {
  id: string;
  at: [number, number]; // 개구부 중심
  edge: Edge;
  width: number;
}
export const DOOR_META: DoorMeta[] = BUILDINGS.flatMap((b) =>
  (b.openings ?? [])
    .filter((o) => o.door)
    .map((o) => {
      const { x0, z0, x1, z1 } = b.rect;
      const at: [number, number] =
        o.edge === "N" ? [o.at, z1]
        : o.edge === "S" ? [o.at, z0]
        : o.edge === "E" ? [x1, o.at]
        : [x0, o.at];
      return { id: o.door!, at, edge: o.edge, width: o.width };
    }),
);

export interface Cell {
  id: string;
  label: string;
  cx: number;
  cz: number;
  rect: Rect;
}
export const CELLS: Cell[] = BUILDINGS.filter((b) => b.kind === "cell").map((b) => ({
  id: b.id,
  label: b.label ?? b.id,
  cx: (b.rect.x0 + b.rect.x1) / 2,
  cz: (b.rect.z0 + b.rect.z1) / 2,
  rect: b.rect,
}));

export function getBuilding(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** 운동장 정보(농구 이스터에그·트랙·감시탑이 참조). 골대는 (cx+7.5) 부근. */
export const YARD = {
  cx: 0,
  cz: -8,
  rect: getBuilding("yard")!.rect,
};

/**
 * 그 좌표가 어느 감방 안인가. 개활지·다른 건물이면 null.
 * 감방 사각형(CELLS) 안인지로 판정한다. 서버 Room.cellOf와 같은 규약 — 한쪽 고치면 양쪽 반영.
 */
export function cellIdAt(x: number, z: number): string | null {
  for (const c of CELLS) {
    if (x >= c.rect.x0 && x <= c.rect.x1 && z >= c.rect.z0 && z <= c.rect.z1) {
      return c.id;
    }
  }
  return null;
}

/** 랜덤 감방 + 감방 내부 랜덤 위치 스폰(서버 Room.takeFreeCell과 같은 규약). 프론트 단독 실행용. */
export function randomCellSpawn(): [number, number] {
  const c = CELLS[Math.floor(Math.random() * CELLS.length)];
  const ox = (Math.random() * 2 - 1) * 5;
  const oz = (Math.random() * 2 - 1) * 4;
  return [c.cx + ox, c.cz + oz];
}

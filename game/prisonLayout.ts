// 교도소 맵 레이아웃 — 단일 소스(시각 + 충돌 + 스폰이 모두 참조).
//
// 가로로 긴 직사각형 캠퍼스(84×60). 북쪽 절반에 수감동(서)·별관(동)이 복도로 이어지고,
// 남쪽 절반은 모래 바닥의 연병장. 남벽 중앙에 파란 정문(탈옥문을 풀면 열린다).
// 벽·문·바닥은 아래 BUILDINGS(방=사각형 + 문 위치) 스펙에서 **자동 생성**한다 — 좌표를 손으로
// 두 번 쓰지 않으므로 프론트/백 어긋남(러버밴딩)을 원천 차단한다.
//
//   ┌────────────────────────────────────────────┐ z=30 (북)
//   │🗼          [2m 순찰로]                  🗼│
//   │ ┌수감동(2층)────┐┌화장실┐┌별관────────────┐ │
//   │ │ 1-1 │ 1-2   ││ WC  ││ 식당  │ 세탁실  │ │
//   │ │─복도─열린 철창╪╪─복도─╪╪──복도──────────│ │
//   │ │ 1-3 │ 1-4   │└출입구┘│ 작업장 │ 의무실 │ │
//   │ └─────────────┘   ↓   └────────────────┘ │
//   │ ~~~~~~~~~~~ 연병장(모래) ~~~~~~~~~~~~~~~~ │
//   │🗼        ▓▓ 정문(파랑) ▓▓              🗼│
//   └────────────────────────────────────────────┘ z=-30 (남)
//
// 인접한 방이 벽을 공유할 때는 한쪽만 벽을 갖고 반대쪽은 그 변 전체를 개구부로 비운다
// (같은 자리에 벽 상자가 둘 생기면 렌더가 z-fighting으로 깜빡인다). 규칙: 서쪽 방이 동벽을 소유.
//
// ⚠️ 서버 Collision.java(같은 BUILDINGS 스펙에서 생성) / Room.java(CELL_CENTERS·cellOf·LOCK_OPENS)
//    / BotNav.java(웨이포인트) / Interactables.java(POI) 와 규약을 맞출 것. 방을 옮기면 이 파일과
//    Collision.java의 BUILDINGS를 같은 값으로 고치면 벽·문은 자동으로 맞는다.

export const WALL_H = 3; // 실내 벽 높이(m)
export const FLOOR2_Y = 4.5; // 수감동 2층 바닥 높이(m). 3인칭 카메라(pitch↑)가 천장에 가리지 않을 층고.
export const CELL_BLOCK_H = FLOOR2_Y * 2; // 수감동(2층) 벽 높이(m)
export const WALL_T = 0.4; // 벽 두께(m)
export const PLAYER_R = 0.4; // 플레이어 반경(원 충돌)
export const DOOR_W = 2; // 잠금 문 개구부 폭(m)

// 안전용 바깥 사각 경계(실제 격리는 외벽이 담당; 이 clamp는 탈출 방지 그물). 외벽 안쪽 면.
export const BOUND_X = 41.6;
export const BOUND_Z = 29.6;

// F로 문을 열/닫을 수 있는 거리(m). 서버 Room.BOT_DOOR_RANGE와 같은 값.
export const DOOR_RANGE = 3.0;

// 걸어서 오를 수 있는 턱 높이(m). 계단은 이 스냅으로 오른다(점프 불필요).
export const STEP_UP = 0.5;

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
  kind: "perimeter" | "yard" | "cell" | "room" | "hall";
  rect: Rect;
  h?: number; // 벽 높이(기본 WALL_H)
  color?: string; // 바닥 색(없으면 바닥 생략)
  openings?: Opening[];
  noWalls?: boolean; // 개활지(연병장 등): 바닥 색만, 벽 생성 안 함
}

// 복도의 인접 변을 통째로 비우는 개구부 폭. 북/남 변은 모서리 덮개(±WALL_T/2)까지 걷어야
// 이웃 벽과 겹치는 토막이 안 남는다.
const HALL_W = 32; // 수감동·별관 복도 x 폭
const FULL_NS = HALL_W + WALL_T; // 북/남 변 전체 개구부(모서리 포함)
const CORNER = WALL_T; // 이웃 벽의 모서리 덮개와 겹치는 토막 제거용

// ── 도면 배치 ──────────────────────────────────────────────────────
// 좌표계: z+ = 북(도면 위쪽). 수감동은 북서, 별관은 북동, 연병장·정문은 남.
export const BUILDINGS: Building[] = [
  // 외벽(전체를 감싼다). 남벽 중앙이 정문 — 탈옥문(escape-gate)을 풀면 열린다.
  {
    id: "perimeter", kind: "perimeter", rect: { x0: -42, z0: -30, x1: 42, z1: 30 }, h: 5,
    openings: [{ edge: "S", at: 0, width: 8, door: "gate-main" }],
  },

  // ── 수감동(북서, 2층): 1층 감방 4개가 복도를 사이에 두고 2:2 마주보기 ──
  // 북측(1-1·1-2)은 남향 문, 남측(1-3·1-4)은 북향 문 → 모두 가운데 복도로 나온다.
  { id: "A", kind: "cell", label: "1-1", rect: { x0: -38, z0: 20, x1: -22, z1: 28 }, h: CELL_BLOCK_H, color: "#2a2d34", openings: [{ edge: "S", at: -30, width: DOOR_W, door: "cell-A" }] },
  // 서쪽 이웃에게 벽을 양보한 방(B·D)은 북/남 변의 공유 모서리 토막(0.4)도 함께 비운다 —
  // 이웃이 모서리 덮개(±t/2)로 이미 채운 자리라, 남겨두면 같은 자리에 벽이 두 번 생긴다.
  { id: "B", kind: "cell", label: "1-2", rect: { x0: -22, z0: 20, x1: -6, z1: 28 }, h: CELL_BLOCK_H, color: "#2a2d34", openings: [{ edge: "S", at: -14, width: DOOR_W, door: "cell-B" }, { edge: "W", at: 24, width: 8 }, { edge: "N", at: -22, width: CORNER }, { edge: "S", at: -22, width: CORNER }] },
  { id: "C", kind: "cell", label: "1-3", rect: { x0: -38, z0: 6, x1: -22, z1: 14 }, h: CELL_BLOCK_H, color: "#2a2d34", openings: [{ edge: "N", at: -30, width: DOOR_W, door: "cell-C" }] },
  { id: "D", kind: "cell", label: "1-4", rect: { x0: -22, z0: 6, x1: -6, z1: 14 }, h: CELL_BLOCK_H, color: "#2a2d34", openings: [{ edge: "N", at: -14, width: DOOR_W, door: "cell-D" }, { edge: "W", at: 10, width: 8 }, { edge: "N", at: -22, width: CORNER }, { edge: "S", at: -22, width: CORNER }] },
  // 수감동 복도: 북/남 변은 감방 벽이 담당(전체 개구), 동쪽은 연결 복도로 열림. 서쪽 벽만 소유.
  {
    id: "hall-west", kind: "hall", label: "수감동", rect: { x0: -38, z0: 14, x1: -6, z1: 20 }, h: CELL_BLOCK_H, color: "#30343c",
    openings: [
      { edge: "N", at: -22, width: FULL_NS },
      { edge: "S", at: -22, width: FULL_NS },
      { edge: "E", at: 17, width: 6 },
    ],
  },

  // ── 연결 복도(중앙): 수감동↔별관. 남벽 중앙이 단지 출입구(연병장으로). 열린 철창은 Map이 얹는다 ──
  {
    id: "link", kind: "hall", rect: { x0: -6, z0: 14, x1: 6, z1: 20 }, color: "#30343c",
    openings: [
      { edge: "N", at: 0, width: 12 + WALL_T }, // 화장실 남벽이 담당
      { edge: "E", at: 17, width: 6 },
      { edge: "W", at: 17, width: 6 },
      // 남벽: 중앙 출입구 + 양끝 모서리 토막 제거(이웃 감방·작업장 벽과 겹침 방지)
      { edge: "S", at: -6, width: CORNER },
      { edge: "S", at: 0, width: 3 },
      { edge: "S", at: 6, width: CORNER },
    ],
  },
  // 화장실(연결 복도 북측). 동/서 벽은 이웃 건물이 담당.
  {
    id: "toilet", kind: "room", label: "화장실", rect: { x0: -6, z0: 20, x1: 6, z1: 28 }, color: "#3b444f",
    openings: [
      { edge: "W", at: 24, width: 8 },
      { edge: "E", at: 24, width: 8 },
      { edge: "N", at: -6, width: CORNER },
      { edge: "N", at: 6, width: CORNER },
      { edge: "S", at: -6, width: CORNER },
      { edge: "S", at: 0, width: DOOR_W },
      { edge: "S", at: 6, width: CORNER },
    ],
  },

  // ── 별관(북동): 식당(개방) · 세탁실 · 작업장 · 의무실. 문은 모두 가운데 복도로 ──
  // 바닥에 방마다 다른 색을 깔아 구분한다(식당=따뜻한 갈색, 세탁실=파랑, 작업장=황토, 의무실=청록).
  { id: "cafeteria", kind: "room", label: "식당", rect: { x0: 6, z0: 20, x1: 22, z1: 28 }, color: "#4a4033", openings: [{ edge: "S", at: 14, width: 4 }] },
  { id: "laundry", kind: "room", label: "세탁실", rect: { x0: 22, z0: 20, x1: 38, z1: 28 }, color: "#33455c", openings: [{ edge: "S", at: 30, width: DOOR_W, door: "door-laundry" }, { edge: "W", at: 24, width: 8 }, { edge: "N", at: 22, width: CORNER }, { edge: "S", at: 22, width: CORNER }] },
  { id: "workshop", kind: "room", label: "작업장", rect: { x0: 6, z0: 6, x1: 22, z1: 14 }, color: "#4b452a", openings: [{ edge: "N", at: 14, width: DOOR_W, door: "door-work" }] },
  { id: "infirmary", kind: "room", label: "의무실", rect: { x0: 22, z0: 6, x1: 38, z1: 14 }, color: "#2f4a44", openings: [{ edge: "N", at: 30, width: DOOR_W, door: "door-med" }, { edge: "W", at: 10, width: 8 }, { edge: "N", at: 22, width: CORNER }, { edge: "S", at: 22, width: CORNER }] },
  // 별관 복도: 동쪽 벽만 소유(서쪽은 연결 복도로 열림, 북/남은 방 벽이 담당).
  {
    id: "hall-east", kind: "hall", label: "별관", rect: { x0: 6, z0: 14, x1: 38, z1: 20 }, color: "#30343c",
    openings: [
      { edge: "N", at: 22, width: FULL_NS },
      { edge: "S", at: 22, width: FULL_NS },
      { edge: "W", at: 17, width: 6 },
    ],
  },

  // ── 연병장(남쪽 절반, 개활지): 황량한 모래 마당. 골대·구석 벤치는 Map이 얹는다 ──
  { id: "yard", kind: "yard", label: "연병장", rect: { x0: -42, z0: -30, x1: 42, z1: 6 }, color: "#9c8756", noWalls: true },
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

/** 연병장 정보(농구 이스터에그·구석 벤치가 참조). 골대는 (cx+7.5) 부근. */
export const YARD = {
  cx: 0,
  cz: -12,
  rect: getBuilding("yard")!.rect,
};

/** 정문(남벽 중앙, 파란 철문). Map의 정문 비주얼과 탈옥문 상호작용이 참조한다. */
export const GATE = { x: 0, z: -30, width: 8 };

/** 감시탑 자리 — 맵 네 모서리(담장 위). 시각 전용(다리가 가늘어 충돌 없음). */
export const TOWERS: [number, number][] = [
  [-42, -30],
  [42, -30],
  [-42, 30],
  [42, 30],
];

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
  const ox = (Math.random() * 2 - 1) * 6;
  const oz = (Math.random() * 2 - 1) * 2.5;
  return [c.cx + ox, c.cz + oz];
}

// ── 수감동 2층(걸어 올라갈 수 있다) ────────────────────────────────
// 이동은 XZ + "바닥 높이"로 푼다: groundHeightAt이 그 좌표의 지지 바닥(1층 0 / 2층 FLOOR2_Y /
// 계단 램프)을 돌려주고, 플레이어는 STEP_UP 이하의 턱을 걸어서 스냅해 오른다. 계단만이 2층으로
// 가는 유일한 경사라 점프(최고 1m)로는 2층에 못 오른다.
// ⚠️ 서버 Collision.java(SLAB2·STAIR·OBSTACLES·groundHeight)와 같은 값 — 한쪽 고치면 양쪽 반영.

/** 계단(복도 서쪽 끝 중앙, 막다른 벽을 향해 오르는 직선 계단). 동쪽 끝(x1)이 1층 바닥,
 *  서쪽 끝(x0)이 2층 — 꼭대기 랜딩(서쪽 끝 벽 앞)에서 좌우(남·북) 테라스로 갈라진다.
 *  양측 난간벽이 옆 진입을 막고, 1층 통행은 계단 남/북의 2m 통로로 지나간다. */
export const STAIR = { x0: -36, z0: 16, x1: -29.6, z1: 18 };

/** 2층 바닥 슬래브: 감방 두 열 위 + 좌우로 뻗은 테라스형 복도(난간) + 계단 상단 랜딩(서쪽 끝).
 *  복도 가운데(z 16~18)의 계단 동쪽은 아트리움 개구부 — 테라스에서 1층 복도가 내려다보인다. */
export const SLAB2: Rect[] = [
  { x0: -38, z0: 20, x1: -6, z1: 28 }, // 북측 감방 열 위
  { x0: -38, z0: STAIR.z1, x1: -6, z1: 20 }, // 북측 테라스(감방 1-1·1-2 앞)
  { x0: -38, z0: 6, x1: -6, z1: 14 }, // 남측 감방 열 위
  { x0: -38, z0: 14, x1: -6, z1: STAIR.z0 }, // 남측 테라스(감방 1-3·1-4 앞)
  { x0: -38, z0: STAIR.z0, x1: STAIR.x0, z1: STAIR.z1 }, // 계단 상단 랜딩 — 좌우 테라스를 잇는다
];

/**
 * (x,z)에서 딛고 설 수 있는 바닥 높이(발바닥 기준). 지금 높이(feetY)에서 STEP_UP 이하로
 * 닿는 바닥 중 가장 높은 것 — 1층에서 2층 슬래브는 머리 위 천장일 뿐이므로 후보에서 빠진다.
 */
export function groundHeightAt(x: number, z: number, feetY: number): number {
  let g = 0;
  if (x >= STAIR.x0 && x <= STAIR.x1 && z >= STAIR.z0 && z <= STAIR.z1) {
    const h = (FLOOR2_Y * (STAIR.x1 - x)) / (STAIR.x1 - STAIR.x0);
    if (h <= feetY + STEP_UP && h > g) g = h;
  } else if (FLOOR2_Y <= feetY + STEP_UP) {
    for (const r of SLAB2) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
        g = FLOOR2_Y;
        break;
      }
    }
  }
  return g;
}

// ── 소품 충돌(실체가 있는 오브젝트) ────────────────────────────────
// Map.tsx의 소품(침상·테이블·세탁기…)과 같은 자리의 AABB. 자물쇠·쪽지(상호작용 오브젝트)는
// 실체가 없다 — 밟고 지나며 상호작용하는 대상이라 막으면 오히려 불편하다.
// [y0, y1)은 이 장애물이 유효한 발높이 구간: 1층 소품은 2층에서 그 위를 걸어도 걸리지 않고,
// 2층 난간은 1층 통행을 막지 않는다.
export interface ObstacleBox {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  y0: number;
  y1: number;
}
const OB = (cx: number, cz: number, hx: number, hz: number, y0 = -1, y1 = 3): ObstacleBox =>
  ({ cx, cz, hx, hz, y0, y1 });

export const OBSTACLES: ObstacleBox[] = [
  // 감방 소품(Map.CellInterior와 같은 자리): 이층 침상(서벽) + 변기(문 반대편 구석)
  ...BUILDINGS.filter((b) => b.kind === "cell").flatMap((b) => {
    const z = (b.rect.z0 + b.rect.z1) / 2;
    const doorS = b.openings?.[0]?.edge === "S";
    return [
      OB(b.rect.x0 + 1.4, z, 0.5, 1.55),
      OB(b.rect.x1 - 1.3, doorS ? b.rect.z1 - 1.3 : b.rect.z0 + 1.3, 0.4, 0.4),
    ];
  }),
  // 화장실: 변기·칸막이 열(북벽) + 세면대(서벽)
  OB(0, 26.8, 4.3, 0.55),
  OB(-5.4, 22.5, 0.35, 1.5),
  // 식당: 식탁+벤치 2조 + 배식대(북벽)
  OB(10, 23.5, 1.6, 1.15),
  OB(18, 23.5, 1.6, 1.15),
  OB(14, 27.2, 5, 0.5),
  // 세탁실: 세탁기 4대(북벽) + 카트(동남쪽 구석 — 문(x30) 정면 동선을 비운다)
  OB(25, 26.8, 0.8, 0.9),
  OB(28.2, 26.8, 0.8, 0.9),
  OB(31.4, 26.8, 0.8, 0.9),
  OB(34.6, 26.8, 0.8, 0.9),
  OB(35, 21.6, 0.7, 0.5),
  // 작업장: 작업대(북벽 서편 — 문(x14) 정면 동선을 비운다) + 상자 5개
  OB(10, 12.4, 3, 0.7),
  ...[10, 12, 14, 16, 18].map((x) => OB(x, 7.6, 0.5, 0.5)),
  // 의무실: 침대 3 + 약장(동벽)
  OB(25.5, 8.3, 0.6, 1.3),
  OB(30, 8.3, 0.6, 1.3),
  OB(34.5, 8.3, 0.6, 1.3),
  OB(36.8, 10, 0.5, 1.5),
  // 연병장(황량한 마당): 남서 구석의 벤치 셋 + 농구골대 기둥
  OB(-37, -29.2, 2, 0.35),
  OB(-31, -29.2, 2, 0.35),
  OB(-41.3, -25, 0.35, 2),
  OB(7.5, -12, 0.15, 0.15),
  // 정문 기둥 + 연결 복도 철창 기둥(x=-3: 출입구·복도 교차점(x=0) 동선을 비켜 세운다)
  OB(-4.5, -30, 0.5, 0.5),
  OB(4.5, -30, 0.5, 0.5),
  OB(-3, 14.5, 0.1, 0.12),
  OB(-3, 19.5, 0.1, 0.12),
  // 감시탑 안쪽 다리(맵 안으로 들어온 다리 하나씩)
  OB(-40.8, -28.8, 0.15, 0.15),
  OB(40.8, -28.8, 0.15, 0.15),
  OB(-40.8, 28.8, 0.15, 0.15),
  OB(40.8, 28.8, 0.15, 0.15),
  // 계단 구조물(복도 서쪽 끝 중앙 계단) —
  // 양측 난간벽(전 높이): 1층 복도에서 옆으로 램프에 오르는 것과 2층 테라스에서 램프 위로
  // 떨어지는 것을 함께 막는다. 1층 통행은 계단 남/북의 2m 통로로 지나간다(봇 노드도 분리).
  OB((STAIR.x0 + STAIR.x1) / 2, STAIR.z0, (STAIR.x1 - STAIR.x0) / 2, 0.1, -1, 99),
  OB((STAIR.x0 + STAIR.x1) / 2, STAIR.z1, (STAIR.x1 - STAIR.x0) / 2, 0.1, -1, 99),
  // 계단 밑 진입 차단(머리가 계단 밑면에 끼는 구간, 발높이 0.4 미만에서만): 랜딩 아래(서쪽)에서
  // 들어올 때만 해당 — 서쪽 높은 구간은 머리 공간이 넉넉해 지나갈 수 있고, 계단을 오르내리는
  // 사람은 박스에 닿는 지점(반경 포함, x≈-30.34)에서 발높이가 이미 0.52+라 걸리지 않는다.
  OB(-31.95, 17, 1.21, 0.9, -1, 0.4),
  // 2층 테라스 난간(아트리움 개구부 가장자리, 계단 동쪽): 테라스에서 1층 복도로 추락 방지
  OB((STAIR.x1 - 6) / 2, STAIR.z0, (-6 - STAIR.x1) / 2, 0.1, 3, 99),
  OB((STAIR.x1 - 6) / 2, STAIR.z1, (-6 - STAIR.x1) / 2, 0.1, 3, 99),
  // 2층 복도 동측 막이(1층 연결 복도 아치 위): 2층이 연결 복도 쪽으로 뚫려 떨어지는 것을 막는다.
  OB(-6, 17, 0.2, 3, 3, 99),
];

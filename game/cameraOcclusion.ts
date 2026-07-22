// 3인칭 카메라 가림 보정용 정적 차폐물(벽 + 2층 슬래브 + 계단 덩어리 + 2층 막이).
//
// 시점이 돌 때 카메라가 벽 뒤로 넘어가 시야가 막히는 문제를, "머리→카메라" 선분과
// 이 AABB들의 첫 교차점 앞으로 카메라를 당겨서 푼다(씬 레이캐스트 대신 레이아웃
// 단일 소스의 상자들로 계산 — 프레임당 상자 ~70개 slab 교차라 비용이 없다시피 하다).
//
// 창살 문·난간·소품처럼 가늘거나 낮은 것은 일부러 뺐다: 사이로 시야가 통하는 데다,
// 차폐물로 넣으면 지나칠 때마다 카메라가 잘게 튄다.
import {
  CELL_BLOCK_H,
  FLOOR2_Y,
  SLAB2,
  STAIR,
  WALL_BOXES,
  WALL_H,
} from "./prisonLayout";

interface AABB {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

const OCCLUDERS: AABB[] = [
  // 모든 벽(자동 생성. 외벽·수감동 h=5~9 포함)
  ...WALL_BOXES.map((w) => ({
    x0: w.cx - w.hx,
    x1: w.cx + w.hx,
    y0: 0,
    y1: w.h,
    z0: w.cz - w.hz,
    z1: w.cz + w.hz,
  })),
  // 2층 슬래브(두께는 렌더 상자(0.16)와 동일) — 1층에서 위를 올려다볼 때의 천장
  ...SLAB2.map((r) => ({
    x0: r.x0,
    x1: r.x1,
    y0: FLOOR2_Y - 0.08,
    y1: FLOOR2_Y + 0.08,
    z0: r.z0,
    z1: r.z1,
  })),
  // 계단은 쐐기지만 AABB로 근사한다 — 이 구역을 관통하는 카메라는 어차피 계단 살을 뚫는다
  { x0: STAIR.x0, x1: STAIR.x1, y0: 0, y1: FLOOR2_Y, z0: STAIR.z0, z1: STAIR.z1 },
  // 2층 복도 동측 막이(콘크리트 판, Map·OBSTACLES와 같은 자리)
  { x0: -6.2, x1: -5.8, y0: WALL_H, y1: CELL_BLOCK_H, z0: 14, z1: 20 },
];

/**
 * (ox,oy,oz)→(tx,ty,tz) 선분이 차폐물에 처음 걸리는 지점의 선분 비율 t(0~1). 안 걸리면 1.
 * 표준 slab 교차. 시작점이 상자 안이면 0 — 호출부가 최소 거리로 처리한다.
 */
export function cameraClearT(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
): number {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  let best = 1;
  for (const b of OCCLUDERS) {
    let t0 = 0;
    let t1 = best; // best보다 먼 교차는 볼 필요 없다
    let hit = true;
    // 축별 slab 교차(x → y → z). d≈0이면 그 축은 구간 포함 여부만 본다.
    for (let axis = 0; axis < 3; axis++) {
      const o = axis === 0 ? ox : axis === 1 ? oy : oz;
      const d = axis === 0 ? dx : axis === 1 ? dy : dz;
      const lo = axis === 0 ? b.x0 : axis === 1 ? b.y0 : b.z0;
      const hi = axis === 0 ? b.x1 : axis === 1 ? b.y1 : b.z1;
      if (Math.abs(d) < 1e-9) {
        if (o < lo || o > hi) {
          hit = false;
          break;
        }
        continue;
      }
      let ta = (lo - o) / d;
      let tb = (hi - o) / d;
      if (ta > tb) {
        const tmp = ta;
        ta = tb;
        tb = tmp;
      }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) {
        hit = false;
        break;
      }
    }
    if (hit && t0 < best) best = t0;
  }
  return best;
}

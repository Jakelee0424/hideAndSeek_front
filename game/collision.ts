// 정적 맵 충돌(클라 예측). 플레이어=원(PLAYER_R), 벽=XZ AABB, 외곽=사각 경계.
// 벽·소품·2층 좌표는 prisonLayout.ts 단일 소스에서 가져온다.
//
// 높이(y)는 발바닥 기준으로 층을 가른다:
//   - 벽: 전 높이에서 막는다(수감동 벽은 2층까지 이어진다)
//   - 잠금 문: 1층(발높이 < WALL_H)에서만. 2층 감방 문턱은 열린 개구부다
//   - 소품(OBSTACLES): 각자 [y0, y1) 발높이 구간에서만 — 1층 침대는 2층 통행을 막지 않는다
//
// ⚠️ 서버 Collision.java 와 벽·소품 정의·해석이 반드시 동일해야 한다
//    (서버 권위 + 클라 예측이 어긋나면 러버밴딩). 한쪽 바꾸면 양쪽 반영.
import {
  BOUND_X,
  BOUND_Z,
  DOOR_BOXES,
  OBSTACLES,
  PLAYER_R,
  WALL_BOXES,
  WALL_H,
} from "./prisonLayout";

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : Math.min(v, hi);

interface Box {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}

// 원(반경 r)을 AABB 박스 밖으로 밀어낸다.
function pushOut(x: number, z: number, b: Box, r: number): [number, number] {
  const nx = clamp(x, b.cx - b.hx, b.cx + b.hx);
  const nz = clamp(z, b.cz - b.hz, b.cz + b.hz);
  const dx = x - nx;
  const dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [x, z];
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    return [x + dx * push, z + dz * push];
  }
  // 중심이 박스 내부: 침투가 작은 축으로 밀어냄
  const penX = b.hx + r - Math.abs(x - b.cx);
  const penZ = b.hz + r - Math.abs(z - b.cz);
  if (penX < penZ) return [x + Math.sign(x - b.cx) * penX, z];
  return [x, z + Math.sign(z - b.cz) * penZ];
}

/**
 * (x,z)를 외곽 경계 + 벽 + 소품 밖으로 밀어낸 위치를 반환. feetY는 발바닥 높이(층 판정).
 * 감방문은 openDoors[id]가 true면(열림) 충돌에서 제외 → 통과.
 */
export function resolveCollision(
  x: number,
  z: number,
  feetY: number,
  openDoors: Record<string, boolean>,
): [number, number] {
  x = clamp(x, -BOUND_X, BOUND_X);
  z = clamp(z, -BOUND_Z, BOUND_Z);

  const r = PLAYER_R;
  for (const b of WALL_BOXES) [x, z] = pushOut(x, z, b, r);
  for (const o of OBSTACLES) {
    if (feetY < o.y0 || feetY >= o.y1) continue; // 다른 층의 소품
    [x, z] = pushOut(x, z, o, r);
  }
  if (feetY < WALL_H) {
    for (const d of DOOR_BOXES) {
      if (openDoors[d.id]) continue; // 열린 문은 통과
      [x, z] = pushOut(x, z, d, r);
    }
  }
  return [x, z];
}

/**
 * 플레이어끼리의 원-원 충돌: (x,z)를 상대(ox,oz) 밖으로 민다. 층이 다르면(발높이 차가 크면)
 * 호출부에서 거른다. 서버 Room.tick의 플레이어 충돌과 같은 규약 — 서버는 둘을 반씩 밀지만
 * 클라 예측은 내 쪽만 민다(상대는 보간 재생이라 어차피 서버 좌표를 따른다).
 */
export function pushOutOfPlayer(
  x: number,
  z: number,
  ox: number,
  oz: number,
): [number, number] {
  const min = PLAYER_R * 2;
  const dx = x - ox;
  const dz = z - oz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min) return [x, z];
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    return [ox + (dx / d) * min, oz + (dz / d) * min];
  }
  return [x + min, z]; // 완전히 겹침: 아무 방향으로나
}

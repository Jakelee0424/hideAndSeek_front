// 정적 맵 충돌(클라 예측). 플레이어=원(PLAYER_R), 벽=XZ AABB, 외곽=사각 경계.
// 벽 좌표는 prisonLayout.ts 단일 소스에서 가져온다.
//
// ⚠️ 서버 Collision.java 와 벽 정의·해석이 반드시 동일해야 한다
//    (서버 권위 + 클라 예측이 어긋나면 러버밴딩). 한쪽 바꾸면 양쪽 반영.
import {
  BOUND_X,
  BOUND_Z,
  DOOR_BOXES,
  PLAYER_R,
  WALL_BOXES,
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
 * (x,z)를 외곽 경계 + 벽 밖으로 밀어낸 위치를 반환.
 * 감방문은 openDoors[id]가 true면(열림) 충돌에서 제외 → 통과.
 */
export function resolveCollision(
  x: number,
  z: number,
  openDoors: Record<string, boolean>,
): [number, number] {
  x = clamp(x, -BOUND_X, BOUND_X);
  z = clamp(z, -BOUND_Z, BOUND_Z);

  const r = PLAYER_R;
  for (const b of WALL_BOXES) [x, z] = pushOut(x, z, b, r);
  for (const d of DOOR_BOXES) {
    if (openDoors[d.id]) continue; // 열린 문은 통과
    [x, z] = pushOut(x, z, d, r);
  }
  return [x, z];
}

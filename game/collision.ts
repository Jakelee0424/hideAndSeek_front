// 정적 맵 충돌(클라 예측). 플레이어=원(PLAYER_R), 장애물=XZ AABB, 벽=경계.
//
// ⚠️ 서버 Collision.java 와 장애물 정의·해석이 반드시 동일해야 한다
//    (서버 권위 + 클라 예측이 어긋나면 러버밴딩). 한쪽 바꾸면 양쪽 반영.
export const PLAYER_R = 0.4;
export const ROOM_INNER = 10.4; // 벽 안쪽면 - 플레이어 반경 (Map.tsx ROOM=11, 벽두께 0.4)

interface Box {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  solvableId?: string; // 있으면 해결 시 통과 가능(문)
}

const OBSTACLES: Box[] = [
  { cx: 3, cz: 3, hx: 0.5, hz: 0.5 }, // crate
  { cx: 4, cz: 3, hx: 0.5, hz: 0.5 }, // crate
  { cx: -4, cz: -5, hx: 0.5, hz: 0.5 }, // crate
  { cx: 5, cz: -4, hx: 0.45, hz: 0.45 }, // lockbox
  { cx: -8, cz: 0, hx: 0.8, hz: 0.125, solvableId: "door-1" }, // door
];

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : Math.min(v, hi);

/** (x,z)를 벽 경계 + 장애물 밖으로 밀어낸 위치를 반환. */
export function resolveCollision(
  x: number,
  z: number,
  solved: Record<string, boolean>,
): [number, number] {
  x = clamp(x, -ROOM_INNER, ROOM_INNER);
  z = clamp(z, -ROOM_INNER, ROOM_INNER);

  const r = PLAYER_R;
  for (const b of OBSTACLES) {
    if (b.solvableId && solved[b.solvableId]) continue;
    const nx = clamp(x, b.cx - b.hx, b.cx + b.hx);
    const nz = clamp(z, b.cz - b.hz, b.cz + b.hz);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      x += dx * push;
      z += dz * push;
    } else {
      const penX = b.hx + r - Math.abs(x - b.cx);
      const penZ = b.hz + r - Math.abs(z - b.cz);
      if (penX < penZ) x += Math.sign(x - b.cx) * penX;
      else z += Math.sign(z - b.cz) * penZ;
    }
  }
  return [x, z];
}

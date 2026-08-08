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

const inBounds = (x: number, z: number) =>
  x >= -BOUND_X && x <= BOUND_X && z >= -BOUND_Z && z <= BOUND_Z;

/**
 * 맵 안에 남는 출구로 내보낸다. 네 면(±x·±z) 중 경계를 안 넘는 것 가운데 가장 가까운 쪽.
 *
 * ⚠️ 왜 필요한가 — **담장에 박힌 소품 뒤에는 반지름만큼의 여유가 담장 밖에만 있다.**
 * 연병장 벤치 셋(남벽 둘 · 서벽 하나)이 그렇다: 벤치와 담장 사이로 밀린 원은 가장 가까운
 * 면 기준으로 경계 밖(예: z −29.95, 경계는 −29.6)으로 나가는데, 다음 프레임의 경계 clamp가
 * 그 자리를 도로 벤치 안으로 집어넣는다 → **밀림 ↔ clamp 무한 왕복**. 그동안 플레이어는
 * 그 방향으로 한 발도 못 나간다("연병장에서 갇혀 이동이 안 된다"의 정체).
 * 맵 전수 검사에서 이렇게 경계 밖으로 밀리는 칸은 **연병장 벤치 세 곳(397칸)뿐**이었다.
 */
function exitInBounds(x: number, z: number, b: Box, r: number): [number, number] {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  const cands: [number, number][] = [
    [b.cx + b.hx + r, z],
    [b.cx - b.hx - r, z],
    [x, b.cz + b.hz + r],
    [x, b.cz - b.hz - r],
  ];
  for (const c of cands) {
    if (!inBounds(c[0], c[1])) continue;
    const d = Math.hypot(c[0] - x, c[1] - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best ?? [x, z]; // 어느 쪽도 맵 안이 아니면(이론상 없음) 그대로 둔다
}

// 원(반경 r)을 AABB 박스 밖으로 밀어낸다.
function pushOut(x: number, z: number, b: Box, r: number): [number, number] {
  const nx = clamp(x, b.cx - b.hx, b.cx + b.hx);
  const nz = clamp(z, b.cz - b.hz, b.cz + b.hz);
  const dx = x - nx;
  const dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [x, z];
  let px: number;
  let pz: number;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    px = x + dx * push;
    pz = z + dz * push;
  } else {
    // 중심이 박스 내부: 침투가 작은 축으로 밀어냄
    const penX = b.hx + r - Math.abs(x - b.cx);
    const penZ = b.hz + r - Math.abs(z - b.cz);
    if (penX < penZ) {
      px = x + Math.sign(x - b.cx) * penX;
      pz = z;
    } else {
      px = x;
      pz = z + Math.sign(z - b.cz) * penZ;
    }
  }
  // 밀어낸 자리가 맵 밖이면 그쪽으로 내보내지 않는다(위 exitInBounds 주석 참고).
  return inBounds(px, pz) ? [px, pz] : exitInBounds(x, z, b, r);
}

/**
 * 벽을 등지는 방향(yaw). 벽에 붙는 물건(자물쇠 프리팹)을 어느 쪽으로 돌릴지 정한다.
 *
 * 왜 필요한가 — 자물쇠 프리팹은 앞면(게임기 화면·문자 휠·숫자 다이얼·판독창)이 로컬 +Z를
 * 본다. 그런데 Interactable은 위치만 주고 회전을 안 줘서 **모든 자물쇠가 월드 +Z 한 방향**을
 * 봤다. 벽 방향이 다른 자물쇠는 뒷면이 플레이어를 향해, 밋밋한 상자만 보인다.
 *
 * 규칙: 16방향으로 조금씩 나아가며 처음 막히는 거리를 재고, **가장 빨리 막히는 방향(=벽)의
 * 반대**를 본다. 구석이면 자연히 방 안쪽을 본다. 좌표를 손으로 넣지 않아도 되고, 맵이
 * 바뀌어도 따라간다.
 *
 * ⚠️ 문은 **닫힌 것으로 친다**(openDoors 없음). 자물쇠는 제 문 바로 옆에 붙어 있으므로,
 *    열린 문을 통과로 보면 문 쪽이 트인 방향이 돼 자물쇠가 문 밖을 보고 돌아선다.
 */
export function wallAwayYaw(x: number, z: number, feetY = 0): number {
  const DIRS = 16;
  const STEP = 0.25;
  const MAX = 2.5;
  let worst = Infinity; // 가장 짧은 여유(=가장 가까운 벽)
  let worstYaw = 0;
  for (let i = 0; i < DIRS; i++) {
    const a = (i * 2 * Math.PI) / DIRS;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    let clear = MAX;
    for (let d = STEP; d <= MAX; d += STEP) {
      const px = x + dx * d;
      const pz = z + dz * d;
      const [rx, rz] = resolveCollision(px, pz, feetY, {});
      if (Math.abs(rx - px) > 0.02 || Math.abs(rz - pz) > 0.02) {
        clear = d;
        break;
      }
    }
    if (clear < worst) {
      worst = clear;
      worstYaw = a;
    }
  }
  // 사방이 트여 있으면(마당 한복판 등) 원래대로 둔다 — 등질 벽이 없다.
  if (worst >= MAX) return 0;
  return worstYaw + Math.PI;
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

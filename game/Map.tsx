"use client";
// 교도소 캠퍼스 맵. 좌표·벽·문·바닥은 prisonLayout.ts(BUILDINGS 스펙에서 자동 생성)를 따른다.
// 이 파일은 그 데이터를 3D로 그리기만 한다: 베이스 지면 + 콘크리트 벽 + 방향별 문 + 건물별 소품
// + 수감동 2층(시각 전용) + 네 모서리 감시탑 + 남벽 중앙의 파란 정문.
import { Html, Instance, Instances, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import Basketball from "./Basketball";
import PrisonProps from "./PrisonProps";
import { Toilet } from "./CellFurniture";
import Interactable from "./Interactable";
import { INTERACTABLES, isCellDoorOpen, isDrainGateOpen, useInteraction } from "./interactables";
import { SYMBOLS, escapePlan } from "./escapePlan";
import { symbolIcon } from "./symbols";
import { useGameStore } from "@/store/gameStore";
import {
  ANNEX_H,
  ANNEX_ROOF,
  BUILDINGS,
  CELLBLOCK_GATE,
  CELL_BLOCK_H,
  COURT,
  DOOR_META,
  DOOR_W,
  ENTRANCE_GATE,
  DRAIN_GATE,
  FLOOR2_Y,
  FLOORS,
  GATE,
  PIPE,
  SLAB2,
  STAIR,
  TOWERS,
  WALL_BOXES,
  WALL_H,
  WALL_T,
  getBuilding,
  type Building,
  type DoorMeta,
  type Edge,
} from "./prisonLayout";

const BAR_W = 0.08;

// 사용자 제작 텍스처(albedo + normal). Downloads/textures → public/textures 로 복사해 둔다.
const TEX = {
  concrete: "/textures/concrete_wall.png",
  concreteN: "/textures/concrete_wall_normal.png",
  steel: "/textures/steel_bars.png",
  steelN: "/textures/steel_bars_normal.png",
  gate: "/textures/gate_blue.png",
  gateN: "/textures/gate_blue_normal.png",
  floorCell: "/textures/floor_cell.png",
  floorCellN: "/textures/floor_cell_normal.png",
  floorYard: "/textures/floor_yard.png",
  floorYardN: "/textures/floor_yard_normal.png",
  wood: "/textures/wood_old.png",
  woodN: "/textures/wood_old_normal.png",
  water: "/textures/wet_drain.png",
  waterN: "/textures/wet_drain_normal.png",
} as const;

// 타일 하나가 덮는 실제 길이(m). 밀도는 텍스처 repeat이 아니라 **지오메트리 UV를 면 크기에
// 비례시켜** 잡는다(mat.box / mat.plane) — box·plane의 UV는 면 크기와 무관하게 0~1이라
// repeat만 쓰면 5m 감방 벽과 84m 담장이 같은 횟수로 반복돼 긴 벽·큰 바닥이 늘어난다.
// 이 값을 키우면 무늬가 커지고, 줄이면 촘촘해진다.
// (값은 텍스처의 이음매 격자를 실측해서 잡았다 — 무늬 크기가 실제 치수로 그럴듯해야 한다)
const TILE = {
  concrete: 3, // 이음매가 타일당 3단 → 한 단 1m. 실내 벽 높이 3m가 정확히 1타일
  floor: 2.5, // 이음매가 타일당 2×2 → 슬래브 한 장 1.25m
  ground: 4, // 격자 없는 모래 노이즈(기존 100×76 ÷ 25×19 와 같은 밀도)
  wood: 1.2, // 널 결이 타일당 8줄 → 널 폭 15cm
  water: 2, // 배수로 물 자국
} as const;

function useMaterials() {
  const t = useTexture(TEX);
  return useMemo(() => {
    const mk = (color: string, roughness: number, metalness: number) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // 타일 반복 설정. albedo만 sRGB(법선맵은 기본 선형 유지). 넓은 면에 이음매 없이 깔린다.
    //   ⚠️ 각 소스 텍스처는 한 가지 repeat로만 쓰인다(공유해도 충돌 없음).
    //      월드 스케일 UV를 쓰는 재질은 repeat=1로 두고 TILE로 밀도를 정한다.
    const tile = (map: THREE.Texture, rx: number, ry: number, srgb = false) => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(rx, ry);
      map.anisotropy = 8; // 월드 스케일 UV라 반복이 늘어 스치는 각도에서 더 필요해졌다
      if (srgb) map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      return map;
    };

    // ── 월드 스케일 UV 지오메트리 ────────────────────────────────────
    // 면 크기 ÷ tile 만큼 UV를 늘려 둔다. 같은 치수는 캐시해 지오메트리를 공유한다.
    // (캐시는 이 useMemo 안에 있어 GameMap 수명과 함께 간다 — 전역에 남기지 않는다)
    const cache = new Map<string, THREE.BufferGeometry>();
    const box = (w: number, h: number, d: number, tileM: number) => {
      const key = `b|${w}|${h}|${d}|${tileM}`;
      let g = cache.get(key);
      if (!g) {
        g = new THREE.BoxGeometry(w, h, d);
        // BoxGeometry 정점 순서: +x, -x, +y, -y, +z, -z (면당 4개). 면마다 실제 크기가 다르다.
        const faces: [number, number][] = [
          [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
        ];
        const uv = g.attributes.uv as THREE.BufferAttribute;
        faces.forEach(([fw, fh], f) => {
          for (let i = f * 4; i < f * 4 + 4; i++) {
            uv.setXY(i, uv.getX(i) * (fw / tileM), uv.getY(i) * (fh / tileM));
          }
        });
        uv.needsUpdate = true;
        cache.set(key, g);
      }
      return g;
    };
    const plane = (w: number, h: number, tileM: number) => {
      const key = `p|${w}|${h}|${tileM}`;
      let g = cache.get(key);
      if (!g) {
        g = new THREE.PlaneGeometry(w, h);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) * (w / tileM), uv.getY(i) * (h / tileM));
        }
        uv.needsUpdate = true;
        cache.set(key, g);
      }
      return g;
    };
    // 텍스처 재질: albedo는 흰색 곱(텍스처 톤 그대로 노출), normalMap으로 요철.
    const mkTex = (
      map: THREE.Texture,
      normalMap: THREE.Texture,
      rx: number,
      ry: number,
      roughness: number,
      metalness: number,
    ) =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        map: tile(map, rx, ry, true),
        normalMap: tile(normalMap, rx, ry),
        roughness,
        metalness,
      });

    // 창살: 방 구분 색은 유지하고(map 안 물림) normalMap으로 금속 요철만 얹는다.
    const bar = (color: string) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.45,
        metalness: 0.6,
        normalMap: tile(t.steelN, 1, 2),
      });

    return {
      // ⚠️ 아래 월드 스케일 UV 재질(repeat=1)을 쓰는 mesh는 반드시 mat.box / mat.plane 로
      //    지오메트리를 만들 것. 그냥 <boxGeometry>를 쓰면 타일 하나가 면 전체로 늘어난다.
      box,
      plane,
      concrete: mkTex(t.concrete, t.concreteN, 1, 1, 0.95, 0), // → mat.box(.., TILE.concrete)
      steel: mkTex(t.steel, t.steelN, 1, 2, 0.4, 0.8), // 창살·기둥 등 가는 부재라 repeat 유지
      gateBlue: mkTex(t.gate, t.gateN, 2, 2, 0.45, 0.5), // 정문(파란 철문) — 문짝 크기 고정
      slab: mkTex(t.floorCell, t.floorCellN, 1, 1, 0.9, 0.05), // 2층 바닥·계단 → TILE.floor
      wood: mkTex(t.wood, t.woodN, 1, 1, 0.8, 0.05), // → TILE.wood
      water: mkTex(t.water, t.waterN, 1, 1, 0.15, 0.1), // → TILE.water
      ground: mkTex(t.floorYard, t.floorYardN, 1, 1, 1, 0), // 베이스 지면 → TILE.ground
      // 구역 바닥은 방별 색을 유지해야 해서 map 대신 normalMap만 얹는다(색 틴트 보존).
      floorN: tile(t.floorCellN, 1, 1),

      bunk: mk("#4a5568", 0.7, 0.1),
      porcelain: mk("#cbd5e1", 0.5, 0.05),
      table: mk("#8a9099", 0.6, 0.2),
      hoop: mk("#d9542b", 0.5, 0.3),
      rust: mk("#7a4a32", 0.9, 0.2),
      red: mk("#b4322a", 0.6, 0.2),
      paper: mk("#d8d4c8", 1, 0),
      ball: mk("#c96a2b", 0.85, 0),
      // 감방 철창 색(방마다 다르게 칠해 어느 방인지 한눈에 구분한다)
      barA: bar("#b1573e"), // 1-1 녹슨 주황
      barB: bar("#c9a23b"), // 1-2 노랑
      barC: bar("#4e9153"), // 1-3 초록
      barD: bar("#7b6ab8"), // 1-4 보라
      // 별관 문 철창 색(방 액센트와 같은 계열)
      barLaundry: bar("#5b83b8"), // 세탁실 파랑
      barWork: bar("#b8963b"), // 작업장 황토
      barMed: bar("#4fa08b"), // 의무실 청록
      woodWarm: mk("#7c5f3a", 0.75, 0.05), // 식당 식탁
      laundryBlue: mk("#7d97b8", 0.5, 0.3), // 세탁기 몸통
      mint: mk("#7fb8a5", 0.7, 0), // 의무실 담요
      // ── 장식(데코)용 ──
      wire: mk("#8a9099", 0.45, 0.7), // 담장 위 철조망
      pipe: mk("#6b7079", 0.5, 0.6), // 복도 배관
      lamp: new THREE.MeshStandardMaterial({
        color: "#fff4d6",
        emissive: "#ffcf7a",
        emissiveIntensity: 0.9,
        roughness: 0.4,
      }), // 매달린 램프·조명탑 렌즈(발광)
      paint: mk("#c9cdd4", 1, 0), // 바닥 페인트(흰)
      paintY: mk("#c4a13a", 1, 0), // 바닥 페인트(노랑 안전선)
      crate: mk("#6f5836", 0.85, 0), // 나무 상자
      silhouette: new THREE.MeshBasicMaterial({ color: "#0e1119" }), // 담장 밖 원경(불투명·무광)
    };
  }, [t]);
}

const cx = (b: Building) => (b.rect.x0 + b.rect.x1) / 2;
const cz = (b: Building) => (b.rect.z0 + b.rect.z1) / 2;

// ── 방향별 창살 문: 잠금 문(cell-*, door-*)을 개구부에 그린다. 풀면 경첩 회전으로 열린다. ──
// h: 문 높이(기본 WALL_H). 수감동 감방문은 벽(9m)·천장(2층 슬래브 4.5m)까지 비므로 h=FLOOR2_Y로
// 채워 문 위 빈공간을 없앤다.
function BarDoor({ meta, mat, h = WALL_H }: { meta: DoorMeta; mat: THREE.Material; h?: number }) {
  const [ax, az] = meta.at;
  const w = meta.width;
  const horizontal = meta.edge === "N" || meta.edge === "S";
  // 로컬 +x가 개구부를 따라가도록 그룹을 돌린다. 경첩은 개구부의 한쪽 끝.
  const baseRotY = horizontal ? 0 : -Math.PI / 2;
  const hinge: [number, number, number] = horizontal
    ? [ax - w / 2, 0, az]
    : [ax, 0, az - w / 2];
  const open = useInteraction((s) => isCellDoorOpen(meta.id, s.solved));
  const panel = useRef<THREE.Group>(null);
  const nBars = Math.max(3, Math.round(w / 0.55));

  useFrame((_, dt) => {
    if (!panel.current) return;
    const target = open ? -1.7 : 0; // 닫힘(0) ↔ 열림(안쪽으로 스윙)
    panel.current.rotation.y = THREE.MathUtils.damp(panel.current.rotation.y, target, 5, dt);
  });

  return (
    <group position={hinge} rotation={[0, baseRotY, 0]}>
      {/* 문틀 기둥 2개 */}
      <mesh position={[0, h / 2, 0]} material={mat}>
        <boxGeometry args={[0.16, h, 0.2]} />
      </mesh>
      <mesh position={[w, h / 2, 0]} material={mat}>
        <boxGeometry args={[0.16, h, 0.2]} />
      </mesh>
      {/* 문짝(경첩=원점 기준 회전) */}
      <group ref={panel}>
        <mesh position={[w / 2, h - 0.3, 0]} material={mat}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        <mesh position={[w / 2, 0.25, 0]} material={mat}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        {Array.from({ length: nBars }, (_, i) => {
          const bx = ((i + 0.5) / nBars) * w;
          return (
            <mesh key={i} position={[bx, (h - 0.05) / 2, 0]} material={mat}>
              <boxGeometry args={[BAR_W, h - 0.55, BAR_W]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ── 배수관 샛길 철창(표식 게이트): 동쪽 샛길(x38~42)을 가로막는 녹슨 창살 문. ──
// 표식 4개를 다 얻으면(isDrainGateOpen) 경첩 회전으로 열린다. 좌표는 prisonLayout.DRAIN_GATE와 같다.
function DrainGate({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const open = useInteraction((s) => isDrainGateOpen(s.solved));
  const panel = useRef<THREE.Group>(null);
  const w = DRAIN_GATE.hx * 2; // 개구부 폭(4m)
  const x0 = DRAIN_GATE.cx - DRAIN_GATE.hx; // 경첩(서쪽 끝, 건물 벽 쪽)
  const nBars = Math.max(3, Math.round(w / 0.55));
  useFrame((_, dt) => {
    if (!panel.current) return;
    const target = open ? -1.7 : 0; // 닫힘 ↔ 열림(남쪽 안으로 스윙)
    panel.current.rotation.y = THREE.MathUtils.damp(panel.current.rotation.y, target, 5, dt);
  });
  return (
    <group position={[x0, 0, DRAIN_GATE.cz]}>
      {/* 문틀 기둥 2 */}
      <mesh position={[0, WALL_H / 2, 0]} material={mat.rust}>
        <boxGeometry args={[0.18, WALL_H, 0.24]} />
      </mesh>
      <mesh position={[w, WALL_H / 2, 0]} material={mat.rust}>
        <boxGeometry args={[0.18, WALL_H, 0.24]} />
      </mesh>
      {/* 창살 문짝(경첩=원점 기준 회전) */}
      <group ref={panel}>
        <mesh position={[w / 2, WALL_H - 0.3, 0]} material={mat.rust}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        <mesh position={[w / 2, 0.25, 0]} material={mat.rust}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        {Array.from({ length: nBars }, (_, i) => (
          <mesh key={i} position={[((i + 0.5) / nBars) * w, (WALL_H - 0.3) / 2, 0]} material={mat.rust}>
            <boxGeometry args={[BAR_W, WALL_H - 0.5, BAR_W]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// 문 id → 창살 색(감방·별관 방마다 다른 색으로 한눈에 구분). 나머지는 무채색 철재.
function barMatFor(mat: ReturnType<typeof useMaterials>, id: string): THREE.Material {
  switch (id) {
    case "cell-A": return mat.barA;
    case "cell-B": return mat.barB;
    case "cell-C": return mat.barC;
    case "cell-D": return mat.barD;
    case "door-laundry": return mat.barLaundry;
    case "door-work": return mat.barWork;
    case "door-med": return mat.barMed;
    default: return mat.steel;
  }
}

// ── 식당 문: 감옥 창살이 아니라 진짜 식당 양여닫이 문(솔리드 패널 + 둥근 유리창). 풀면 안쪽으로 열린다. ──
function CafeteriaDoor({ meta, mat }: { meta: DoorMeta; mat: ReturnType<typeof useMaterials> }) {
  const [ax, az] = meta.at;
  const w = meta.width;
  const horizontal = meta.edge === "N" || meta.edge === "S";
  const baseRotY = horizontal ? 0 : -Math.PI / 2;
  const open = useInteraction((s) => isCellDoorOpen(meta.id, s.solved));
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const leaf = w / 2;
  useFrame((_, dt) => {
    // 두 문짝이 식당 안쪽(+z)으로 활짝 열린다.
    if (left.current)
      left.current.rotation.y = THREE.MathUtils.damp(left.current.rotation.y, open ? -1.6 : 0, 5, dt);
    if (right.current)
      right.current.rotation.y = THREE.MathUtils.damp(right.current.rotation.y, open ? 1.6 : 0, 5, dt);
  });
  return (
    <group position={[ax, 0, az]} rotation={[0, baseRotY, 0]}>
      {/* 문틀(양 기둥 + 상인방) */}
      <mesh position={[-w / 2, WALL_H / 2, 0]} material={mat.steel}>
        <boxGeometry args={[0.18, WALL_H, 0.34]} />
      </mesh>
      <mesh position={[w / 2, WALL_H / 2, 0]} material={mat.steel}>
        <boxGeometry args={[0.18, WALL_H, 0.34]} />
      </mesh>
      <mesh position={[0, WALL_H - 0.12, 0]} material={mat.steel}>
        <boxGeometry args={[w, 0.24, 0.34]} />
      </mesh>
      {/* 좌 문짝(경첩=왼쪽 끝) / 우 문짝(경첩=오른쪽 끝) */}
      <group ref={left} position={[-w / 2, 0, 0]}>
        <CafeLeaf dir={leaf} mat={mat} />
      </group>
      <group ref={right} position={[w / 2, 0, 0]}>
        <CafeLeaf dir={-leaf} mat={mat} />
      </group>
    </group>
  );
}

// 식당 문짝 한 짝: 경첩(로컬 원점)에서 dir(±) 방향으로 뻗는 솔리드 패널 + 둥근 유리창 + 손잡이.
// 유리창·손잡이는 안팎(±z) 양면에 똑같이 둔다 — 복도에서 보는 바깥면도 식당 안쪽면과 같게 통일.
function CafeLeaf({ dir, mat }: { dir: number; mat: ReturnType<typeof useMaterials> }) {
  const w = Math.abs(dir) - 0.06; // 두 짝 사이 틈
  const cxp = dir / 2;
  return (
    <group>
      <mesh position={[cxp, WALL_H / 2 - 0.05, 0]} material={mat.porcelain} castShadow receiveShadow>
        <boxGeometry args={[w, WALL_H - 0.3, 0.1]} />
      </mesh>
      {/* 둥근 유리창(어두운 인셋) — 안팎 양면 */}
      {[0.06, -0.06].map((zz, i) => (
        <mesh key={i} position={[cxp, WALL_H - 0.85, zz]} rotation={[Math.PI / 2, 0, 0]} material={mat.steel}>
          <cylinderGeometry args={[0.26, 0.26, 0.04, 20]} />
        </mesh>
      ))}
      {/* 손잡이(맞닿는 안쪽 끝) — 안팎 양면 */}
      {[0.09, -0.09].map((zz, i) => (
        <mesh key={i} position={[dir - Math.sign(dir) * 0.15, 1.05, zz]} material={mat.steel}>
          <boxGeometry args={[0.05, 0.5, 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 2층 테라스 난간(x축 또는 z축 직선): 손잡이 두 단 + 발끝판 + 기둥.
// 충돌은 OBSTACLES(y 3~99)가 담당 — 여기는 같은 자리를 그리기만 한다. ──
function TerraceRail({ x0, z0, x1, z1, mat }: { x0: number; z0: number; x1: number; z1: number; mat: THREE.Material }) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const rotY = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 0 : Math.PI / 2;
  const railH = 1.1;
  const nPosts = Math.max(2, Math.round(len / 1.6) + 1);
  return (
    <group position={[(x0 + x1) / 2, FLOOR2_Y, (z0 + z1) / 2]} rotation={[0, rotY, 0]}>
      {[0.55, railH].map((ry, i) => (
        <mesh key={i} position={[0, ry, 0]} material={mat} castShadow>
          <boxGeometry args={[len, 0.07, 0.07]} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 0]} material={mat}>
        <boxGeometry args={[len, 0.2, 0.04]} />
      </mesh>
      {Array.from({ length: nPosts }, (_, i) => (
        <mesh key={i} position={[-len / 2 + (i / (nPosts - 1)) * len, railH / 2, 0]} material={mat}>
          <boxGeometry args={[0.07, railH, 0.07]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 2층 감방 입구의 활짝 열린 철창 문(시각 전용, 방 색깔): 잠금(DOOR_BOXES)은 1층에서만
// 유효하고 문 개구부는 전 높이로 뚫려 있다 — 2층 감방은 "철창은 있지만 늘 열린" 방이다. ──
function OpenCellGate({ meta, mat }: { meta: DoorMeta; mat: THREE.Material }) {
  const [ax, az] = meta.at;
  const w = meta.width;
  // 경첩은 개구부 서쪽 끝. 문짝은 감방 안쪽으로 젖혀 둔다(S면 문=북측 감방 → +z, N면 → -z).
  const swing = meta.edge === "S" ? -2.1 : 2.1;
  const nBars = Math.max(3, Math.round(w / 0.55));
  return (
    <group position={[ax - w / 2, FLOOR2_Y, az]}>
      {[0, w].map((dx, i) => (
        <mesh key={i} position={[dx, WALL_H / 2, 0]} material={mat}>
          <boxGeometry args={[0.16, WALL_H, 0.2]} />
        </mesh>
      ))}
      <group rotation={[0, swing, 0]}>
        {[WALL_H - 0.3, 0.25].map((y, i) => (
          <mesh key={i} position={[w / 2, y, 0]} material={mat}>
            <boxGeometry args={[w, 0.1, 0.1]} />
          </mesh>
        ))}
        {Array.from({ length: nBars }, (_, i) => (
          <mesh key={i} position={[((i + 0.5) / nBars) * w, (WALL_H - 0.3) / 2, 0]} material={mat}>
            <boxGeometry args={[BAR_W, WALL_H - 0.5, BAR_W]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── 수감동 2층(복도 서쪽 끝의 중앙 계단으로 올라간다) ──────────────
// 바닥·계단의 **충돌/높이**는 prisonLayout(SLAB2·STAIR·OBSTACLES·groundHeightAt)이 담당하고,
// 여기는 같은 좌표를 3D로 그리기만 한다. 막다른 벽을 향해 오르면 꼭대기 랜딩에서 좌우(남·북)
// 테라스로 복도가 갈라지고, 가운데 아트리움 개구부 너머로 1층 복도가 내려다보인다.
// 1층 감방 벽(h=9)이 그대로 2층 칸막이가 되고, 입구엔 방 색깔의 활짝 열린 철창 문이 서 있다.
function SecondFloor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const nSteps = 15;
  const run = (STAIR.x1 - STAIR.x0) / nSteps;
  const stairW = STAIR.z1 - STAIR.z0;
  const stairZ = (STAIR.z0 + STAIR.z1) / 2;
  const railH = 1.1;
  const slopeLen = Math.hypot(STAIR.x1 - STAIR.x0, FLOOR2_Y); // 계단 경사 길이
  const slopeAng = Math.atan2(FLOOR2_Y, STAIR.x0 - STAIR.x1); // 동→서로 오르는 기울기
  return (
    <group>
      {/* 2층 바닥 슬래브(감방 열 + 테라스 복도 + 랜딩) — SLAB2와 같은 사각형 */}
      {SLAB2.map((r, i) => (
        <mesh
          key={i}
          position={[(r.x0 + r.x1) / 2, FLOOR2_Y, (r.z0 + r.z1) / 2]}
          geometry={mat.box(r.x1 - r.x0, 0.16, r.z1 - r.z0, TILE.floor)}
          material={mat.slab}
          castShadow
          receiveShadow
        />
      ))}
      {/* 계단(복도 정중앙, 동쪽에서 올라 서쪽 랜딩으로) — 높이는 STAIR 램프와 같은 기울기 */}
      {Array.from({ length: nSteps }, (_, i) => {
        const h = ((i + 1) / nSteps) * FLOOR2_Y;
        return (
          <mesh
            key={i}
            position={[STAIR.x1 - (i + 0.5) * run, h / 2, stairZ]}
            geometry={mat.box(run, h, stairW, TILE.floor)}
            material={mat.slab}
            castShadow
            receiveShadow
          />
        );
      })}
      {/* 계단 양측 난간(경사 손잡이 + 기둥). 충돌은 OBSTACLES의 전 높이 난간벽이 담당 */}
      {[STAIR.z0, STAIR.z1].map((rz, side) => (
        <group key={side}>
          {[0.55, railH].map((ry, i) => (
            <mesh
              key={i}
              position={[(STAIR.x0 + STAIR.x1) / 2, FLOOR2_Y / 2 + ry, rz]}
              rotation={[0, 0, slopeAng]}
              material={mat.steel}
              castShadow
            >
              <boxGeometry args={[slopeLen, 0.07, 0.07]} />
            </mesh>
          ))}
          {Array.from({ length: 6 }, (_, i) => {
            const px = STAIR.x1 - ((i + 0.5) / 6) * (STAIR.x1 - STAIR.x0);
            const base = (FLOOR2_Y * (STAIR.x1 - px)) / (STAIR.x1 - STAIR.x0);
            return (
              <mesh key={i} position={[px, base + railH / 2, rz]} material={mat.steel}>
                <boxGeometry args={[0.07, railH, 0.07]} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* 테라스 난간(아트리움 가장자리, 계단 동쪽) — OBSTACLES의 2층 난간과 같은 자리 */}
      <TerraceRail x0={STAIR.x1} z0={STAIR.z0} x1={-6} z1={STAIR.z0} mat={mat.steel} />
      <TerraceRail x0={STAIR.x1} z0={STAIR.z1} x1={-6} z1={STAIR.z1} mat={mat.steel} />
      {/* 2층 복도 동측 막이(1층 연결 복도 아치 위) — OBSTACLES의 막이와 같은 자리 */}
      <mesh
        position={[-6, (WALL_H + CELL_BLOCK_H) / 2, 17]}
        geometry={mat.box(0.4, CELL_BLOCK_H - WALL_H, 6.4, TILE.concrete)}
        material={mat.concrete}
        castShadow
      />
      {/* 2층 감방 입구: 방 색깔의 활짝 열린 철창 문 */}
      {DOOR_META.filter((d) => d.id.startsWith("cell-")).map((d) => (
        <OpenCellGate key={d.id} meta={d} mat={mat.steel} />
      ))}
    </group>
  );
}

// ── 화장실(연결 복도 북측): 변기 3 + 칸막이 + 세면대 ──────────────
function ToiletDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const tz = b.rect.z1 - 1.2;
  return (
    <group>
      {/* 변기 3개: 감방 화장실과 같은 모양(절차적 Toilet). 물탱크가 북벽(+z) 쪽을 향하게 rotationY=0. */}
      {[-3.5, 0, 3.5].map((tx, i) => (
        <Toilet key={i} position={[tx, 0, tz]} rotationY={0} />
      ))}
      {[-1.75, 1.75].map((dx, i) => (
        <mesh key={i} position={[dx, 0.8, tz]} material={mat.table} castShadow>
          <boxGeometry args={[0.08, 1.6, 1.6]} />
        </mesh>
      ))}
      {/* 세면대(서쪽 벽 앞) */}
      <mesh position={[b.rect.x0 + 0.6, 0.45, 22.5]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.9, 3]} />
      </mesh>
      {[21.6, 23.4].map((sz, i) => (
        <mesh key={i} position={[b.rect.x0 + 0.6, 0.96, sz]} material={mat.porcelain}>
          <cylinderGeometry args={[0.18, 0.2, 0.12, 12]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 연병장(남쪽 절반, 모래): 실제 교도소처럼 황량한 맨 마당. 남서 구석의 벤치 셋과
// 농구골대(이스터에그)만 남긴다 — 트랙·연단·깃대 같은 장식은 없다 ──
function YardBench({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      <mesh
        position={[0, 0.45, 0]}
        geometry={mat.box(4, 0.14, 0.7, TILE.wood)}
        material={mat.wood}
        castShadow
        receiveShadow
      />
      {[-1.6, 1.6].map((dx, i) => (
        <mesh key={i} position={[dx, 0.22, 0]} material={mat.steel} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

// 실제 농구 코트 라인을 캔버스에 그린다(아웃도어 블루 바닥 + 흰 라인 + 페인트존).
// 좌표는 미터(코트 중앙 원점, x=길이 ±13, z=폭 ±7)로 잡고 픽셀로 변환한다.
function makeCourtTexture(): THREE.CanvasTexture {
  const PX = 60; // px/m
  const CW = Math.round(COURT.length * PX);
  const CH = Math.round(COURT.width * PX);
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const g = c.getContext("2d")!;
  const M = PX;
  const toX = (mx: number) => CW / 2 + mx * M;
  const toY = (mz: number) => CH / 2 + mz * M;
  const halfL = COURT.length / 2;
  const halfW = COURT.width / 2;
  // 규격(28×15) 대비 축소 코트라 라인·존을 코트 크기에 맞춰 비율 스케일한다(작아도 3점 코너가 코트 안).
  const s = Math.min(COURT.length / 28, COURT.width / 15);
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    g.beginPath();
    g.moveTo(toX(x0), toY(z0));
    g.lineTo(toX(x1), toY(z1));
    g.stroke();
  };
  const rect = (mx: number, mz: number, w: number, h: number) =>
    g.strokeRect(toX(mx), toY(mz), w * M, h * M);
  const circle = (mx: number, mz: number, r: number) => {
    g.beginPath();
    g.arc(toX(mx), toY(mz), r * M, 0, Math.PI * 2);
    g.stroke();
  };

  // 바닥(아웃도어 블루)
  g.fillStyle = "#1c6ea4";
  g.fillRect(0, 0, CW, CH);
  g.strokeStyle = "#f2f4f5";
  g.lineWidth = 0.06 * M;
  g.lineJoin = "round";

  const m = 0.15; // 라인 안쪽 여백
  rect(-halfL + m, -halfW + m, 2 * (halfL - m), 2 * (halfW - m)); // 외곽선
  line(0, -halfW + m, 0, halfW - m); // 센터 라인
  circle(0, 0, 1.8 * s); // 센터 서클

  for (const dir of [-1, 1]) {
    const baseX = dir * (halfL - m);
    const keyLen = 5.8 * s;
    const keyHW = 2.45 * s;
    const innerX = baseX - dir * keyLen;
    // 페인트존(키) 채움 + 외곽
    g.fillStyle = "#17527a";
    g.fillRect(toX(Math.min(baseX, innerX)), toY(-keyHW), keyLen * M, 2 * keyHW * M);
    rect(Math.min(baseX, innerX), -keyHW, keyLen, 2 * keyHW);
    circle(innerX, 0, 1.8 * s); // 자유투 서클

    // 3점 라인: 림(baseX - dir*1.575) 중심 반지름 6.75, 코너는 직선 + 아크 (모두 s배 축소)
    const hoopX = baseX - dir * 1.575 * s;
    const R = 6.75 * s;
    const cz = 6.6 * s;
    const dx = Math.sqrt(R * R - cz * cz);
    const interior = -dir;
    const meetX = hoopX + interior * dx;
    line(baseX, -cz, meetX, -cz);
    line(baseX, cz, meetX, cz);
    const a = Math.atan2(cz, dx);
    g.beginPath();
    if (dir === -1) g.arc(toX(hoopX), toY(0), R * M, -a, a);
    else g.arc(toX(hoopX), toY(0), R * M, Math.PI - a, Math.PI + a);
    g.stroke();

    // 백보드/림 표시 라인
    line(baseX - interior * 1.2 * s, -0.9 * s, baseX - interior * 1.2 * s, 0.9 * s);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 농구 코트 바닥(캔버스 텍스처를 얹은 평면). 모래 바닥 위(y=0.02)에 깐다.
function BasketballCourt() {
  const tex = useMemo(() => (typeof document !== "undefined" ? makeCourtTexture() : null), []);
  if (!tex) return null;
  // 긴 축(length)을 z 방향으로 세우려고 그룹을 90° 요(yaw)한다. 코트는 z로 length, x로 width.
  return (
    <group position={[COURT.cx, 0.02, COURT.cz]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[COURT.length, COURT.width]} />
        <meshStandardMaterial map={tex} roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

// 러닝 트랙(스타디움형 오벌) 텍스처: 트랙 노면 밴드 + 흰 레인 라인. 밴드 밖은 투명(모래가 비친다).
// 좌표는 트랙 중심 원점, 미터→픽셀. OX=바깥 x반경, OZ=바깥 z반경, SH=직선 구간 반길이, BAND=트랙 폭.
const TRACK = { cx: 6, cz: -12, ox: 34, oz: 15, sh: 19, band: 4 };
function makeTrackTexture(): THREE.CanvasTexture {
  const PX = 20;
  const CW = Math.round(TRACK.ox * 2 * PX);
  const CH = Math.round(TRACK.oz * 2 * PX);
  const c = document.createElement("canvas");
  c.width = CW;
  c.height = CH;
  const g = c.getContext("2d")!;
  const ccx = CW / 2;
  const ccy = CH / 2;
  // 스타디움 경로(직선 2 + 반원 2). sh=직선 반길이(px), r=반원 반지름(px).
  const stad = (sh: number, r: number) => {
    g.beginPath();
    g.moveTo(ccx - sh, ccy - r);
    g.lineTo(ccx + sh, ccy - r);
    g.arc(ccx + sh, ccy, r, -Math.PI / 2, Math.PI / 2, false);
    g.lineTo(ccx - sh, ccy + r);
    g.arc(ccx - sh, ccy, r, Math.PI / 2, (3 * Math.PI) / 2, false);
    g.closePath();
  };
  g.clearRect(0, 0, CW, CH);
  // 트랙 노면(붉은 우레탄)
  g.fillStyle = "#b5522f";
  stad(TRACK.sh * PX, TRACK.oz * PX);
  g.fill();
  // 안쪽(인필드)은 투명 — 모래 바닥이 비친다
  g.globalCompositeOperation = "destination-out";
  stad(TRACK.sh * PX, (TRACK.oz - TRACK.band) * PX);
  g.fill();
  g.globalCompositeOperation = "source-over";
  // 레인 라인(흰색): 안쪽~바깥 5줄(4레인)
  g.strokeStyle = "#f0f0f0";
  g.lineWidth = 0.1 * PX;
  for (let k = 0; k <= TRACK.band; k++) {
    stad(TRACK.sh * PX, (TRACK.oz - TRACK.band + k) * PX);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 러닝 트랙 바닥(연병장 동편, 농구 코트를 피해 배치). 밴드 밖은 투명이라 모래가 그대로 보인다.
function RunningTrack() {
  const tex = useMemo(() => (typeof document !== "undefined" ? makeTrackTexture() : null), []);
  if (!tex) return null;
  return (
    <mesh position={[TRACK.cx, 0.02, TRACK.cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[TRACK.ox * 2, TRACK.oz * 2]} />
      <meshStandardMaterial map={tex} transparent roughness={0.95} metalness={0} />
    </mesh>
  );
}

// 연병장 담장 밑 잡초(크기·간격 제각각). 시드 PRNG로 위치·크기·블레이드를 한 번만 정해 고정한다
// (Math.random이면 리렌더마다 흔들리고 SSR과도 어긋난다). 정문 개구부·농구코트 구간은 건너뛴다.
type WeedBlade = { dx: number; dz: number; h: number; tx: number; tz: number; ry: number; c: string };
type WeedClump = { x: number; z: number; sc: number; blades: WeedBlade[] };
function YardWeeds() {
  const clumps = useMemo<WeedClump[]>(() => {
    let s = 0x9e3779b9 >>> 0;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const GREENS = ["#3f5e25", "#4a6b2a", "#5c7d33", "#6b8e3a", "#557a2e"];
    const out: WeedClump[] = [];
    const addRun = (from: number, to: number, fixed: number, axis: "x" | "z") => {
      let p = from;
      for (;;) {
        p += 2.2 + rng() * 3.2; // 제각각 간격
        if (p > to) break;
        const off = (rng() - 0.5) * 0.6; // 벽에서 살짝 안쪽 지터
        const x = axis === "x" ? p : fixed + off;
        const z = axis === "x" ? fixed + off : p;
        const sc = 0.5 + rng() * 1.0; // 제각각 크기
        const n = 4 + Math.floor(rng() * 4);
        const blades: WeedBlade[] = [];
        for (let i = 0; i < n; i++) {
          blades.push({
            dx: (rng() - 0.5) * 0.35,
            dz: (rng() - 0.5) * 0.35,
            h: 0.3 + rng() * 0.7,
            tx: (rng() - 0.5) * 0.5,
            tz: (rng() - 0.5) * 0.5,
            ry: rng() * Math.PI,
            c: GREENS[Math.floor(rng() * GREENS.length)],
          });
        }
        out.push({ x, z, sc, blades });
      }
    };
    // 남벽(z-30, 안쪽 z-29.4) — 정문 개구부(x-6..6) 건너뜀
    addRun(-40, -7, -29.4, "x");
    addRun(7, 40, -29.4, "x");
    // 서벽(x-42, 안쪽 x-41.4) — 농구코트(z-16..4) 건너뜀
    addRun(-29, -17, -41.4, "z");
    // 동벽(x42, 안쪽 x41.4)
    addRun(-29, 4.5, 41.4, "z");
    return out;
  }, []);
  return (
    <group>
      {clumps.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} scale={c.sc}>
          {c.blades.map((b, j) => (
            <mesh key={j} position={[b.dx, b.h / 2, b.dz]} rotation={[b.tx, b.ry, b.tz]} castShadow>
              <coneGeometry args={[0.03, b.h, 5]} />
              <meshStandardMaterial color={b.c} roughness={0.9} flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function ParadeDecor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      {/* 담장 밑 잡초(제각각) */}
      <YardWeeds />
      {/* 연병장 동편 러닝 트랙(코트를 피한 오벌) */}
      <RunningTrack />
      {/* 남서 코너 벤치 앞 농구 코트(바닥 라인) */}
      <BasketballCourt />
      {/* 농구골대 — 코트 남쪽 베이스라인(COURT.hoop). rotationY=π/2로 코트 안쪽(+z 북)을 향한다.
          Basketball의 RIM(COURT.rim = 그룹 z+0.75)과 맞는다. */}
      <group position={COURT.hoop} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.5, 0]} material={mat.steel} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 3, 12]} />
        </mesh>
        <mesh position={[-0.4, 3, 0]} material={mat.steel} castShadow>
          <boxGeometry args={[0.1, 1.1, 1.8]} />
        </mesh>
        <mesh position={[-0.75, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={mat.hoop}>
          <torusGeometry args={[0.34, 0.04, 8, 20]} />
        </mesh>
      </group>
      <Basketball mat={mat.ball} />
      {/* 남서 구석 벤치 셋(담장 밑) — OBSTACLES의 벤치와 같은 자리 */}
      <group position={[-37, 0, -29.2]}>
        <YardBench mat={mat} />
      </group>
      <group position={[-31, 0, -29.2]}>
        <YardBench mat={mat} />
      </group>
      <group position={[-41.3, 0, -25]} rotation={[0, Math.PI / 2, 0]}>
        <YardBench mat={mat} />
      </group>
    </group>
  );
}

// ── 감시탑(맵 네 모서리, 담장 위). 시각 전용 ───────────────────────
function Watchtower({ at, mat }: { at: [number, number]; mat: ReturnType<typeof useMaterials> }) {
  return (
    <group position={[at[0], 0, at[1]]}>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * 1.2, 3.5, sz * 1.2]} material={mat.steel} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 7, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 7.1, 0]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.2, 3.4]} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * 1.55, 7.85, sz * 1.55]} material={mat.steel}>
          <boxGeometry args={[0.08, 1.5, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 8.6, 0]} material={mat.steel} castShadow>
        <boxGeometry args={[3.8, 0.15, 3.8]} />
      </mesh>
    </group>
  );
}

// ── 수감동↔복도 철창 게이트: 개구부(x=-6, z14~20)를 철창으로 막고 가운데 2m만 작은 문. ──
// 문은 E로 여닫는다(서버 openDoors가 권위 — LocalPlayer가 sendDoor로 토글). 양옆 철창벽은
// 상시 실체(prisonLayout OBSTACLES / 서버 Collision.OBSTACLES). ⚠️ 좌표는 CELLBLOCK_GATE와 맞춘다.
function CellBlockGate({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const steel = mat.steel;
  const open = useInteraction((s) => !!s.serverDoors[CELLBLOCK_GATE.id]);
  const near = useInteraction((s) => s.nearId === CELLBLOCK_GATE.id);
  const panel = useRef<THREE.Group>(null);
  const h = CELLBLOCK_GATE.h; // 3
  const cz = (CELLBLOCK_GATE.doorZ0 + CELLBLOCK_GATE.doorZ1) / 2; // 17 (문 중심)
  const doorW = CELLBLOCK_GATE.doorZ1 - CELLBLOCK_GATE.doorZ0; // 2
  const barY = (h - 0.05) / 2;
  const barH = h - 0.55;
  // 고정 철창벽 한 구간(로컬 z0~z1): 위·아래 가로 레일 + 세로 살.
  const seg = (z0: number, z1: number, key: string) => {
    const n = Math.max(2, Math.round((z1 - z0) / 0.34));
    return (
      <group key={key}>
        {[h - 0.3, 0.25].map((y, i) => (
          <mesh key={i} position={[0, y, (z0 + z1) / 2]} material={steel}>
            <boxGeometry args={[0.1, 0.1, z1 - z0]} />
          </mesh>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <mesh key={i} position={[0, barY, z0 + ((i + 0.5) / n) * (z1 - z0)]} material={steel}>
            <boxGeometry args={[BAR_W, barH, BAR_W]} />
          </mesh>
        ))}
      </group>
    );
  };
  useFrame((_, dt) => {
    if (!panel.current) return;
    const target = open ? -1.7 : 0; // 닫힘(개구부를 메움) ↔ 열림(복도 쪽으로 스윙)
    panel.current.rotation.y = THREE.MathUtils.damp(panel.current.rotation.y, target, 6, dt);
  });
  const nBars = Math.max(3, Math.round(doorW / 0.4));
  return (
    <group position={[CELLBLOCK_GATE.cx, 0, cz]}>
      {/* 문틀 기둥: 개구부 양끝(z14/z20) + 문 양옆(z16/z18) */}
      {[-3, -1, 1, 3].map((dz, i) => (
        <mesh key={i} position={[0, h / 2, dz]} material={steel}>
          <boxGeometry args={[0.16, h, 0.18]} />
        </mesh>
      ))}
      {/* 상인방(개구부 위 가로) */}
      <mesh position={[0, h - 0.08, 0]} material={steel}>
        <boxGeometry args={[0.12, 0.16, 6]} />
      </mesh>
      {/* 고정 철창벽(문 gap 양옆) */}
      {seg(-3, -1, "s")}
      {seg(1, 3, "n")}
      {/* 작은 문(경첩=문 남쪽 기둥 z=16, 로컬 +x가 +z를 향하게 -90°) */}
      <group position={[0, 0, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <group ref={panel}>
          {[h - 0.3, 0.25].map((y, i) => (
            <mesh key={i} position={[doorW / 2, y, 0]} material={steel}>
              <boxGeometry args={[doorW, 0.1, 0.1]} />
            </mesh>
          ))}
          {Array.from({ length: nBars }, (_, i) => (
            <mesh key={i} position={[((i + 0.5) / nBars) * doorW, barY, 0]} material={steel}>
              <boxGeometry args={[BAR_W, barH, BAR_W]} />
            </mesh>
          ))}
        </group>
      </group>
      {near && (
        <Html center distanceFactor={10} position={[0, 2.0, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {open ? "[E] 철창문 닫기" : "[E] 철창문 열기"}
          </div>
        </Html>
      )}
    </group>
  );
}

// ── 식당 내부: 좌측(서쪽) 냉장고 + 그 옆으로 길게 이어진 배식대(북벽) + 식탁 2열×3(총 6). ──
// 전부 절차적으로 그린다(OBJ 식당 세트·캔틴 식탁·잡소품은 PrisonProps에서 뺐다 — 이 배치가 대체).
// 냉장고·배식대는 충돌이 있고(prisonLayout/Collision OBSTACLES와 같은 자리), 식탁은 시각 전용이다.
function CafeteriaDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const { z0, z1 } = b.rect; // z0=20, z1=28
  const partX = 18; // 조리실 분리벽 x(식당 동쪽 1/4을 조리실로 가른다)
  const doorZ0 = 26.4; // 조리실 출입구(북쪽 끝) 시작 z — 여기부터 z1까지가 문
  const cZ0 = z0 + 0.2; // 배식대/유리창 z 구간(20.2 ~ 문 앞)
  const cZ1 = doorZ0 - 0.1;
  const cCz = (cZ0 + cZ1) / 2;
  const cLen = cZ1 - cZ0;
  const cTop = 1.05; // 배식대 상판 높이
  const gY0 = 1.35; // 유리창 아래
  const gY1 = 2.6; // 유리창 위
  const gCy = (gY0 + gY1) / 2;
  const gH = gY1 - gY0;
  // 식탁: 서편 2열 × 3행(동편은 배식 줄·조리실). prisonLayout/Collision OBSTACLES와 같은 자리.
  const cols = [8.5, 11.5];
  const rows = [22, 24, 26];
  // 식판(배식) 통 3칸 색
  const foodCol = ["#c7772e", "#6f8f3a", "#b8442e"];
  return (
    <group>
      {/* ── 조리실 분리벽(x=18): 하부 배식대(솔리드) + 상부 유리창 + 북끝 출입구 ── */}
      {/* 배식대(스테인리스) — 유리창 아래로 음식을 내주는 카운터 */}
      <group position={[partX, 0, cCz]}>
        <mesh position={[0, cTop / 2, 0]} material={mat.steel} castShadow receiveShadow>
          <boxGeometry args={[0.7, cTop, cLen]} />
        </mesh>
        {/* 상판 앞(식당 쪽) 트레이 레일 */}
        <mesh position={[-0.34, cTop + 0.02, 0]} material={mat.steel}>
          <boxGeometry args={[0.06, 0.06, cLen]} />
        </mesh>
        {/* 배식 음식통 3칸(따뜻한 색) — 조리실 쪽(뒤, +x)으로 물려 식판 놓을 앞자리를 비운다 */}
        {[-cLen / 3.5, 0, cLen / 3.5].map((dz, i) => (
          <group key={i} position={[0.15, cTop + 0.04, dz]}>
            <mesh material={mat.steel}>
              <boxGeometry args={[0.4, 0.08, 0.9]} />
            </mesh>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.32, 0.06, 0.82]} />
              <meshStandardMaterial color={foodCol[i]} roughness={0.85} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 상부 유리창(반투명 — 뒤 조리실이 비친다) + 스테인리스 프레임 */}
      <group position={[partX, gCy, cCz]}>
        <mesh>
          <boxGeometry args={[0.05, gH, cLen]} />
          <meshStandardMaterial color="#bcd6e8" transparent opacity={0.16} roughness={0.08} metalness={0.2} />
        </mesh>
        {[gH / 2 + 0.05, -gH / 2 - 0.05].map((dy, i) => (
          <mesh key={i} position={[0, dy, 0]} material={mat.steel}>
            <boxGeometry args={[0.16, 0.1, cLen + 0.2]} />
          </mesh>
        ))}
        {[-cLen / 6, cLen / 6].map((dz, i) => (
          <mesh key={i} position={[0, 0, dz]} material={mat.steel}>
            <boxGeometry args={[0.12, gH, 0.06]} />
          </mesh>
        ))}
      </group>

      {/* 유리창 위 헤더(천장까지 콘크리트) */}
      <mesh position={[partX, (gY1 + WALL_H) / 2 + 0.05, cCz]} material={mat.concrete}>
        <boxGeometry args={[0.4, WALL_H - gY1 - 0.1, cLen + 0.2]} />
      </mesh>

      {/* 조리실 출입구(북끝) 문틀: 남쪽 기둥 + 상인방 */}
      <mesh position={[partX, WALL_H / 2, doorZ0]} material={mat.steel}>
        <boxGeometry args={[0.34, WALL_H, 0.16]} />
      </mesh>
      <mesh position={[partX, WALL_H - 0.15, (doorZ0 + z1) / 2]} material={mat.steel}>
        <boxGeometry args={[0.34, 0.3, z1 - doorZ0]} />
      </mesh>

      {/* ── 조리실 내부(x 18~22) ── */}
      {/* 냉장고(2도어, 북벽 앞, 남향) — 냉장고 게임(lock-fridge)이 이 앞에 선다 */}
      <group position={[20.6, 0, z1 - 0.6]}>
        <mesh position={[0, 1.05, 0]} material={mat.porcelain} castShadow receiveShadow>
          <boxGeometry args={[1.1, 2.1, 0.8]} />
        </mesh>
        <mesh position={[0, 1.05, -0.41]} material={mat.steel}>
          <boxGeometry args={[1.0, 0.04, 0.02]} />
        </mesh>
        {[1.5, 0.6].map((hy) => (
          <mesh key={hy} position={[0.4, hy, -0.42]} material={mat.steel}>
            <boxGeometry args={[0.06, 0.5, 0.06]} />
          </mesh>
        ))}
      </group>
      {/* 조리대(동벽 x22 앞) + 레인지 후드 */}
      <group position={[21.3, 0, 23]}>
        <mesh position={[0, 0.5, 0]} material={mat.steel} castShadow receiveShadow>
          <boxGeometry args={[0.7, 1.0, 3.2]} />
        </mesh>
        <mesh position={[0, 2.3, 0]} material={mat.steel}>
          <boxGeometry args={[0.7, 0.4, 1.6]} />
        </mesh>
      </group>
      {/* 조리실 따뜻한 조명 */}
      <mesh position={[20, 2.85, 24]} material={mat.lamp}>
        <boxGeometry args={[2.6, 0.08, 0.5]} />
      </mesh>

      {/* ── 식탁 6개(서편 2열 × 3행) + 벤치 2. 충돌은 OBSTACLES가 담당. ── */}
      {rows.map((tz) =>
        cols.map((tx) => (
          <group key={`${tx}-${tz}`} position={[tx, 0, tz]}>
            <mesh position={[0, 0.74, 0]} material={mat.woodWarm} castShadow receiveShadow>
              <boxGeometry args={[2.0, 0.1, 0.9]} />
            </mesh>
            {[
              [-0.9, -0.35],
              [0.9, -0.35],
              [-0.9, 0.35],
              [0.9, 0.35],
            ].map(([dx, dz], i) => (
              <mesh key={i} position={[dx, 0.37, dz]} material={mat.steel}>
                <boxGeometry args={[0.08, 0.74, 0.08]} />
              </mesh>
            ))}
            {[-0.7, 0.7].map((bz, i) => (
              <mesh key={i} position={[0, 0.42, bz]} material={mat.wood} castShadow receiveShadow>
                <boxGeometry args={[1.8, 0.1, 0.32]} />
              </mesh>
            ))}
          </group>
        )),
      )}
    </group>
  );
}

// ── 작업장: 작업대 + 공구판 + 상자 ───────────────────────────────
function WorkshopDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  return (
    <group>
      {/* 작업대(북벽 서편 — 문 정면 동선을 비운다. OBSTACLES의 작업대와 같은 자리) */}
      <mesh position={[x - 4, 0.85, b.rect.z1 - 1.6]} material={mat.table} castShadow receiveShadow>
        <boxGeometry args={[6, 0.12, 1.4]} />
      </mesh>
      <mesh
        position={[x, 1.9, b.rect.z1 - 0.25]}
        geometry={mat.box(8, 1.6, 0.12, TILE.wood)}
        material={mat.wood}
        castShadow
      />
      {/* 공구함(작업대 위, 작업장 액센트 색) */}
      <mesh position={[x - 5.5, 1.15, b.rect.z1 - 1.6]} material={mat.barWork} castShadow>
        <boxGeometry args={[0.8, 0.45, 0.6]} />
      </mesh>
      {[-4, -2, 0, 2, 4].map((dx, i) => (
        <mesh
          key={i}
          position={[x + dx, 0.5, b.rect.z0 + 1.6]}
          geometry={mat.box(1, 1, 1, TILE.wood)}
          material={mat.wood}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

// ── 세탁실: 세탁기 4대(북벽) + 카트 ───────────────────────────────
function LaundryDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const z = b.rect.z1 - 1.2;
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[b.rect.x0 + 3 + i * 3.2, 0, z]}>
          <mesh position={[0, 0.7, 0]} material={mat.laundryBlue} castShadow receiveShadow>
            <boxGeometry args={[1.6, 1.4, 1.8]} />
          </mesh>
          <mesh position={[0, 0.8, -0.92]} rotation={[Math.PI / 2, 0, 0]} material={mat.porcelain}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
          </mesh>
        </group>
      ))}
      {/* 카트(동남쪽 구석 — 문 정면 동선을 비운다. OBSTACLES의 카트와 같은 자리) */}
      <mesh position={[b.rect.x0 + 13, 0.6, b.rect.z0 + 1.6]} material={mat.rust} castShadow receiveShadow>
        <boxGeometry args={[1.4, 1, 1]} />
      </mesh>
    </group>
  );
}

// ── 의무실: 침대 셋 + 약장 + 십자 ──────────────────────────────
function InfirmaryDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  return (
    <group>
      {[-4.5, 0, 4.5].map((dx, i) => (
        <group key={i} position={[x + dx, 0, b.rect.z0 + 2.3]}>
          <mesh position={[0, 0.5, 0]} material={mat.porcelain} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.25, 2.6]} />
          </mesh>
          {/* 담요(의무실 액센트 색) */}
          <mesh position={[0, 0.68, -0.3]} material={mat.mint} castShadow>
            <boxGeometry args={[1.1, 0.12, 1.6]} />
          </mesh>
        </group>
      ))}
      <mesh position={[b.rect.x1 - 1.2, 1, cz(b)]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[1, 2, 3]} />
      </mesh>
      <group position={[x, 2.1, b.rect.z1 - 0.45]}>
        <mesh material={mat.red}><boxGeometry args={[0.9, 0.26, 0.08]} /></mesh>
        <mesh material={mat.red}><boxGeometry args={[0.26, 0.9, 0.08]} /></mesh>
      </group>
    </group>
  );
}

// ── 교도소 정문(남벽 중앙): 파란 철문 두 짝, 닫혀 있다. 정문 자물쇠(gate-lock)를 풀면 열린다 —
//    가장 그럴듯한 출구지만 함정이다. 여는 순간 서버가 무작위 2명을 재수감한다 ──
function MainGate({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const open = useInteraction((s) => isCellDoorOpen("gate-main", s.solved));
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const half = GATE.width / 2;

  useFrame((_, dt) => {
    // 닫힘(0) ↔ 열림(안쪽 = 북쪽으로 스윙)
    if (left.current) left.current.rotation.y = THREE.MathUtils.damp(left.current.rotation.y, open ? -1.9 : 0, 3, dt);
    if (right.current) right.current.rotation.y = THREE.MathUtils.damp(right.current.rotation.y, open ? 1.9 : 0, 3, dt);
  });

  // 문짝 한 짝: 경첩(로컬 원점)에서 dir(+1=왼짝 +x쪽 / -1=오른짝 -x쪽)으로 중앙까지 뻗는다.
  // ⚠️ 미러링을 group 회전(Math.PI)으로 하면 useFrame이 rotation.y를 덮어써(닫힘=0) 그 회전이
  //    사라진다 → 오른짝이 벽 쪽으로 밀려 사라졌었다. 그래서 좌우를 지오메트리(dir)로 미러링한다.
  const leaf = (dir: number) => (
    <>
      <mesh position={[(dir * half) / 2, 2.3, 0]} material={mat.gateBlue} castShadow>
        <boxGeometry args={[half - 0.15, 4.4, 0.18]} />
      </mesh>
      {[0.8, 3.8].map((y, i) => (
        <mesh key={i} position={[(dir * half) / 2, y, 0.12]} material={mat.steel}>
          <boxGeometry args={[half - 0.3, 0.14, 0.06]} />
        </mesh>
      ))}
    </>
  );

  return (
    <group>
      {/* 콘크리트 기둥 둘 + 상인방 */}
      {[-(half + 0.5), half + 0.5].map((gx, i) => (
        <mesh
          key={i}
          position={[gx, 2.8, GATE.z]}
          geometry={mat.box(1, 5.6, 1, TILE.concrete)}
          material={mat.concrete}
          castShadow
        />
      ))}
      <mesh
        position={[GATE.x, 5.4, GATE.z]}
        geometry={mat.box(GATE.width + 2, 0.8, 1, TILE.concrete)}
        material={mat.concrete}
        castShadow
      />
      {/* 문짝(경첩 = 기둥 안쪽). 왼짝은 -half에서 +x로, 오른짝은 +half에서 -x로 중앙까지 뻗는다. */}
      <group ref={left} position={[-half, 0, GATE.z]}>{leaf(1)}</group>
      <group ref={right} position={[half, 0, GATE.z]}>{leaf(-1)}</group>
      <Label pos={[GATE.x, 5.2, GATE.z + 1]} text="정문" />
    </group>
  );
}

// ── 배수관 아웃폴(세탁실 뒤 북벽): 진짜 최종 탈출구. 콘크리트 헤드월에 큰 컬버트 관 입구가
//    박혀 있고, 위로는 굵은 배관이 벽을 타고 올라가 꺾인다. 바닥엔 얕은 배수로가 관 입구로
//    이어지고 흥건한 물 자국이 남는다. 해치(pipe-hatch) 창살은 DOOR_META의 문으로 따로 그려진다
//    (배수관 코드를 풀면 열린다). 충돌은 OBSTACLES의 관 입구 박스가 담당 — 여긴 그리기만 한다. ──
function DrainPipe({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const X = PIPE.x; // 30
  const wallZ = 29.8; // 북벽 안쪽 면
  const R = 0.92; // 관 입구 반경
  const dark = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#05070a", roughness: 1 }),
    [],
  );
  return (
    <group>
      {/* 콘크리트 헤드월(벽에 붙는 옹벽) + 상단 두겁 */}
      <mesh
        position={[X, 1.6, wallZ - 0.15]}
        geometry={mat.box(5, 3.2, 0.5, TILE.concrete)}
        material={mat.concrete}
        castShadow
        receiveShadow
      />
      <mesh
        position={[X, 3.28, wallZ - 0.05]}
        geometry={mat.box(5.4, 0.3, 0.8, TILE.concrete)}
        material={mat.concrete}
        castShadow
      />

      {/* 컬버트 관 입구: 벽을 관통하는 관(열린 실린더) + 녹슨 테두리 링 + 안쪽 어둠.
          입구 앞면을 충돌면(z≈29.5)에 맞춰 캐릭터 몸과 겹치지 않게 벽 쪽으로 당긴다. */}
      <mesh position={[X, R, wallZ + 0.1]} rotation={[Math.PI / 2, 0, 0]} material={mat.pipe} castShadow>
        <cylinderGeometry args={[R, R, 0.9, 28, 1, true]} />
      </mesh>
      <mesh position={[X, R, wallZ - 0.35]} rotation={[Math.PI / 2, 0, 0]} material={mat.rust}>
        <torusGeometry args={[R, 0.14, 12, 28]} />
      </mesh>
      <mesh position={[X, R, wallZ - 0.3]} material={dark}>
        <circleGeometry args={[R - 0.05, 28]} />
      </mesh>

      {/* 벽을 타고 오르는 굵은 배관 + 상단으로 꺾이는 오버헤드 관(머리 위라 통행 무관) */}
      <mesh position={[X - 1.7, 2.2, wallZ - 0.55]} material={mat.pipe} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 3.2, 16]} />
      </mesh>
      <mesh position={[X - 1.7, 3.9, wallZ - 0.7]} rotation={[0, 0, Math.PI / 2]} material={mat.pipe} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 16, 16]} />
      </mesh>
      {/* 배관 엘보(입구 위에서 세로관으로 합류) */}
      <mesh position={[X - 1.7, 0.9, wallZ - 0.55]} material={mat.rust} castShadow>
        <boxGeometry args={[0.9, 0.9, 0.7]} />
      </mesh>
      {/* 벽 고정 밴드 둘 */}
      {[1.2, 3.0].map((y, i) => (
        <mesh key={i} position={[X - 1.7, y, wallZ - 0.55]} rotation={[Math.PI / 2, 0, 0]} material={mat.steel}>
          <torusGeometry args={[0.4, 0.06, 8, 16]} />
        </mesh>
      ))}

      {/* 녹슨 밸브 휠(헤드월 옆 — 상호작용 지점 근처) */}
      <group position={[X + 1.6, 1.3, wallZ - 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={mat.steel}>
          <torusGeometry args={[0.42, 0.06, 8, 20]} />
        </mesh>
        {[0, Math.PI / 2].map((r, i) => (
          <mesh key={i} rotation={[0, 0, r]} material={mat.steel}>
            <boxGeometry args={[0.82, 0.06, 0.06]} />
          </mesh>
        ))}
        <mesh material={mat.rust}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 10]} />
        </mesh>
      </group>

      {/* 바닥 배수로(관 입구에서 남쪽으로 이어지는 얕은 콘크리트 트로프) + 물 자국 */}
      <mesh
        position={[X, 0.03, wallZ - 2.4]}
        geometry={mat.box(2.2, 0.08, 4, TILE.concrete)}
        material={mat.concrete}
        receiveShadow
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[X, 0.08, wallZ - 2.4]}
        geometry={mat.plane(1.3, 3.8, TILE.water)}
        material={mat.water}
      />

      <Label pos={[X, 3.9, wallZ - 0.9]} text="배수관" />
    </group>
  );
}

// ── 별관 방 벽 낙인(표식 데칼) ─────────────────────────────────────
// 예전엔 감방(A~D) 문 맞은편 벽에 표식을 상시 노출했으나, 이제 **별관 방 안 퀴즈를 풀면**
// 그 방 벽에 표식이 나타나게 옮겼다(방식은 동일 — 벽에 크게 데칼로 찍는다).
// 표식 자체는 escapePlan의 감방 clue(A~D)에서 가져온다 — 이래야 HUD·낙서·탈옥 코드가 쓰는
// 4개 표식·값과 완전히 일관된다(별관 방을 감방 4개에 1:1로 대응시킨다).
//   ⚠️ 노출되는 건 **표식뿐**이다. 코드 자릿수(position)와 수(value)는 여전히 낙서 3곳과
//      본인 HUD에만 있으므로, 남의 낙인을 봐도 그 사람 몫의 숫자는 계산할 수 없다
//      — 채팅 공유를 강제하는 구조가 그대로 유지된다.
const STAMP_PATHS = SYMBOLS.map((s) => symbolIcon(s, true)!);
const STAMP_PAINT: [number, number, number] = [0xd8, 0xc7, 0xa4]; // 바랜 흰 페인트

// 별관 방 → (표식을 드러내는 퀴즈 id, 대응 감방 clue, 표식을 찍을 벽). wall은 입구 맞은편 벽이다.
// 2026-07-31에 의무실까지 들어와 **네 방이 다 찼다** — 이제 표식 4개가 모여 배수관 샛길이 열린다.
const ROOM_STAMPS: { room: string; quiz: string; cell: string; wall: Edge }[] = [
  { room: "workshop", quiz: "quiz-work", cell: "A", wall: "S" }, // 문=북벽 → 표식은 남벽
  { room: "cafeteria", quiz: "lock-fridge", cell: "B", wall: "E" }, // 냉장고 코드를 풀면 동벽에 표식
  { room: "infirmary", quiz: "quiz-med", cell: "C", wall: "S" }, // 문=북벽 → 표식은 남벽(침대는 낮아 안 가린다)
  // 세탁실은 문=남벽이지만 북벽엔 세탁기 4대가 붙어 있어(표식이 가린다) 동벽에 찍는다.
  { room: "laundry", quiz: "quiz-laundry", cell: "D", wall: "E" },
];

function RoomStamps() {
  const roomId = useGameStore((s) => s.roomId);
  const solved = useInteraction((s) => s.solved);
  const texes = useTexture(STAMP_PATHS);
  const plan = useMemo(() => escapePlan(roomId), [roomId]);

  // 낙인 원본은 거의 검정(#1b1d22)이라 어두운 콘크리트 벽에서 뭉개진다. 알파(모양)만 살리고
  // 색은 바랜 페인트로 바꿔 굽는다. 원본에서 밝은 얼룩은 알파를 더 깎아 벗겨진 자국으로 남긴다.
  const painted = useMemo(
    () =>
      texes.map((t) => {
        const img = t.image as HTMLImageElement;
        const cv = document.createElement("canvas");
        cv.width = img.width;
        cv.height = img.height;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, cv.width, cv.height);
        const p = data.data;
        for (let i = 0; i < p.length; i += 4) {
          const lum = (p[i] + p[i + 1] + p[i + 2]) / 765; // 0(잉크) ~ 1(벗겨진 얼룩)
          [p[i], p[i + 1], p[i + 2]] = STAMP_PAINT;
          p[i + 3] = Math.round(p[i + 3] * (1 - lum * 0.55));
        }
        ctx.putImageData(data, 0, 0);
        const out = new THREE.CanvasTexture(cv);
        out.colorSpace = THREE.SRGBColorSpace;
        out.anisotropy = 8;
        return out;
      }),
    [texes],
  );

  const mats = useMemo(
    () =>
      painted.map(
        (map) =>
          new THREE.MeshStandardMaterial({
            map,
            transparent: true,
            opacity: 0.82, // 벽에 스며든 정도
            depthWrite: false,
            roughness: 1,
            metalness: 0,
            // 벽면과 같은 깊이라 z-fighting이 나기 쉽다. 0.02m 띄우고 오프셋도 건다.
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          }),
      ),
    [painted],
  );

  const SIZE = 2.0; // 별관 방 벽은 3m라, 벽 안(0.5~2.5)에 들어오게 크기·높이를 잡는다.
  const CY = 1.5; // 낙인 중심 높이(벽 중앙)
  const EPS = WALL_T / 2 + 0.02; // 벽 안쪽 면에서 2cm 띄운다.
  return (
    <group>
      {ROOM_STAMPS.map((cfg) => {
        if (!solved[cfg.quiz]) return null; // 퀴즈를 풀어야 표식이 나타난다(방 전체 공유 — 서버가 solved 브로드캐스트)
        const clue = plan.clues[cfg.cell];
        if (!clue) return null;
        const m = mats[SYMBOLS.indexOf(clue.symbol as (typeof SYMBOLS)[number])];
        const b = getBuilding(cfg.room);
        if (!m || !b) return null;
        const { x0, z0, x1, z1 } = b.rect;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
        // 벽면 안쪽을 향하도록 위치·회전을 정한다(planeGeometry 기본 법선 +z).
        let pos: [number, number, number];
        let rotY: number;
        switch (cfg.wall) {
          case "N": pos = [cx, CY, z1 - EPS]; rotY = Math.PI; break;
          case "S": pos = [cx, CY, z0 + EPS]; rotY = 0; break;
          case "W": pos = [x0 + EPS, CY, cz]; rotY = Math.PI / 2; break;
          default: pos = [x1 - EPS, CY, cz]; rotY = -Math.PI / 2; break; // "E"
        }
        return (
          <mesh key={cfg.room} position={pos} rotation={[0, rotY, 0]} material={m}>
            {/* 데칼이라 UV는 0~1 그대로 둔다(월드 스케일 UV 대상이 아니다) */}
            <planeGeometry args={[SIZE, SIZE]} />
          </mesh>
        );
      })}
    </group>
  );
}

function Label({ pos, text }: { pos: [number, number, number]; text: string }) {
  return (
    <Html position={pos} center distanceFactor={26}>
      <div className="pointer-events-none select-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-sm font-semibold text-amber-200">
        {text}
      </div>
    </Html>
  );
}

// ── 장식(데코): 빈 구역을 채운다. 전부 시각 전용 + 충돌이 없는 자리(담장 위·담장 밖·머리 위·
//    바닥 페인트·담장에 붙는 조명탑)라 서버 Collision과 무관하다(플레이어가 통과할 일이 없다). ──

// 담장 위 철조망 코일. 네 외벽 상단을 따라 인스턴스드 토러스로 돌린다(한 번의 드로우콜).
function RazorWire() {
  const coils = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    const y = 5.15;
    const step = 1.5;
    for (let x = -41; x <= 41; x += step) {
      out.push({ pos: [x, y, 30], rot: [0, Math.PI / 2, 0] });
      out.push({ pos: [x, y, -30], rot: [0, Math.PI / 2, 0] });
    }
    for (let z = -29; z <= 29; z += step) {
      out.push({ pos: [42, y, z], rot: [0, 0, 0] });
      out.push({ pos: [-42, y, z], rot: [0, 0, 0] });
    }
    return out;
  }, []);
  return (
    <Instances limit={320} range={coils.length} castShadow>
      <torusGeometry args={[0.34, 0.045, 6, 10]} />
      <meshStandardMaterial color="#8a9099" metalness={0.75} roughness={0.4} />
      {coils.map((c, i) => (
        <Instance key={i} position={c.pos} rotation={c.rot} />
      ))}
    </Instances>
  );
}

// 연병장 조명탑: 담장에 붙는 키 큰 기둥 + 안쪽을 향해 기운 램프 헤드(발광 렌즈).
function Floodlight({ pos, rotY, mat }: { pos: [number, number, number]; rotY: number; mat: ReturnType<typeof useMaterials> }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 4, 0]} material={mat.steel} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 8, 10]} />
      </mesh>
      {/* 붐 + 헤드(아래·안쪽으로 기울임) */}
      <group position={[0.9, 7.7, 0]} rotation={[0, 0, 0.5]}>
        <mesh material={mat.steel} castShadow>
          <boxGeometry args={[1.6, 0.5, 1.4]} />
        </mesh>
        <mesh position={[0.1, -0.28, 0]} rotation={[0, 0, Math.PI / 2]} material={mat.lamp}>
          <boxGeometry args={[0.36, 1.4, 1.2]} />
        </mesh>
      </group>
    </group>
  );
}

function Floodlights({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const poles: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [-41, 0, -27], rotY: 0 }, // 서벽 → 붐 동쪽(안쪽)
    { pos: [41, 0, -27], rotY: Math.PI }, // 동벽 → 붐 서쪽
    { pos: [-41, 0, 2], rotY: 0 },
    { pos: [41, 0, 2], rotY: Math.PI },
  ];
  return (
    <group>
      {poles.map((p, i) => (
        <Floodlight key={i} pos={p.pos} rotY={p.rotY} mat={mat} />
      ))}
    </group>
  );
}

// (옛 연병장 바닥 페인트 YardMarkings는 제거 — 실제 농구 코트 BasketballCourt가 대체한다.)

// 천장 부착형 조명(짧은 갓 + 발광 돔). ceilingY는 천장 밑면 — 거기에 바짝 붙인다.
function CeilingLamp({ x, z, ceilingY, mat }: { x: number; z: number; ceilingY: number; mat: ReturnType<typeof useMaterials> }) {
  return (
    <group position={[x, ceilingY, z]}>
      <mesh position={[0, -0.04, 0]} material={mat.steel}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 10]} />
      </mesh>
      <mesh position={[0, -0.14, 0]} material={mat.lamp}>
        <sphereGeometry args={[0.13, 10, 10]} />
      </mesh>
    </group>
  );
}

// 복도 천장 부착 조명. 조명은 매달지 않고 천장에 붙인다:
// 수감동은 2층 테라스 슬래브 밑(y=4.42), 별관은 지붕 밑(y=ANNEX_H).
// 수감동↔별관 연결 복도(x −6~6)엔 조명을 두지 않는다.
// (예전엔 복도를 가로지르는 머리 위 배관 2줄이 있었으나 제거했다.)
function CorridorLamps({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      {/* 수감동: 2층 테라스(북 z=19 · 남 z=15) 슬래브 바로 아래에 붙인다. */}
      {[-32, -20, -10].flatMap((x) =>
        [15, 19].map((lz) => (
          <CeilingLamp key={`w${x}-${lz}`} x={x} z={lz} ceilingY={FLOOR2_Y - 0.08} mat={mat} />
        )),
      )}
      {/* 별관: 지붕(y=ANNEX_H) 천장에 바짝 붙인다. 복도 중앙(z=17). */}
      {[9, 21, 33].map((x) => (
        <CeilingLamp key={`e${x}`} x={x} z={17} ceilingY={ANNEX_H} mat={mat} />
      ))}
    </group>
  );
}

// 담장 밖 원경 실루엣: 사방으로 어두운 건물 덩어리를 흩어 둔다. 포그에 잠겨 원근감을 준다.
function Backdrop({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const boxes = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const h = (i: number) => 9 + ((i * 37) % 8); // 인덱스 기반 높이 변주(재현 가능)
    let i = 0;
    for (let x = -48; x <= 48; x += 13) {
      out.push({ pos: [x, h(i) / 2, 46], size: [9, h(i), 7] });
      i++;
      out.push({ pos: [x, h(i) / 2, -46], size: [9, h(i), 7] });
      i++;
    }
    for (let z = -40; z <= 40; z += 13) {
      out.push({ pos: [54, h(i) / 2, z], size: [7, h(i), 9] });
      i++;
      out.push({ pos: [-54, h(i) / 2, z], size: [7, h(i), 9] });
      i++;
    }
    return out;
  }, []);
  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={b.pos} material={mat.silhouette}>
          <boxGeometry args={b.size} />
        </mesh>
      ))}
    </group>
  );
}

function Decor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      <RazorWire />
      {/* 조명탑은 OBJ light_tower(PrisonProps)로 대체 */}
      {/* 옛 연병장 바닥 페인트(YardMarkings: 노랑 안전선·센터라인·서클)는 제거 — 실제 농구 코트가 대체. */}
      <CorridorLamps mat={mat} />
      <Backdrop mat={mat} />
    </group>
  );
}

// ── 평지붕: 사각형 구역(rect)을 y 높이에서 덮는 슬래브 + 가장자리 낮은 파라펫. ──
// 카메라는 cameraOcclusion의 같은 자리 차폐 슬래브가 지붕 밑으로 당겨 준다(안에서 시야 확보).
function FlatRoof({
  rect,
  y,
  mat,
}: {
  rect: { x0: number; z0: number; x1: number; z1: number };
  y: number;
  mat: ReturnType<typeof useMaterials>;
}) {
  const { x0, z0, x1, z1 } = rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const OVER = 0.5; // 처마: 벽 바깥으로 살짝 내민다
  const SLAB_T = 0.3;
  const PAR_H = 0.6; // 옥상 난간(파라펫) 높이
  const parY = y + SLAB_T + PAR_H / 2;
  return (
    <group>
      {/* 지붕 슬래브 */}
      <mesh
        position={[cx, y + SLAB_T / 2, cz]}
        geometry={mat.box(w + OVER * 2, SLAB_T, d + OVER * 2, TILE.concrete)}
        material={mat.concrete}
        castShadow
        receiveShadow
      />
      {/* 파라펫(옥상 가장자리 낮은 턱) */}
      {([
        [cx, z1 + OVER, w + OVER * 2, WALL_T], // 북
        [cx, z0 - OVER, w + OVER * 2, WALL_T], // 남
        [x1 + OVER, cz, WALL_T, d + OVER * 2], // 동
        [x0 - OVER, cz, WALL_T, d + OVER * 2], // 서
      ] as [number, number, number, number][]).map(([px, pz, sx, sz], i) => (
        <mesh
          key={i}
          position={[px, parY, pz]}
          geometry={mat.box(sx, PAR_H, sz, TILE.concrete)}
          material={mat.concrete}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

// ── 별관 지붕: 네 방+복도(x 6~38 · z 6~28)를 통째로 덮는다(y=ANNEX_H). ──
// 벽은 ANNEX_H(=4.5)까지 올렸고, 문 개구부는 전 높이로 뚫리므로 문(높이 WALL_H) 위
// WALL_H~ANNEX_H 구간을 콘크리트 상인방으로 막아 지붕까지 벽을 잇는다.
const ANNEX_DOOR_IDS = ["door-cafe", "door-laundry", "door-work", "door-med"];

function AnnexRoof({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const headerH = ANNEX_H - WALL_H; // 문 위 상인방 높이(1.5)
  const headerY = (WALL_H + ANNEX_H) / 2;
  return (
    <group>
      {/* 문 위 상인방(개구부 상단 ~ 지붕) */}
      {DOOR_META.filter((dm) => ANNEX_DOOR_IDS.includes(dm.id)).map((dm) => {
        const [dx, dz] = dm.at;
        const horizontal = dm.edge === "N" || dm.edge === "S";
        const size: [number, number, number] = horizontal
          ? [dm.width, headerH, WALL_T]
          : [WALL_T, headerH, dm.width];
        return (
          <mesh
            key={dm.id}
            position={[dx, headerY, dz]}
            geometry={mat.box(size[0], size[1], size[2], TILE.concrete)}
            material={mat.concrete}
            castShadow
            receiveShadow
          />
        );
      })}
      <FlatRoof rect={ANNEX_ROOF} y={ANNEX_H} mat={mat} />
    </group>
  );
}

// ── 화장실 지붕: 화장실(x −6~6 · z 20~28)을 별관과 같은 높이(ANNEX_H)에서 덮는다. ──
// 벽을 ANNEX_H로 올렸으므로 남쪽 출입 개구부(x0, z20) 위 WALL_H~ANNEX_H를 상인방으로 채운다.
function ToiletRoof({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      {/* 화장실 출입 개구부 상인방(개구부 상단 ~ 지붕) */}
      <mesh
        position={[0, (WALL_H + ANNEX_H) / 2, 20]}
        geometry={mat.box(DOOR_W, ANNEX_H - WALL_H, WALL_T, TILE.concrete)}
        material={mat.concrete}
        castShadow
        receiveShadow
      />
      <FlatRoof rect={getBuilding("toilet")!.rect} y={ANNEX_H} mat={mat} />
    </group>
  );
}

// ── 건물 출입구(화장실 맞은편, 연병장 쪽) 철창 슬라이딩 게이트: 링크 남벽 개구부(x0, z14, 폭 3m)를
// 덮고, 열리면 옆(서쪽)으로 미끄러진다. E로 개폐(서버 openDoors 권위). 위는 벽 높이(ANNEX_H)까지 상인방. ──
function EntranceGate({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const steel = mat.steel;
  const open = useInteraction((s) => !!s.serverDoors[ENTRANCE_GATE.id]);
  const near = useInteraction((s) => s.nearId === ENTRANCE_GATE.id);
  const panel = useRef<THREE.Group>(null);
  const h = ENTRANCE_GATE.h; // 3
  const w = ENTRANCE_GATE.w; // 3
  const barY = (h - 0.05) / 2;
  const barH = h - 0.55;
  const nBars = Math.max(4, Math.round(w / 0.34));
  useFrame((_, dt) => {
    if (!panel.current) return;
    const target = open ? -w : 0; // 닫힘(개구부를 메움) ↔ 열림(옆으로 미끄러짐)
    panel.current.position.x = THREE.MathUtils.damp(panel.current.position.x, target, 6, dt);
  });
  return (
    <group position={[ENTRANCE_GATE.cx, 0, ENTRANCE_GATE.cz]}>
      {/* 문틀 기둥(개구부 양끝) */}
      {[-w / 2, w / 2].map((dx, i) => (
        <mesh key={i} position={[dx, h / 2, 0]} material={steel}>
          <boxGeometry args={[0.16, h, 0.22]} />
        </mesh>
      ))}
      {/* 개구부 위 상인방(벽 높이 ANNEX_H까지 콘크리트로 채운다) */}
      <mesh
        position={[0, (WALL_H + ANNEX_H) / 2, 0]}
        geometry={mat.box(w + 0.3, ANNEX_H - WALL_H, WALL_T, TILE.concrete)}
        material={mat.concrete}
        castShadow
        receiveShadow
      />
      {/* 슬라이딩 철창짝(위·아래 가로 레일 + 세로 살) */}
      <group ref={panel}>
        {[h - 0.3, 0.25].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} material={steel}>
            <boxGeometry args={[w, 0.1, 0.08]} />
          </mesh>
        ))}
        {Array.from({ length: nBars }, (_, i) => (
          <mesh key={i} position={[-w / 2 + ((i + 0.5) / nBars) * w, barY, 0]} material={steel}>
            <boxGeometry args={[BAR_W, barH, BAR_W]} />
          </mesh>
        ))}
      </group>
      {near && (
        <Html center distanceFactor={10} position={[0, 2.0, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {open ? "[E] 출입구 닫기" : "[E] 출입구 열기"}
          </div>
        </Html>
      )}
    </group>
  );
}

function BuildingDecor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      {/* 감방 침대·세면변기·방 세트(식당·작업장·세탁실·의무실)·감시탑은 OBJ 소품(PrisonProps)이 대체. */}
      <SecondFloor mat={mat} />
      <ToiletDecor b={getBuilding("toilet")!} mat={mat} />
      <ParadeDecor mat={mat} />
      <CafeteriaDecor b={getBuilding("cafeteria")!} mat={mat} />
      <AnnexRoof mat={mat} />
      <ToiletRoof mat={mat} />
      <CellBlockGate mat={mat} />
      <EntranceGate mat={mat} />
      <MainGate mat={mat} />
      <DrainPipe mat={mat} />
    </group>
  );
}

export default function GameMap() {
  const mat = useMaterials();

  return (
    <group>
      {/* 베이스 지면(개활지) — 건물 바닥은 이 위에 색으로 얹힌다. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        geometry={mat.plane(100, 76, TILE.ground)}
        material={mat.ground}
        receiveShadow
      />

      {/* 구역 바닥(건물별 색 — 연병장은 모래색). 색 틴트는 유지하고 콘크리트 법선맵으로 요철만 얹는다.
          방마다 크기가 크게 다르므로(감방 16×8 ↔ 연병장 84×36) UV도 크기에 비례시킨다. */}
      {FLOORS.map((f, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(f.rect.x0 + f.rect.x1) / 2, 0, (f.rect.z0 + f.rect.z1) / 2]}
          geometry={mat.plane(
            Math.abs(f.rect.x1 - f.rect.x0),
            Math.abs(f.rect.z1 - f.rect.z0),
            TILE.floor,
          )}
          receiveShadow
        >
          <meshStandardMaterial color={f.color} normalMap={mat.floorN} roughness={1} metalness={0} />
        </mesh>
      ))}

      {/* 콘크리트 벽(자동 생성). 감방 벽(5m)부터 외벽(84m)까지 길이가 제각각이라
          월드 스케일 UV가 가장 크게 효과를 보는 자리다. */}
      {WALL_BOXES.map((w, i) => (
        <mesh
          key={i}
          position={[w.cx, w.h / 2, w.cz]}
          geometry={mat.box(w.hx * 2, w.h, w.hz * 2, TILE.concrete)}
          material={mat.concrete}
          castShadow
          receiveShadow
        />
      ))}

      {/* 잠금 문(방향별, 방마다 다른 창살 색). 정문(gate-main)은 MainGate가 따로 그리고,
          식당 문(door-cafe)은 창살이 아니라 진짜 식당 양여닫이 문으로 그린다. */}
      {DOOR_META.filter((d) => d.id !== "gate-main").map((d) => {
        if (d.id === "door-cafe") return <CafeteriaDoor key={d.id} meta={d} mat={mat} />;
        // 수감동 감방문(cell-*): 복도 철창과 같은 무채색 철재 + 천장(2층 슬래브)까지 채운 높이.
        const isCell = d.id.startsWith("cell-");
        return (
          <BarDoor
            key={d.id}
            meta={d}
            mat={isCell ? mat.steel : barMatFor(mat, d.id)}
            h={isCell ? FLOOR2_Y : WALL_H}
          />
        );
      })}

      {/* 배수관 샛길 철창(표식 4개면 열림) */}
      <DrainGate mat={mat} />

      {/* 배수관 우회 차단벽: 세탁실 서벽을 북쪽 순찰로(z28~30)까지 연장 — 서편 우회로를 막아
          배수관 구역은 동쪽 철창(표식 4개)으로만 들어가게 한다. prisonLayout/Collision OBSTACLES와 같은 자리. */}
      <mesh
        position={[22, WALL_H / 2, 29]}
        geometry={mat.box(0.4, WALL_H, 2, TILE.concrete)}
        material={mat.concrete}
        castShadow
        receiveShadow
      />

      {/* 건물 소품 */}
      <BuildingDecor mat={mat} />

      {/* 장식(빈 구역 채우기): 철조망·조명탑·바닥 페인트·복도 배관·담장 밖 원경 */}
      <Decor mat={mat} />

      {/* OBJ 소품 키트(감방 침대·세면변기·CCTV·열쇠). 로드 전엔 아무것도 안 그린다. */}
      <Suspense fallback={null}>
        <PrisonProps />
      </Suspense>

      {/* 별관 방 벽 낙인(표식) — 방 안 퀴즈를 풀면 나타난다. 자체 Suspense(낙인 로딩이 맵을 안 되돌리게). */}
      <Suspense fallback={null}>
        <RoomStamps />
      </Suspense>

      {/* 라벨 */}
      {BUILDINGS.filter((b) => b.label).map((b) => (
        <Label
          key={b.id}
          pos={[cx(b), (b.h ?? WALL_H) - 0.3, cz(b)]}
          text={b.label!}
        />
      ))}

      {/* 상호작용 오브젝트 */}
      {INTERACTABLES.map((it) => (
        <Interactable key={it.id} data={it} />
      ))}
    </group>
  );
}

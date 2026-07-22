"use client";
// 교도소 캠퍼스 맵. 좌표·벽·문·바닥은 prisonLayout.ts(BUILDINGS 스펙에서 자동 생성)를 따른다.
// 이 파일은 그 데이터를 3D로 그리기만 한다: 베이스 지면 + 콘크리트 벽 + 방향별 문 + 건물별 소품
// + 수감동 2층(시각 전용) + 네 모서리 감시탑 + 남벽 중앙의 파란 정문.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import Basketball from "./Basketball";
import Interactable from "./Interactable";
import { INTERACTABLES, isCellDoorOpen, useInteraction } from "./interactables";
import {
  BUILDINGS,
  CELL_BLOCK_H,
  CELLS,
  DOOR_META,
  FLOOR2_Y,
  FLOORS,
  GATE,
  SLAB2,
  STAIR,
  TOWERS,
  WALL_BOXES,
  WALL_H,
  YARD,
  getBuilding,
  type Building,
  type DoorMeta,
} from "./prisonLayout";

const BAR_W = 0.08;

function useMaterials() {
  return useMemo(() => {
    const mk = (color: string, roughness: number, metalness: number) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      concrete: mk("#3b3f47", 0.95, 0),
      steel: mk("#9aa0aa", 0.4, 0.8),
      gateBlue: mk("#2b52c8", 0.45, 0.5), // 정문(파란 철문)
      slab: mk("#454a54", 0.9, 0.05), // 2층 바닥·계단
      bunk: mk("#4a5568", 0.7, 0.1),
      porcelain: mk("#cbd5e1", 0.5, 0.05),
      wood: mk("#6b5636", 0.8, 0.05),
      table: mk("#8a9099", 0.6, 0.2),
      hoop: mk("#d9542b", 0.5, 0.3),
      rust: mk("#7a4a32", 0.9, 0.2),
      red: mk("#b4322a", 0.6, 0.2),
      paper: mk("#d8d4c8", 1, 0),
      water: mk("#2a3b4a", 0.15, 0.1),
      ball: mk("#c96a2b", 0.85, 0),
      // 감방 철창 색(방마다 다르게 칠해 어느 방인지 한눈에 구분한다)
      barA: mk("#b1573e", 0.45, 0.6), // 1-1 녹슨 주황
      barB: mk("#c9a23b", 0.45, 0.6), // 1-2 노랑
      barC: mk("#4e9153", 0.45, 0.6), // 1-3 초록
      barD: mk("#7b6ab8", 0.45, 0.6), // 1-4 보라
      // 별관 문 철창 색(방 액센트와 같은 계열)
      barLaundry: mk("#5b83b8", 0.45, 0.6), // 세탁실 파랑
      barWork: mk("#b8963b", 0.45, 0.6), // 작업장 황토
      barMed: mk("#4fa08b", 0.45, 0.6), // 의무실 청록
      woodWarm: mk("#7c5f3a", 0.75, 0.05), // 식당 식탁
      laundryBlue: mk("#7d97b8", 0.5, 0.3), // 세탁기 몸통
      mint: mk("#7fb8a5", 0.7, 0), // 의무실 담요
    };
  }, []);
}

const cx = (b: Building) => (b.rect.x0 + b.rect.x1) / 2;
const cz = (b: Building) => (b.rect.z0 + b.rect.z1) / 2;

// ── 방향별 창살 문: 잠금 문(cell-*, door-*)을 개구부에 그린다. 풀면 경첩 회전으로 열린다. ──
function BarDoor({ meta, mat }: { meta: DoorMeta; mat: THREE.Material }) {
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
      <mesh position={[0, WALL_H / 2, 0]} material={mat}>
        <boxGeometry args={[0.16, WALL_H, 0.2]} />
      </mesh>
      <mesh position={[w, WALL_H / 2, 0]} material={mat}>
        <boxGeometry args={[0.16, WALL_H, 0.2]} />
      </mesh>
      {/* 문짝(경첩=원점 기준 회전) */}
      <group ref={panel}>
        <mesh position={[w / 2, WALL_H - 0.3, 0]} material={mat}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        <mesh position={[w / 2, 0.25, 0]} material={mat}>
          <boxGeometry args={[w, 0.1, 0.1]} />
        </mesh>
        {Array.from({ length: nBars }, (_, i) => {
          const bx = ((i + 0.5) / nBars) * w;
          return (
            <mesh key={i} position={[bx, (WALL_H - 0.3) / 2, 0]} material={mat}>
              <boxGeometry args={[BAR_W, WALL_H - 0.5, BAR_W]} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ── 감방 내부: 이층 침상 + 변기. 문 반대편 구석에 변기를 둔다(북측 감방=남향 문, 남측=북향 문) ──
function CellInterior({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const z = cz(b);
  const doorEdge = b.openings?.[0]?.edge ?? "S";
  const wx = b.rect.x0 + 1.4; // 서쪽 벽 앞(이층 침상)
  const tx = b.rect.x1 - 1.3; // 동쪽 구석(변기)
  const tz = doorEdge === "S" ? b.rect.z1 - 1.3 : b.rect.z0 + 1.3; // 문 반대편 구석
  return (
    <group>
      {[0.55, 1.55].map((y, i) => (
        <mesh key={i} position={[wx, y, z]} material={mat.bunk} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.16, 3]} />
        </mesh>
      ))}
      {[-1.3, 1.3].map((dz, i) => (
        <mesh key={i} position={[wx, 1.05, z + dz]} material={mat.steel} castShadow>
          <boxGeometry args={[0.08, 2.1, 0.08]} />
        </mesh>
      ))}
      <mesh position={[tx, 0.3, tz]} material={mat.porcelain} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.6, 16]} />
      </mesh>
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
          material={mat.slab}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[r.x1 - r.x0, 0.16, r.z1 - r.z0]} />
        </mesh>
      ))}
      {/* 계단(복도 정중앙, 동쪽에서 올라 서쪽 랜딩으로) — 높이는 STAIR 램프와 같은 기울기 */}
      {Array.from({ length: nSteps }, (_, i) => {
        const h = ((i + 1) / nSteps) * FLOOR2_Y;
        return (
          <mesh
            key={i}
            position={[STAIR.x1 - (i + 0.5) * run, h / 2, stairZ]}
            material={mat.slab}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[run, h, stairW]} />
          </mesh>
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
      <mesh position={[-6, (WALL_H + CELL_BLOCK_H) / 2, 17]} material={mat.concrete} castShadow>
        <boxGeometry args={[0.4, CELL_BLOCK_H - WALL_H, 6.4]} />
      </mesh>
      {/* 2층 감방 입구: 방 색깔의 활짝 열린 철창 문 */}
      {DOOR_META.filter((d) => d.id.startsWith("cell-")).map((d) => (
        <OpenCellGate key={d.id} meta={d} mat={barMatFor(mat, d.id)} />
      ))}
    </group>
  );
}

// ── 화장실(연결 복도 북측): 변기 3 + 칸막이 + 세면대 ──────────────
function ToiletDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const tz = b.rect.z1 - 1.2;
  return (
    <group>
      {[-3.5, 0, 3.5].map((tx, i) => (
        <mesh key={i} position={[tx, 0.3, tz]} material={mat.porcelain} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.6, 16]} />
        </mesh>
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
      <mesh position={[0, 0.45, 0]} material={mat.wood} castShadow receiveShadow>
        <boxGeometry args={[4, 0.14, 0.7]} />
      </mesh>
      {[-1.6, 1.6].map((dx, i) => (
        <mesh key={i} position={[dx, 0.22, 0]} material={mat.steel} castShadow>
          <boxGeometry args={[0.12, 0.44, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

function ParadeDecor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const { cx: px, cz: pz } = YARD;
  return (
    <group>
      {/* 농구골대(동편) — Basketball의 RIM(cx+6.75)과 맞춘 위치 */}
      <group position={[px + 7.5, 0, pz]}>
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

// ── 열린 철창(연결 복도, 수감동 쪽 경계): 항상 열려 있는 창살 문.
// 기둥만 실체(OBSTACLES의 철창 기둥) — x=-3, 출입구 동선(x=0)을 비켜 세운다. ──
function LinkGate({ mat }: { mat: THREE.Material }) {
  const bars = (w: number) => (
    <>
      <mesh position={[w / 2, WALL_H - 0.3, 0]} material={mat}>
        <boxGeometry args={[w, 0.1, 0.1]} />
      </mesh>
      <mesh position={[w / 2, 0.25, 0]} material={mat}>
        <boxGeometry args={[w, 0.1, 0.1]} />
      </mesh>
      {[0.5, 1.1, 1.7].map((bx) => (
        <mesh key={bx} position={[bx, (WALL_H - 0.3) / 2, 0]} material={mat}>
          <boxGeometry args={[BAR_W, WALL_H - 0.5, BAR_W]} />
        </mesh>
      ))}
    </>
  );
  return (
    <group position={[-3, 0, 17]}>
      {/* 문틀(복도 폭 z 14.5~19.5) + 상인방 */}
      {[-2.5, 2.5].map((dz, i) => (
        <mesh key={i} position={[0, WALL_H / 2, dz]} material={mat}>
          <boxGeometry args={[0.16, WALL_H, 0.2]} />
        </mesh>
      ))}
      <mesh position={[0, WALL_H - 0.1, 0]} material={mat}>
        <boxGeometry args={[0.12, 0.2, 5.2]} />
      </mesh>
      {/* 활짝 열린 문짝 두 짝(수감동 쪽으로 젖혀짐) */}
      <group position={[0, 0, -2.5]} rotation={[0, -Math.PI / 2 + 2.1, 0]}>{bars(2.2)}</group>
      <group position={[0, 0, 2.5]} rotation={[0, Math.PI / 2 - 2.1, 0]}>{bars(2.2)}</group>
    </group>
  );
}

// ── 식당: 식탁 + 배식대(16×8 방) ─────────────────────────────────
function CafeteriaDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  const z = cz(b);
  return (
    <group>
      {[-4, 4].map((dx) => (
        <group key={dx} position={[x + dx, 0, z - 0.5]}>
          <mesh position={[0, 0.75, 0]} material={mat.woodWarm} castShadow receiveShadow>
            <boxGeometry args={[3.2, 0.1, 1.4]} />
          </mesh>
          {[-0.95, 0.95].map((bz, i) => (
            <mesh key={i} position={[0, 0.42, bz]} material={mat.wood} castShadow>
              <boxGeometry args={[3, 0.1, 0.4]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 배식대(북벽 앞) */}
      <mesh position={[x, 0.6, b.rect.z1 - 0.8]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[10, 1.2, 1]} />
      </mesh>
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
      <mesh position={[x, 1.9, b.rect.z1 - 0.25]} material={mat.wood} castShadow>
        <boxGeometry args={[8, 1.6, 0.12]} />
      </mesh>
      {/* 공구함(작업대 위, 작업장 액센트 색) */}
      <mesh position={[x - 5.5, 1.15, b.rect.z1 - 1.6]} material={mat.barWork} castShadow>
        <boxGeometry args={[0.8, 0.45, 0.6]} />
      </mesh>
      {[-4, -2, 0, 2, 4].map((dx, i) => (
        <mesh key={i} position={[x + dx, 0.5, b.rect.z0 + 1.6]} material={mat.wood} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
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

// ── 교도소 정문(남벽 중앙): 파란 철문 두 짝, 닫혀 있다. 탈옥문(escape-gate)을 풀면 열린다 ──
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

  const panel = (
    <>
      <mesh position={[half / 2, 2.3, 0]} material={mat.gateBlue} castShadow>
        <boxGeometry args={[half - 0.15, 4.4, 0.18]} />
      </mesh>
      {[0.8, 3.8].map((y, i) => (
        <mesh key={i} position={[half / 2, y, 0.12]} material={mat.steel}>
          <boxGeometry args={[half - 0.3, 0.14, 0.06]} />
        </mesh>
      ))}
    </>
  );

  return (
    <group>
      {/* 콘크리트 기둥 둘 + 상인방 */}
      {[-(half + 0.5), half + 0.5].map((gx, i) => (
        <mesh key={i} position={[gx, 2.8, GATE.z]} material={mat.concrete} castShadow>
          <boxGeometry args={[1, 5.6, 1]} />
        </mesh>
      ))}
      <mesh position={[GATE.x, 5.4, GATE.z]} material={mat.concrete} castShadow>
        <boxGeometry args={[GATE.width + 2, 0.8, 1]} />
      </mesh>
      {/* 문짝(경첩 = 기둥 안쪽). 왼짝은 +x로, 오른짝은 -x로 뻗는다 */}
      <group ref={left} position={[-half, 0, GATE.z]}>{panel}</group>
      <group ref={right} position={[half, 0, GATE.z]} rotation={[0, Math.PI, 0]}>{panel}</group>
      <Label pos={[GATE.x, 5.2, GATE.z + 1]} text="정문" />
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

function BuildingDecor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  return (
    <group>
      {CELLS.map((c) => {
        const b = getBuilding(c.id)!;
        return <CellInterior key={c.id} b={b} mat={mat} />;
      })}
      <SecondFloor mat={mat} />
      <ToiletDecor b={getBuilding("toilet")!} mat={mat} />
      <ParadeDecor mat={mat} />
      <CafeteriaDecor b={getBuilding("cafeteria")!} mat={mat} />
      <WorkshopDecor b={getBuilding("workshop")!} mat={mat} />
      <LaundryDecor b={getBuilding("laundry")!} mat={mat} />
      <InfirmaryDecor b={getBuilding("infirmary")!} mat={mat} />
      <LinkGate mat={mat.steel} />
      <MainGate mat={mat} />
      {TOWERS.map((t, i) => (
        <Watchtower key={i} at={t} mat={mat} />
      ))}
    </group>
  );
}

export default function GameMap() {
  const mat = useMaterials();

  return (
    <group>
      {/* 베이스 지면(개활지) — 건물 바닥은 이 위에 색으로 얹힌다. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 76]} />
        <meshStandardMaterial color="#20242c" roughness={1} metalness={0} />
      </mesh>

      {/* 구역 바닥(건물별 색 — 연병장은 모래색) */}
      {FLOORS.map((f, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[(f.rect.x0 + f.rect.x1) / 2, 0, (f.rect.z0 + f.rect.z1) / 2]}
          receiveShadow
        >
          <planeGeometry args={[Math.abs(f.rect.x1 - f.rect.x0), Math.abs(f.rect.z1 - f.rect.z0)]} />
          <meshStandardMaterial color={f.color} roughness={1} metalness={0} />
        </mesh>
      ))}

      {/* 콘크리트 벽(자동 생성) */}
      {WALL_BOXES.map((w, i) => (
        <mesh
          key={i}
          position={[w.cx, w.h / 2, w.cz]}
          material={mat.concrete}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[w.hx * 2, w.h, w.hz * 2]} />
        </mesh>
      ))}

      {/* 잠금 문(방향별, 방마다 다른 창살 색). 정문(gate-main)은 MainGate가 따로 그린다 */}
      {DOOR_META.filter((d) => d.id !== "gate-main").map((d) => (
        <BarDoor key={d.id} meta={d} mat={barMatFor(mat, d.id)} />
      ))}

      {/* 건물 소품 */}
      <BuildingDecor mat={mat} />

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

"use client";
// 교도소 캠퍼스 맵. 좌표·벽·문·바닥은 prisonLayout.ts(BUILDINGS 스펙에서 자동 생성)를 따른다.
// 이 파일은 그 데이터를 3D로 그리기만 한다: 베이스 지면 + 콘크리트 벽 + 방향별 문 + 건물별 소품.
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import Basketball from "./Basketball";
import Interactable from "./Interactable";
import { INTERACTABLES, isCellDoorOpen, useInteraction } from "./interactables";
import {
  BUILDINGS,
  CELLS,
  DOOR_META,
  FLOORS,
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
      bunk: mk("#4a5568", 0.7, 0.1),
      porcelain: mk("#cbd5e1", 0.5, 0.05),
      wood: mk("#6b5636", 0.8, 0.05),
      table: mk("#8a9099", 0.6, 0.2),
      hoop: mk("#d9542b", 0.5, 0.3),
      track: mk("#7c3b34", 0.9, 0),
      rust: mk("#7a4a32", 0.9, 0.2),
      red: mk("#b4322a", 0.6, 0.2),
      paper: mk("#d8d4c8", 1, 0),
      water: mk("#2a3b4a", 0.15, 0.1),
      ball: mk("#c96a2b", 0.85, 0),
      cloth: mk("#b23b3b", 0.9, 0),
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

// ── 감방 내부: 이층 침상 + 변기 ───────────────────────────────────
function CellInterior({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const z = cz(b);
  const wx = b.rect.x0 + 1.4; // 서쪽 벽 앞
  const tx = b.rect.x1 - 1.3; // 동쪽 구석
  const tz = b.rect.z0 + 1.3; // 안쪽(남) 구석
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

// ── 연병장: 감시탑 + 트랙 + 연단 + 깃대 + 벤치 + 농구골대(+공) ──────
function ParadeDecor({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const { cx: px, cz: pz } = YARD;
  return (
    <group>
      {/* 러닝 트랙 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[px, 0.02, pz]} material={mat.track}>
        <ringGeometry args={[9, 11, 56]} />
      </mesh>
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
      {/* 연단(북쪽) */}
      <mesh position={[px, 0.5, pz + 16]} material={mat.concrete} castShadow receiveShadow>
        <boxGeometry args={[10, 1, 3]} />
      </mesh>
      {/* 깃대 */}
      <group position={[px - 14, 0, pz + 16]}>
        <mesh position={[0, 4, 0]} material={mat.steel} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 8, 8]} />
        </mesh>
        <mesh position={[0.9, 7, 0]} material={mat.cloth}>
          <boxGeometry args={[1.6, 1, 0.05]} />
        </mesh>
      </group>
      {/* 감시탑(북동 모서리) */}
      <group position={[px + 14, 0, pz + 14]}>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * 1.2, 3, sz * 1.2]} material={mat.steel} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 6, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 6.1, 0]} material={mat.steel} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.2, 3.4]} />
        </mesh>
        <mesh position={[0, 7.6, 0]} material={mat.steel} castShadow>
          <boxGeometry args={[3.8, 0.15, 3.8]} />
        </mesh>
      </group>
      {/* 벤치 2개 */}
      {[pz - 14, pz + 12].map((bz, i) => (
        <mesh key={i} position={[px - 12, 0.45, bz]} material={mat.wood} castShadow receiveShadow>
          <boxGeometry args={[5, 0.18, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 식당: 식탁 여러 개 + 배식대 ───────────────────────────────────
function CafeteriaDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  const z = cz(b);
  return (
    <group>
      {[-6, 6].flatMap((dx) =>
        [-8, 0, 8].map((dz) => (
          <group key={`${dx}_${dz}`} position={[x + dx, 0, z + dz]}>
            <mesh position={[0, 0.75, 0]} material={mat.table} castShadow receiveShadow>
              <boxGeometry args={[1.4, 0.1, 3.2]} />
            </mesh>
            {[-0.95, 0.95].map((bx, i) => (
              <mesh key={i} position={[bx, 0.42, 0]} material={mat.wood} castShadow>
                <boxGeometry args={[0.4, 0.1, 3]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* 배식대(서벽 앞) */}
      <mesh position={[b.rect.x0 + 1.5, 0.6, z]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[1, 1.2, 12]} />
      </mesh>
    </group>
  );
}

// ── 작업장: 작업대 + 공구판 + 상자 ───────────────────────────────
function WorkshopDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  const z = cz(b);
  return (
    <group>
      <mesh position={[x, 0.85, z + 8]} material={mat.table} castShadow receiveShadow>
        <boxGeometry args={[8, 0.12, 1.4]} />
      </mesh>
      <mesh position={[x, 1.9, b.rect.z1 - 0.6]} material={mat.wood} castShadow>
        <boxGeometry args={[6, 1.6, 0.12]} />
      </mesh>
      {[-4, -2, 0, 2, 4].map((dx, i) => (
        <mesh key={i} position={[x + dx, 0.5, z - 6]} material={mat.wood} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 세탁실: 세탁기 여러 대 + 카트 ─────────────────────────────────
function LaundryDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  const z = cz(b);
  return (
    <group>
      {[-6, -2, 2, 6].map((dz, i) => (
        <group key={i} position={[b.rect.x0 + 1.5, 0, z + dz]}>
          <mesh position={[0, 0.7, 0]} material={mat.steel} castShadow receiveShadow>
            <boxGeometry args={[1.6, 1.4, 1.8]} />
          </mesh>
          <mesh position={[0.82, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} material={mat.porcelain}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 20]} />
          </mesh>
        </group>
      ))}
      <mesh position={[x + 3, 0.6, z - 6]} material={mat.rust} castShadow receiveShadow>
        <boxGeometry args={[1.4, 1, 1]} />
      </mesh>
    </group>
  );
}

// ── 의무실: 침대 여러 + 약장 + 십자 ──────────────────────────────
function InfirmaryDecor({ b, mat }: { b: Building; mat: ReturnType<typeof useMaterials> }) {
  const x = cx(b);
  const z = cz(b);
  return (
    <group>
      {[-7, 0, 7].map((dz, i) => (
        <mesh key={i} position={[b.rect.x0 + 2, 0.5, z + dz]} material={mat.porcelain} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.25, 2.6]} />
        </mesh>
      ))}
      <mesh position={[b.rect.x1 - 1.5, 1, z]} material={mat.steel} castShadow receiveShadow>
        <boxGeometry args={[1, 2, 3]} />
      </mesh>
      <group position={[x, 2.1, b.rect.z0 + 0.4]}>
        <mesh material={mat.red}><boxGeometry args={[0.9, 0.26, 0.08]} /></mesh>
        <mesh material={mat.red}><boxGeometry args={[0.26, 0.9, 0.08]} /></mesh>
      </group>
    </group>
  );
}

// ── 교도소 정문: 콘크리트 기둥 둘 + 상인방. 최종 탈출구(escape-gate)가 여기 있다 ──
function MainGate({ mat }: { mat: ReturnType<typeof useMaterials> }) {
  const gz = -55; // 외벽(z=-56) 바로 안쪽 — 교도소 정문
  return (
    <group>
      {[-4, 4].map((gx, i) => (
        <mesh key={i} position={[gx, 2.5, gz]} material={mat.concrete} castShadow>
          <boxGeometry args={[1, 5, 1]} />
        </mesh>
      ))}
      <mesh position={[0, 5.2, gz]} material={mat.concrete} castShadow>
        <boxGeometry args={[9.5, 0.8, 1]} />
      </mesh>
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
      <ParadeDecor mat={mat} />
      <CafeteriaDecor b={getBuilding("cafeteria")!} mat={mat} />
      <WorkshopDecor b={getBuilding("workshop")!} mat={mat} />
      <LaundryDecor b={getBuilding("laundry")!} mat={mat} />
      <InfirmaryDecor b={getBuilding("infirmary")!} mat={mat} />
      <MainGate mat={mat} />
    </group>
  );
}

export default function GameMap() {
  const mat = useMaterials();

  return (
    <group>
      {/* 베이스 지면(개활지) — 건물 바닥은 이 위에 색으로 얹힌다. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[170, 130]} />
        <meshStandardMaterial color="#20242c" roughness={1} metalness={0} />
      </mesh>

      {/* 구역 바닥(건물별 색) */}
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

      {/* 잠금 문(방향별) */}
      {DOOR_META.map((d) => (
        <BarDoor key={d.id} meta={d} mat={mat.steel} />
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

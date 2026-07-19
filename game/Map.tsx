"use client";
// 감옥 맵. 좌표·벽은 prisonLayout.ts(충돌과 공유)를 따른다.
//   감방블록(창살·감방문·침상) + 동/서 통로 + 운동장(담·농구골대·트랙) + 식당(식탁·배식대)
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import Interactable from "./Interactable";
import { INTERACTABLES, isCellDoorOpen, useInteraction } from "./interactables";
import {
  BAR_SEGMENTS,
  CAFETERIA,
  CELLS,
  DOOR_W,
  FLOORS,
  SOLID_WALLS,
  WALL_H,
  WALL_T,
  YARD,
  type Cell,
  type Rect,
} from "./prisonLayout";

const BAR_SPACING = 0.85;
const BAR_W = 0.08;

const rectW = (r: Rect) => Math.abs(r.x1 - r.x0);
const rectD = (r: Rect) => Math.abs(r.z1 - r.z0);
const rectCX = (r: Rect) => (r.x0 + r.x1) / 2;
const rectCZ = (r: Rect) => (r.z0 + r.z1) / 2;

function useMaterials() {
  return useMemo(() => {
    const mk = (
      color: string,
      roughness: number,
      metalness: number,
    ): THREE.MeshStandardMaterial =>
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
    };
  }, []);
}

// ── 창살 한 세그먼트(수직 바 + 상·하 레일) ─────────────────────────
function BarredFront({
  z,
  x0,
  x1,
  mat,
}: {
  z: number;
  x0: number;
  x1: number;
  mat: THREE.Material;
}) {
  const bars = useMemo(() => {
    const len = x1 - x0;
    const n = Math.max(2, Math.round(len / BAR_SPACING));
    const step = len / n;
    return Array.from({ length: n + 1 }, (_, i) => x0 + i * step);
  }, [x0, x1]);
  const cx = (x0 + x1) / 2;
  const len = x1 - x0;
  return (
    <group>
      {bars.map((x, i) => (
        <mesh key={i} position={[x, WALL_H / 2, z]} material={mat}>
          <boxGeometry args={[BAR_W, WALL_H, BAR_W]} />
        </mesh>
      ))}
      <mesh position={[cx, WALL_H - 0.15, z]} material={mat}>
        <boxGeometry args={[len, 0.12, 0.14]} />
      </mesh>
      <mesh position={[cx, 0.2, z]} material={mat}>
        <boxGeometry args={[len, 0.12, 0.14]} />
      </mesh>
    </group>
  );
}

// ── 감방문: 닫혀 시작. 그 방의 자물쇠(미션)를 풀면 경첩 회전으로 스윙 오픈. ──
function CellDoor({
  id,
  pos,
  side,
  mat,
}: {
  id: string;
  pos: [number, number];
  side: 1 | -1;
  mat: THREE.Material;
}) {
  const [x, z] = pos;
  const nBars = 4;
  const open = useInteraction((s) => isCellDoorOpen(id, s.solved));
  const panel = useRef<THREE.Group>(null);

  // 닫힘(0) ↔ 열림(side*1.75)으로 부드럽게 감쇠 보간
  useFrame((_, dt) => {
    if (!panel.current) return;
    const target = open ? side * 1.75 : 0;
    panel.current.rotation.y = THREE.MathUtils.damp(
      panel.current.rotation.y,
      target,
      5,
      dt,
    );
  });

  return (
    <group position={[x - DOOR_W / 2, 0, z]}>
      {/* 문틀 기둥 2개 */}
      <mesh position={[0, WALL_H / 2, 0]} material={mat}>
        <boxGeometry args={[0.14, WALL_H, 0.18]} />
      </mesh>
      <mesh position={[DOOR_W, WALL_H / 2, 0]} material={mat}>
        <boxGeometry args={[0.14, WALL_H, 0.18]} />
      </mesh>
      {/* 문짝(경첩=왼쪽 기둥 기준 회전) */}
      <group ref={panel}>
        <mesh position={[DOOR_W / 2, WALL_H - 0.3, 0]} material={mat}>
          <boxGeometry args={[DOOR_W, 0.1, 0.1]} />
        </mesh>
        <mesh position={[DOOR_W / 2, 0.25, 0]} material={mat}>
          <boxGeometry args={[DOOR_W, 0.1, 0.1]} />
        </mesh>
        {Array.from({ length: nBars }, (_, i) => {
          const bx = ((i + 0.5) / nBars) * DOOR_W;
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
function CellInterior({
  cell,
  bunkMat,
  steelMat,
  porcelainMat,
}: {
  cell: Cell;
  bunkMat: THREE.Material;
  steelMat: THREE.Material;
  porcelainMat: THREE.Material;
}) {
  const outerX = cell.cx < 0 ? -14 + WALL_T + 0.5 : 14 - WALL_T - 0.5;
  const toiletX = cell.cx < 0 ? cell.cx + 2.8 : cell.cx - 2.8;
  const toiletZ = cell.cz + -cell.side * 2.8;
  return (
    <group>
      {[0.55, 1.55].map((y, i) => (
        <mesh key={i} position={[outerX, y, cell.cz]} material={bunkMat} castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.16, 3]} />
        </mesh>
      ))}
      {[-1.3, 1.3].map((dz, i) => (
        <mesh key={i} position={[outerX, 1.05, cell.cz + dz]} material={steelMat} castShadow>
          <boxGeometry args={[0.08, 2.1, 0.08]} />
        </mesh>
      ))}
      <mesh position={[toiletX, 0.3, toiletZ]} material={porcelainMat} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.6, 16]} />
      </mesh>
    </group>
  );
}

// ── 운동장: 농구골대 + 러닝 트랙 + 벤치 ───────────────────────────
function Yard({
  steel,
  hoop,
  track,
  wood,
}: {
  steel: THREE.Material;
  hoop: THREE.Material;
  track: THREE.Material;
  wood: THREE.Material;
}) {
  const { cx, cz } = YARD;
  return (
    <group>
      {/* 러닝 트랙(바닥 위 얇은 링) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} material={track}>
        <ringGeometry args={[7, 8.2, 48]} />
      </mesh>
      {/* 농구골대(동쪽 담 앞) */}
      <group position={[cx + 7.5, 0, cz]}>
        <mesh position={[0, 1.5, 0]} material={steel} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 3, 12]} />
        </mesh>
        <mesh position={[-0.4, 3, 0]} material={steel} castShadow>
          <boxGeometry args={[0.1, 1.1, 1.8]} />
        </mesh>
        <mesh position={[-0.75, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]} material={hoop}>
          <torusGeometry args={[0.34, 0.04, 8, 20]} />
        </mesh>
      </group>
      {/* 벤치 2개(북·남 담 앞) */}
      {[cz + 11, cz - 11].map((bz, i) => (
        <mesh key={i} position={[cx - 6, 0.45, bz]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[4, 0.18, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

// ── 식당: 식탁+벤치 여러 개 + 배식대 ──────────────────────────────
function Cafeteria({
  table,
  wood,
  steel,
}: {
  table: THREE.Material;
  wood: THREE.Material;
  steel: THREE.Material;
}) {
  const { cx } = CAFETERIA;
  const cols = [-6, 6];
  const rows = [-6.5, 0, 6.5];
  return (
    <group>
      {cols.flatMap((dx) =>
        rows.map((dz) => (
          <group key={`${dx}_${dz}`} position={[cx + dx, 0, dz]}>
            {/* 식탁 상판 + 다리 */}
            <mesh position={[0, 0.75, 0]} material={table} castShadow receiveShadow>
              <boxGeometry args={[1.4, 0.1, 3.2]} />
            </mesh>
            <mesh position={[0, 0.38, 0]} material={steel} castShadow>
              <boxGeometry args={[0.1, 0.75, 3]} />
            </mesh>
            {/* 벤치 2줄 */}
            {[-0.95, 0.95].map((bx, i) => (
              <mesh key={i} position={[bx, 0.42, 0]} material={wood} castShadow receiveShadow>
                <boxGeometry args={[0.4, 0.1, 3]} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* 배식대(서쪽 벽 앞) */}
      <mesh position={[cx - 7.5, 0.6, 0]} material={steel} castShadow receiveShadow>
        <boxGeometry args={[1, 1.2, 10]} />
      </mesh>
    </group>
  );
}

// ── 라벨 ──────────────────────────────────────────────────────────
function Label({ pos, text }: { pos: [number, number, number]; text: string }) {
  return (
    <Html position={pos} center distanceFactor={20}>
      <div className="pointer-events-none select-none whitespace-nowrap rounded bg-black/55 px-2 py-0.5 text-sm font-semibold text-amber-200">
        {text}
      </div>
    </Html>
  );
}

export default function GameMap() {
  const mat = useMaterials();

  return (
    <group>
      {/* 바닥(구역별) */}
      {FLOORS.map((f, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[rectCX(f.rect), 0, rectCZ(f.rect)]}
          receiveShadow
        >
          <planeGeometry args={[rectW(f.rect), rectD(f.rect)]} />
          <meshStandardMaterial color={f.color} roughness={1} metalness={0} />
        </mesh>
      ))}

      {/* 콘크리트 솔리드 벽 */}
      {SOLID_WALLS.map((w, i) => {
        const h = w.h ?? WALL_H;
        return (
          <mesh
            key={i}
            position={[rectCX(w.rect), h / 2, rectCZ(w.rect)]}
            material={mat.concrete}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[rectW(w.rect), h, rectD(w.rect)]} />
          </mesh>
        );
      })}

      {/* 감방 정면 창살 */}
      {BAR_SEGMENTS.map((s, i) => (
        <BarredFront key={i} z={s.z} x0={s.x0} x1={s.x1} mat={mat.steel} />
      ))}

      {/* 감방: 문 + 내부 + 라벨 */}
      {CELLS.map((cell) => (
        <group key={cell.id}>
          <CellDoor
            id={`cell-${cell.id}`}
            pos={cell.door}
            side={cell.side}
            mat={mat.steel}
          />
          <CellInterior
            cell={cell}
            bunkMat={mat.bunk}
            steelMat={mat.steel}
            porcelainMat={mat.porcelain}
          />
          <Label pos={[cell.cx, WALL_H - 0.4, cell.cz]} text={cell.label} />
        </group>
      ))}

      {/* 운동장 / 식당 */}
      <Yard steel={mat.steel} hoop={mat.hoop} track={mat.track} wood={mat.wood} />
      <Cafeteria table={mat.table} wood={mat.wood} steel={mat.steel} />
      <Label pos={[YARD.cx, 3.4, YARD.cz + 12.5]} text="운동장" />
      <Label pos={[CAFETERIA.cx, 2.6, CAFETERIA.cz + 10.5]} text="식당" />

      {/* 상호작용 오브젝트 */}
      {INTERACTABLES.map((it) => (
        <Interactable key={it.id} data={it} />
      ))}
    </group>
  );
}

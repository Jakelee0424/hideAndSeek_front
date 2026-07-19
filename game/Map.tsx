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
  YARD_WALL_H,
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
      // ── 소품용 ──
      rust: mk("#7a4a32", 0.9, 0.2), // 녹슨 철: 철조망·파이프
      red: mk("#b4322a", 0.6, 0.2), // 소화전
      cork: mk("#8a6b46", 0.95, 0), // 게시판 코르크
      paper: mk("#d8d4c8", 1, 0), // 게시물·트레이 종이
      lamp: mk("#fff3d0", 0.4, 0), // 형광등 커버
      water: mk("#2a3b4a", 0.15, 0.1), // 물웅덩이(젖은 바닥)
      ball: mk("#c96a2b", 0.85, 0), // 농구공
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
  rust,
  ball,
  water,
}: {
  steel: THREE.Material;
  hoop: THREE.Material;
  track: THREE.Material;
  wood: THREE.Material;
  rust: THREE.Material;
  ball: THREE.Material;
  water: THREE.Material;
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

      {/* 담 위 철조망 — 가로줄 3단. 담 안쪽으로 살짝 들여 벽면과 z-fighting을 피한다. */}
      {[0.35, 0.75, 1.15].map((dy, i) => (
        <group key={i}>
          <mesh position={[43.6, YARD_WALL_H + dy, cz]} material={rust}>
            <boxGeometry args={[0.05, 0.05, 27.6]} />
          </mesh>
          {[13.6, -13.6].map((dz, j) => (
            <mesh key={j} position={[35, YARD_WALL_H + dy, cz + dz]} material={rust}>
              <boxGeometry args={[17.6, 0.05, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* 철조망 지지 기둥 */}
      {[-13.6, 0, 13.6].map((dz, i) => (
        <mesh key={i} position={[43.6, YARD_WALL_H + 0.75, cz + dz]} material={rust} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.5, 6]} />
        </mesh>
      ))}

      {/* 감시탑(북동 모서리) — 기둥 4 + 바닥 + 지붕 */}
      <group position={[cx + 6.5, 0, cz + 11]}>
        {[
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * 1.1, 2.5, sz * 1.1]} material={steel} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 5, 8]} />
          </mesh>
        ))}
        <mesh position={[0, 5.1, 0]} material={steel} castShadow receiveShadow>
          <boxGeometry args={[3, 0.2, 3]} />
        </mesh>
        <mesh position={[0, 6.6, 0]} material={steel} castShadow>
          <boxGeometry args={[3.4, 0.15, 3.4]} />
        </mesh>
      </group>

      {/* 농구공 — 골대 아래 굴러다니는 것 */}
      <mesh position={[cx + 5.8, 0.24, cz - 1.6]} material={ball} castShadow>
        <sphereGeometry args={[0.24, 16, 12]} />
      </mesh>

      {/* 물웅덩이 — 비 온 뒤 흔적. 바닥에 눕힌 얇은 원. */}
      {[
        [-4.5, 5.5, 1.6],
        [2.5, -6.5, 1.1],
        [-8, -3, 0.8],
      ].map(([dx, dz, r], i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[cx + dx, 0.015, cz + dz]}
          material={water}
        >
          <circleGeometry args={[r, 20]} />
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
  paper,
}: {
  table: THREE.Material;
  wood: THREE.Material;
  steel: THREE.Material;
  paper: THREE.Material;
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

      {/* 배식 트레이 더미 — 배식대 위에 살짝 어긋나게 쌓인 것 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[cx - 7.5, 1.24 + i * 0.05, 3.2 + (i % 2) * 0.06]}
          rotation={[0, i * 0.05, 0]}
          material={paper}
          castShadow
        >
          <boxGeometry args={[0.62, 0.04, 0.44]} />
        </mesh>
      ))}

      {/* 엎어진 의자 2개 — 급히 빠져나간 흔적. 눕혀서 다리가 옆으로 향한다. */}
      {[
        [2.5, 9.2, 0.7],
        [-2.2, -9.4, -1.1],
      ].map(([dx, dz, rot], i) => (
        <group key={i} position={[cx + dx, 0.22, dz]} rotation={[0, rot, Math.PI / 2]}>
          <mesh material={wood} castShadow>
            <boxGeometry args={[0.44, 0.08, 0.44]} />
          </mesh>
          {[
            [-0.17, -0.17],
            [0.17, -0.17],
            [-0.17, 0.17],
            [0.17, 0.17],
          ].map(([lx, lz], j) => (
            <mesh key={j} position={[lx, -0.24, lz]} material={steel}>
              <cylinderGeometry args={[0.025, 0.025, 0.44, 6]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 벽시계 — 동쪽 벽면. 판 + 시침·분침 */}
      <group position={[cx + 8.9, 2.6, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={paper}>
          <cylinderGeometry args={[0.42, 0.42, 0.07, 20]} />
        </mesh>
        <mesh position={[0, 0.05, -0.11]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
          <boxGeometry args={[0.04, 0.22, 0.02]} />
        </mesh>
        <mesh position={[0.14, 0.05, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} material={steel}>
          <boxGeometry args={[0.03, 0.3, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

// ── 통로 소품: 소화전 · 게시판 · 파이프 · 깜빡이는 형광등 ──────────
//
// 통로는 z가 -2.5~2.5로 좁다. 소품은 전부 벽에 붙여 두 벽 사이 통행로를 비워야 한다
// (충돌은 벽만 계산하므로 통로 한가운데 두면 몸이 통과해 버려 더 어색하다).
function CorridorProps({
  steel,
  rust,
  red,
  cork,
  paper,
  lamp,
}: {
  steel: THREE.Material;
  rust: THREE.Material;
  red: THREE.Material;
  cork: THREE.Material;
  paper: THREE.Material;
  lamp: THREE.Material;
}) {
  // 동·서 통로의 x 범위: 14~26, -26~-14
  const runs = [
    { from: 14.5, to: 25.5 },
    { from: -25.5, to: -14.5 },
  ];

  return (
    <group>
      {runs.map((run, ri) => {
        const mid = (run.from + run.to) / 2;
        return (
          <group key={ri}>
            {/* 천장 배관 2줄 — 통로를 따라 길게 */}
            {[-1.9, 1.9].map((pz, i) => (
              <mesh
                key={i}
                position={[mid, 2.7, pz]}
                rotation={[0, 0, Math.PI / 2]}
                material={rust}
                castShadow
              >
                <cylinderGeometry args={[0.09, 0.09, Math.abs(run.to - run.from), 8]} />
              </mesh>
            ))}
            {/* 배관 고정 밴드 */}
            {[0.25, 0.5, 0.75].map((t, i) => (
              <mesh
                key={i}
                position={[run.from + (run.to - run.from) * t, 2.7, 1.9]}
                rotation={[0, 0, Math.PI / 2]}
                material={steel}
              >
                <cylinderGeometry args={[0.13, 0.13, 0.08, 8]} />
              </mesh>
            ))}
            {/* 소화전 — 남쪽 벽에 붙임 */}
            <group position={[run.from + (run.to - run.from) * 0.3, 0.9, -2.2]}>
              <mesh material={red} castShadow>
                <boxGeometry args={[0.42, 0.62, 0.22]} />
              </mesh>
              <mesh position={[0, 0, 0.14]} material={steel}>
                <cylinderGeometry args={[0.07, 0.07, 0.12, 10]} />
              </mesh>
            </group>
            {/* 게시판 — 북쪽 벽. 코르크 판 + 종이 몇 장 */}
            <group position={[run.from + (run.to - run.from) * 0.65, 1.7, 2.24]}>
              <mesh material={cork} castShadow>
                <boxGeometry args={[1.8, 1.1, 0.06]} />
              </mesh>
              {[
                [-0.5, 0.22, 0.06],
                [0.15, 0.28, -0.05],
                [0.55, -0.2, 0.09],
              ].map(([px, py, rot], i) => (
                <mesh key={i} position={[px, py, -0.04]} rotation={[0, 0, rot]} material={paper}>
                  <boxGeometry args={[0.42, 0.56, 0.01]} />
                </mesh>
              ))}
            </group>
            {/* 형광등 2개 — 하나는 깜빡인다 */}
            <FlickerLamp pos={[run.from + (run.to - run.from) * 0.25, 2.85, 0]} mat={lamp} steady />
            <FlickerLamp pos={[run.from + (run.to - run.from) * 0.75, 2.85, 0]} mat={lamp} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * 형광등. steady가 아니면 불규칙하게 깜빡인다.
 *
 * 광원(PointLight)을 켜지 않고 **재질의 emissive만** 흔든다. t2.micro에서 돌리는 게임이라
 * 실광원을 늘리면 셰이더가 매번 다시 컴파일되고 프레임이 떨어진다.
 */
function FlickerLamp({
  pos,
  mat,
  steady = false,
}: {
  pos: [number, number, number];
  mat: THREE.Material;
  steady?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  // 등마다 다른 위상 — 전부 같이 깜빡이면 기계적으로 보인다.
  const seed = useMemo(() => Math.random() * 10, []);
  const own = useMemo(() => (mat as THREE.MeshStandardMaterial).clone(), [mat]);

  useFrame((state) => {
    if (steady || !ref.current) return;
    const t = state.clock.elapsedTime + seed;
    // 대체로 켜져 있다가 가끔 훅 꺼진다(사인 두 개를 겹쳐 주기를 흐트러뜨린다).
    const n = Math.sin(t * 11) * Math.sin(t * 3.3);
    const on = n > -0.72 ? 1 : 0.06;
    (own as THREE.MeshStandardMaterial).emissiveIntensity = on;
  });

  useMemo(() => {
    const m = own as THREE.MeshStandardMaterial;
    m.emissive = new THREE.Color("#fff3d0");
    m.emissiveIntensity = 1;
  }, [own]);

  return (
    <mesh ref={ref} position={pos} material={own}>
      <boxGeometry args={[1.6, 0.08, 0.3]} />
    </mesh>
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
      <Yard
        steel={mat.steel}
        hoop={mat.hoop}
        track={mat.track}
        wood={mat.wood}
        rust={mat.rust}
        ball={mat.ball}
        water={mat.water}
      />
      <Cafeteria table={mat.table} wood={mat.wood} steel={mat.steel} paper={mat.paper} />
      <CorridorProps
        steel={mat.steel}
        rust={mat.rust}
        red={mat.red}
        cork={mat.cork}
        paper={mat.paper}
        lamp={mat.lamp}
      />
      <Label pos={[YARD.cx, 3.4, YARD.cz + 12.5]} text="운동장" />
      <Label pos={[CAFETERIA.cx, 2.6, CAFETERIA.cz + 10.5]} text="식당" />

      {/* 상호작용 오브젝트 */}
      {INTERACTABLES.map((it) => (
        <Interactable key={it.id} data={it} />
      ))}
    </group>
  );
}

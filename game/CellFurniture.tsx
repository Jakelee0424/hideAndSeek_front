"use client";
// 감방 내부 절차적 가구 — OBJ 에셋에 없는 1인용 침대·벽걸이 TV·책상·스툴·가벽을 직접 만든다.
// 배치 좌표·회전은 prisonLayout.cellFurniture(단일 소스)가 정하고, 여기서는 모양만 그린다.
// 모든 컴포넌트는 로컬 +z를 "앞"으로 삼는다(뒷벽 부착물은 rotationY=faceIn으로 방 안을 보게 한다).
// 저폴리 씬 톤에 맞춰 flatShading을 켠다(에셋 프리팹과 같은 방식).
//
// ⚠️ 여기 가구는 **그림자를 만들지 않는다**(castShadow 없음, receiveShadow만). 감방은 감방동
//    지붕(Map.CellBlockRoof, castShadow) 아래라 태양광이 아예 닿지 않는다 — 즉 이 가구들이
//    드리울 그림자는 화면에 나타날 수가 없는데, 그림자 패스는 꼬박꼬박 다시 그린다.
//    감방 4개 × 1·2층 = 8벌이라 그것만으로 프레임마다 수백 번의 헛 드로우콜이었다.
//    (연병장처럼 하늘이 열린 곳의 소품은 그대로 둔다 — 거긴 그림자가 실제로 보인다.)
import type { JSX } from "react";

type V3 = [number, number, number];

const STEEL = "#7c828c";
const STEEL_DK = "#4c5158";

/**
 * 1인용 침대(강철 프레임 + 매트리스 + 베개 + 담요). 로컬 -z가 머리(베개), +z가 발치.
 * length = 프레임 길이(z) — 방 깊이의 3/4를 채우도록 호출부(cellFurniture)가 넘긴다.
 * ⚠️ length는 충돌 박스(CELL_FURN_SIZE.bed.hz*2)와 맞춘다.
 */
export function Bed({
  position,
  rotationY = 0,
  length = 6.0,
  width = 1.55,
}: {
  position: V3;
  rotationY?: number;
  length?: number;
  width?: number;
}): JSX.Element {
  const L = length; // 프레임 길이(z)
  const W = width; // 프레임 폭(x)
  const legH = 0.32;
  const legs: V3[] = [
    [-W / 2 + 0.08, legH / 2, -L / 2 + 0.08],
    [W / 2 - 0.08, legH / 2, -L / 2 + 0.08],
    [-W / 2 + 0.08, legH / 2, L / 2 - 0.08],
    [W / 2 - 0.08, legH / 2, L / 2 - 0.08],
  ];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 다리 4개 */}
      {legs.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.1, legH, 0.1]} />
          <meshStandardMaterial color={STEEL_DK} roughness={0.55} metalness={0.35} flatShading />
        </mesh>
      ))}
      {/* 프레임 상판 */}
      <mesh position={[0, legH + 0.06, 0]} receiveShadow>
        <boxGeometry args={[W, 0.12, L]} />
        <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
      </mesh>
      {/* 머리판(로컬 -z) */}
      <mesh position={[0, legH + 0.38, -L / 2 + 0.04]}>
        <boxGeometry args={[W, 0.68, 0.08]} />
        <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
      </mesh>
      {/* 매트리스 */}
      <mesh position={[0, legH + 0.22, 0.04]} receiveShadow>
        <boxGeometry args={[W - 0.1, 0.18, L - 0.2]} />
        <meshStandardMaterial color="#c9c2b1" roughness={0.95} flatShading />
      </mesh>
      {/* 담요(발치 절반 덮기) */}
      <mesh position={[0, legH + 0.32, L / 4]}>
        <boxGeometry args={[W - 0.06, 0.08, L / 2 - 0.16]} />
        <meshStandardMaterial color="#586274" roughness={0.95} flatShading />
      </mesh>
      {/* 베개(머리쪽) */}
      <mesh position={[0, legH + 0.36, -L / 2 + 0.42]}>
        <boxGeometry args={[W - 0.22, 0.16, 0.44]} />
        <meshStandardMaterial color="#e7e3d8" roughness={0.95} flatShading />
      </mesh>
    </group>
  );
}

/** 벽걸이 평면 TV. 화면은 로컬 +z를 향한다(은은한 발광으로 어두운 감옥에서 형태가 보이게). */
export function WallTV({ position, rotationY = 0 }: { position: V3; rotationY?: number }): JSX.Element {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 베젤(지금의 1/4 크기로 축소 — 침대 발치 벽에 소형 TV) */}
      <mesh>
        <boxGeometry args={[0.64, 0.39, 0.05]} />
        <meshStandardMaterial color="#17181c" roughness={0.5} metalness={0.3} flatShading />
      </mesh>
      {/* 화면 */}
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[0.58, 0.33]} />
        <meshStandardMaterial color="#0e2033" emissive="#16324f" emissiveIntensity={0.5} roughness={0.35} />
      </mesh>
      {/* 벽 브래킷 */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[0.12, 0.12, 0.06]} />
        <meshStandardMaterial color={STEEL_DK} roughness={0.6} metalness={0.35} flatShading />
      </mesh>
    </group>
  );
}

/** 책상(라미네이트 상판 + 강철 옆판). width×depth는 충돌 박스(CELL_FURN_SIZE.desk)와 맞춘다. */
export function Desk({
  position,
  rotationY = 0,
  width = 2.2,
  depth = 0.75,
}: {
  position: V3;
  rotationY?: number;
  width?: number;
  depth?: number;
}): JSX.Element {
  const W = width;
  const D = depth;
  const topY = 0.9;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 상판 */}
      <mesh position={[0, topY, 0]} receiveShadow>
        <boxGeometry args={[W, 0.07, D]} />
        <meshStandardMaterial color="#9a8f76" roughness={0.7} metalness={0.05} flatShading />
      </mesh>
      {/* 옆판 2개 */}
      {[-W / 2 + 0.04, W / 2 - 0.04].map((x, i) => (
        <mesh key={i} position={[x, topY / 2, 0]}>
          <boxGeometry args={[0.07, topY, D - 0.08]} />
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
        </mesh>
      ))}
      {/* 뒤 가림판은 제거(책상 뒤 흰 벽처럼 보임) — 상판+옆판만 남긴다 */}
    </group>
  );
}

/** 스툴(강철 다리 원형 좌판). */
export function Stool({ position, rotationY = 0 }: { position: V3; rotationY?: number }): JSX.Element {
  const seatY = 0.46;
  const legs: V3[] = [
    [-0.15, seatY / 2, -0.15],
    [0.15, seatY / 2, -0.15],
    [-0.15, seatY / 2, 0.15],
    [0.15, seatY / 2, 0.15],
  ];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {legs.map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.04, seatY, 0.04]} />
          <meshStandardMaterial color={STEEL_DK} roughness={0.55} metalness={0.35} flatShading />
        </mesh>
      ))}
      <mesh position={[0, seatY, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.05, 16]} />
        <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
      </mesh>
    </group>
  );
}

const PORCELAIN = "#e9ecee";

/** 변기(받침대+볼+변좌+물탱크). 로컬 +z가 물탱크(벽 쪽), -z가 앞(방 쪽). */
export function Toilet({ position, rotationY = 0 }: { position: V3; rotationY?: number }): JSX.Element {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 받침대 */}
      <mesh position={[0, 0.2, 0.04]} receiveShadow>
        <boxGeometry args={[0.42, 0.4, 0.5]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.35} metalness={0.05} flatShading />
      </mesh>
      {/* 볼 */}
      <mesh position={[0, 0.46, -0.09]}>
        <cylinderGeometry args={[0.26, 0.2, 0.26, 20]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.35} metalness={0.05} flatShading />
      </mesh>
      {/* 변좌(도넛) */}
      <mesh position={[0, 0.59, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.06, 12, 24]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.4} metalness={0.05} flatShading />
      </mesh>
      {/* 물탱크(벽 쪽 +z) */}
      <mesh position={[0, 0.74, 0.28]} receiveShadow>
        <boxGeometry args={[0.5, 0.58, 0.2]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.35} metalness={0.05} flatShading />
      </mesh>
      {/* 뚜껑 */}
      <mesh position={[0, 1.05, 0.28]}>
        <boxGeometry args={[0.54, 0.06, 0.24]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.35} metalness={0.05} flatShading />
      </mesh>
    </group>
  );
}

/** 세면대(기둥형 + 대야 + 수전). 로컬 +z가 벽 쪽. */
export function Sink({ position, rotationY = 0 }: { position: V3; rotationY?: number }): JSX.Element {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 상판 몸통 */}
      <mesh position={[0, 0.85, 0.05]} receiveShadow>
        <boxGeometry args={[0.5, 0.16, 0.42]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.4} metalness={0.05} flatShading />
      </mesh>
      {/* 대야(오목) */}
      <mesh position={[0, 0.9, 0.0]}>
        <cylinderGeometry args={[0.16, 0.13, 0.12, 16]} />
        <meshStandardMaterial color="#d9dde0" roughness={0.4} metalness={0.05} flatShading />
      </mesh>
      {/* 받침 기둥 */}
      <mesh position={[0, 0.42, 0.05]}>
        <cylinderGeometry args={[0.09, 0.11, 0.84, 12]} />
        <meshStandardMaterial color={PORCELAIN} roughness={0.4} metalness={0.05} flatShading />
      </mesh>
      {/* 수전 */}
      <mesh position={[0, 1.0, 0.16]}>
        <boxGeometry args={[0.05, 0.16, 0.05]} />
        <meshStandardMaterial color={STEEL} roughness={0.4} metalness={0.4} flatShading />
      </mesh>
    </group>
  );
}

/**
 * 가벽(비구조 칸막이). 로컬 z축을 따라 길게 세운 얇은 판 — 안쪽에 변기·세면대를 가린다.
 * length = 벽 길이(z), height = 높이. 상단에 강철 테두리를 얹어 판때기 느낌을 줄인다.
 */
export function Partition({
  position,
  rotationY = 0,
  length,
  height = 2.2,
}: {
  position: V3;
  rotationY?: number;
  length: number;
  height?: number;
}): JSX.Element {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <boxGeometry args={[0.1, height, length]} />
        <meshStandardMaterial color="#b3b8bf" roughness={0.85} metalness={0.05} flatShading />
      </mesh>
      {/* 상단 테두리 */}
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[0.16, 0.08, length]} />
        <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
      </mesh>
      {/* 문쪽 끝 기둥 */}
      <mesh position={[0, height / 2, length / 2 - 0.05]}>
        <boxGeometry args={[0.16, height, 0.12]} />
        <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.35} flatShading />
      </mesh>
    </group>
  );
}

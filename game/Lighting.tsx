"use client";
// 실내 온기 램프 + 정문 비컨. 밤 씬(Scene.tsx)의 어스름 위에 "사람이 있는 공간"의 온기와
// 목표 방향을 광원으로 얹는다.
//
// 성능: 감방은 2층 슬래브가 덮어 달빛이 안 드니 방마다 하나씩 필요하다. 그림자는 달빛만
// 지고(directionalLight), 이 램프들은 그림자를 지지 않는다(decay=0 + distance로 국소화).
// 12개 남짓이라 단순한 박스 씬에선 가볍다. 광량은 화면 보고 튜닝(LAMP_* 상수).
//   ⚠️ 좌표는 prisonLayout의 방 중심과 맞춘다 — 맵이 바뀌면 여기도 손볼 것.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GATE } from "./prisonLayout";

const WARM = "#ffb066"; // 백열/나트륨등 느낌
const COOL = "#bcd2ff"; // 화장실·의무실은 형광 느낌으로 살짝 차갑게

const LAMP_I = 0.75; // 방 램프 밝기
const LAMP_D = 18; // 방 램프 도달 거리
const CELL_I = 0.6;
const CELL_D = 12;

interface Lamp {
  pos: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
  flicker?: boolean; // 고장 난 형광등처럼 깜빡인다
}

// prisonLayout BUILDINGS 방 중심 기준(y는 천장 아래). 감방은 슬래브(4.5) 아래 2.4.
const LAMPS: Lamp[] = [
  // 감방(2층 슬래브 아래)
  { pos: [-30, 2.4, 24], color: WARM, intensity: CELL_I, distance: CELL_D },
  { pos: [-14, 2.4, 24], color: WARM, intensity: CELL_I, distance: CELL_D },
  { pos: [-30, 2.4, 10], color: WARM, intensity: CELL_I, distance: CELL_D },
  { pos: [-14, 2.4, 10], color: WARM, intensity: CELL_I, distance: CELL_D },
  // 복도
  { pos: [-22, 2.7, 17], color: WARM, intensity: LAMP_I, distance: LAMP_D, flicker: true },
  { pos: [0, 2.7, 17], color: WARM, intensity: LAMP_I, distance: LAMP_D },
  { pos: [22, 2.7, 17], color: WARM, intensity: LAMP_I, distance: LAMP_D },
  // 별관·부속실
  { pos: [0, 2.7, 24], color: COOL, intensity: LAMP_I, distance: LAMP_D, flicker: true }, // 화장실
  { pos: [14, 2.7, 24], color: WARM, intensity: LAMP_I, distance: LAMP_D }, // 식당
  { pos: [30, 2.7, 24], color: COOL, intensity: LAMP_I, distance: LAMP_D }, // 세탁실
  { pos: [14, 2.7, 10], color: WARM, intensity: LAMP_I, distance: LAMP_D }, // 작업장
  { pos: [30, 2.7, 10], color: COOL, intensity: LAMP_I, distance: LAMP_D }, // 의무실
];

function FlickerLamp({ lamp }: { lamp: Lamp }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const l = ref.current;
    if (!l) return;
    // 결정론적 의사 난수 깜빡임(고장 난 형광등). 대부분 켜져 있고 가끔 튄다.
    const t = state.clock.elapsedTime * 11 + lamp.pos[0];
    const n = Math.sin(t) * Math.sin(t * 2.3) * Math.sin(t * 0.7);
    l.intensity = lamp.intensity * (n > 0.85 ? 0.35 : 1);
  });
  return (
    <pointLight
      ref={ref}
      position={lamp.pos}
      color={lamp.color}
      intensity={lamp.intensity}
      distance={lamp.distance}
      decay={0}
    />
  );
}

export default function Lighting() {
  const gateRef = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    // 정문 비컨: 목표라 은은히 맥동한다.
    const g = gateRef.current;
    if (g) g.intensity = 0.55 + 0.25 * Math.sin(state.clock.elapsedTime * 1.6);
  });

  return (
    <group>
      {LAMPS.map((lamp, i) =>
        lamp.flicker ? (
          <FlickerLamp key={i} lamp={lamp} />
        ) : (
          <pointLight
            key={i}
            position={lamp.pos}
            color={lamp.color}
            intensity={lamp.intensity}
            distance={lamp.distance}
            decay={0}
          />
        ),
      )}

      {/* 정문 비컨: 파란 정문 위에서 목표를 밝힌다(방향 감각). */}
      <pointLight ref={gateRef} position={[GATE.x, 3, GATE.z + 1]} color="#5b8cff" intensity={0.6} distance={22} decay={0} />
      <mesh position={[GATE.x, 3.2, GATE.z + 0.3]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#8fb0ff" />
      </mesh>
    </group>
  );
}

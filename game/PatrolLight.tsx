"use client";
// 순찰 분위기 연출(붉은 경광). 순찰 상태는 서버가 스토어에 실어 준다(patrol).
//   WARNING(예고) — 경광이 은은히 맥동한다. "곧 온다".
//   ACTIVE(순찰)   — 강하고 빠르게 맥동한다.
// 켜져 있을 때만 렌더해 평상시 비용 0.
//
// ⚠️ 예전엔 여기서 서치라이트가 복도를 좌우로 훑었다. 적발 판정이 "순찰 중 맵 어디서든
//    움직이면"이던 시절엔 분위기용으로 무해했지만, 지금은 **간수 시야**가 곧 판정이라
//    (PatrolGuards) 엉뚱한 빛이 훑고 다니면 그게 판정인 줄 오해하게 된다 — 그래서 걷어냈다.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "@/store/gameStore";

const CORRIDOR_Z = 17; // 복도 중심 z(수감동↔별관 라인)

export default function PatrolLight() {
  const patrol = useGameStore((s) => s.patrol);
  const beaconRef = useRef<THREE.PointLight>(null);
  const beaconMat = useRef<THREE.MeshBasicMaterial>(null);

  const active = patrol === "ACTIVE";
  const warning = patrol === "WARNING";
  const on = active || warning;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 경광 맥동: 예고는 은은하게, 순찰 중엔 강하고 빠르게.
    const pulse = 0.5 + 0.5 * Math.sin(t * (active ? 7 : 3));
    if (beaconRef.current) beaconRef.current.intensity = (active ? 1.1 : 0.5) * pulse;
    if (beaconMat.current) beaconMat.current.opacity = 0.35 + 0.5 * pulse;

  });

  if (!on) return null;

  return (
    <group>
      {/* 붉은 경광(복도 중앙 상단) */}
      <pointLight ref={beaconRef} position={[0, 3.2, CORRIDOR_Z]} color="#ff2a2a" intensity={0.5} distance={30} decay={0} />
      <mesh position={[0, 3.4, CORRIDOR_Z]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial ref={beaconMat} color="#ff5a5a" transparent opacity={0.5} />
      </mesh>

    </group>
  );
}

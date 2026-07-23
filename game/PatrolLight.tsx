"use client";
// 순찰 시각 연출. 지금까지 순찰은 상단 텍스트 경고(PatrolOverlay)뿐이라 "멈춰야 한다"가
// 화면으로 전달되지 않았다. 이제:
//   WARNING(예고) — 복도에 붉은 경광이 맥동한다. "곧 온다".
//   ACTIVE(순찰)   — 서치라이트가 복도를 좌우로 훑는다 + 경광이 강해진다.
// 순찰 상태는 서버가 스토어에 실어 준다(patrol). 켜져 있을 때만 렌더해 평상시 비용 0.
//   ⚠️ 순찰 구간은 서버상 MISSION·SHARING의 복도다 — 스윕 경로도 그 복도(z≈17)에 맞춘다.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "@/store/gameStore";

const CORRIDOR_Z = 17; // 복도 중심 z(수감동↔별관 라인)
const SWEEP_AMP = 32; // 좌우로 훑는 폭(±)
const SWEEP_SPEED = 0.9; // 스윕 속도

export default function PatrolLight() {
  const patrol = useGameStore((s) => s.patrol);
  const beaconRef = useRef<THREE.PointLight>(null);
  const beaconMat = useRef<THREE.MeshBasicMaterial>(null);
  const spotRef = useRef<THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);

  const active = patrol === "ACTIVE";
  const warning = patrol === "WARNING";
  const on = active || warning;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // 경광 맥동: 예고는 은은하게, 순찰 중엔 강하고 빠르게.
    const pulse = 0.5 + 0.5 * Math.sin(t * (active ? 7 : 3));
    if (beaconRef.current) beaconRef.current.intensity = (active ? 1.1 : 0.5) * pulse;
    if (beaconMat.current) beaconMat.current.opacity = 0.35 + 0.5 * pulse;

    // 서치라이트 스윕(순찰 중에만).
    if (active && spotRef.current) {
      const x = SWEEP_AMP * Math.sin(t * SWEEP_SPEED);
      target.position.set(x, 0, CORRIDOR_Z);
      target.updateMatrixWorld();
      spotRef.current.target = target;
      spotRef.current.position.set(x * 0.6, 9, CORRIDOR_Z);
    }
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

      {/* 서치라이트 콘(순찰 중에만) */}
      {active && (
        <>
          <primitive object={target} />
          <spotLight
            ref={spotRef}
            position={[0, 9, CORRIDOR_Z]}
            color="#fff2d8"
            intensity={2.2}
            distance={40}
            angle={0.5}
            penumbra={0.6}
            decay={0}
          />
        </>
      )}
    </group>
  );
}

"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import GameMap from "./Map";
import LocalPlayer from "./LocalPlayer";
import RemotePlayers from "./RemotePlayers";
import Lighting from "./Lighting";
import PatrolLight from "./PatrolLight";

// 밤 교도소 톤. "소등·자정·순찰"이 정체성이라 낮처럼 밝히지 않는다. 다만 완전 암전은
// 플레이가 안 되므로, 차가운 달빛 + 옅은 앰비언트를 바닥에 깔아 "어스름"을 유지하고,
// 실내 온기·목표·순찰은 Lighting/PatrolLight가 광원으로 얹는다. 어두운 밤엔 단서가 안 보여
// Interactable이 미해결 오브젝트를 은은히 발광시킨다(세트로 조정).
//   ⚠️ 광량은 화면을 봐야 맞는다 — 아래 값들은 튜닝 대상이다(더 어둡게/밝게는 상수로).
export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 4.5, 6], fov: 60 }}
      gl={{ powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#05070d"]} />
      <fog attach="fog" args={["#05070d", 16, 55]} />

      {/* 밤하늘 + 달 */}
      <Stars radius={120} depth={40} count={1400} factor={4} saturation={0} fade speed={0.4} />
      <mesh position={[-26, 44, -58]}>
        <sphereGeometry args={[5, 24, 24]} />
        <meshBasicMaterial color="#dfe8ff" />
      </mesh>
      <mesh position={[-26, 44, -58]}>
        <sphereGeometry args={[8, 24, 24]} />
        <meshBasicMaterial color="#9fb6ff" transparent opacity={0.12} />
      </mesh>

      {/* 바닥 어스름: 완전 암전 방지용 최소 채움(어두운 밤이되 형체는 보인다) */}
      <ambientLight intensity={0.18} color="#2a3550" />
      <hemisphereLight args={["#3a4a66", "#0a0c12", 0.35]} />

      {/* 달빛(차갑고 낮게, 그림자 담당) */}
      <directionalLight
        position={[-10, 20, -12]}
        intensity={0.55}
        color="#9fb8ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
      />

      {/* 실내 온기 + 정문 비컨 */}
      <Lighting />
      {/* 순찰 서치라이트 + 붉은 경광(순찰 중에만 켜진다) */}
      <PatrolLight />

      <GameMap />
      <Suspense fallback={null}>
        <LocalPlayer />
        <RemotePlayers />
      </Suspense>
    </Canvas>
  );
}

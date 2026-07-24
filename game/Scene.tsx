"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import GameMap from "./Map";
import LocalPlayer from "./LocalPlayer";
import RemotePlayers from "./RemotePlayers";
import PatrolLight from "./PatrolLight";

// 조명은 밝은 기본값(2026-07-23 밤 톤 실험은 "너무 어둡다"로 롤백). 순찰 연출(PatrolLight)과
// 단서 발광·비네트는 조명과 무관해 그대로 둔다.
export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 4.5, 6], fov: 60 }}
      gl={{ powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#0b0f17"]} />
      <fog attach="fog" args={["#0b0f17", 25, 60]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#b9d5ff", "#20242e", 0.5]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* 순찰 서치라이트 + 붉은 경광(순찰 중에만 켜진다) */}
      <PatrolLight />

      <Suspense fallback={null}>
        <GameMap />
      </Suspense>
      <Suspense fallback={null}>
        <LocalPlayer />
        <RemotePlayers />
      </Suspense>
    </Canvas>
  );
}

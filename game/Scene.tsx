"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import GameMap from "./Map";
import LocalPlayer from "./LocalPlayer";
import RemotePlayers from "./RemotePlayers";

export default function Scene() {
  return (
    <Canvas shadows camera={{ position: [0, 6, 9], fov: 60 }}>
      <color attach="background" args={["#0b0f17"]} />
      <fog attach="fog" args={["#0b0f17", 25, 60]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#b9d5ff", "#20242e", 0.5]} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <GameMap />
      <Suspense fallback={null}>
        <LocalPlayer />
        <RemotePlayers />
      </Suspense>
    </Canvas>
  );
}

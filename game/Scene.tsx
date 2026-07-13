"use client";
import { Canvas } from "@react-three/fiber";
import Ground from "./Ground";
import LocalPlayer from "./LocalPlayer";
import RemotePlayers from "./RemotePlayers";

export default function Scene() {
  return (
    <Canvas shadows camera={{ position: [0, 6, 9], fov: 60 }}>
      <color attach="background" args={["#0b0f17"]} />
      <fog attach="fog" args={["#0b0f17", 30, 80]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Ground />
      <LocalPlayer />
      <RemotePlayers />
    </Canvas>
  );
}

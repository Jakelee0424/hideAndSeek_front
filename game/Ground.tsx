"use client";
import { Grid } from "@react-three/drei";

export default function Ground() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.6}
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor="#6b7280"
        cellColor="#4b5563"
        fadeDistance={60}
        infiniteGrid
      />
    </>
  );
}

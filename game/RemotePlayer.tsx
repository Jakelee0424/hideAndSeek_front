"use client";
// 원격 플레이어: 서버 스냅샷 목표값(worldState)으로 매 프레임 보간(lerp/slerp).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldState } from "@/net/worldState";

export default function RemotePlayer({
  id,
  nick,
}: {
  id: string;
  nick: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    const mesh = ref.current;
    const entry = worldState.get(id);
    if (!mesh || !entry) return;

    const t = entry.target;
    const alpha = 1 - Math.pow(0.001, dt); // 프레임레이트 독립 damping
    mesh.position.lerp(
      _target.set(t.position.x, t.position.y + 0.5, t.position.z),
      alpha,
    );
    // 회전은 최단 경로로 보간
    mesh.rotation.y = lerpAngle(mesh.rotation.y, t.rotationY, alpha);
  });

  return (
    <mesh ref={ref} castShadow>
      <capsuleGeometry args={[0.4, 0.8, 8, 16]} />
      <meshStandardMaterial color="#f472b6" />
    </mesh>
  );
}

const _target = new THREE.Vector3();

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

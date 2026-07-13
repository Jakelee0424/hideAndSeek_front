"use client";
// 원격 플레이어: 서버 스냅샷 목표값(worldState)으로 매 프레임 보간(lerp/slerp).
// 애니메이션 상태(idle/walk)는 위치 변화량으로 추정 → 걸을 때 바운스.
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
  const prev = useRef({ x: 0, z: 0 });
  const walkPhase = useRef(0);

  useFrame((_, dt) => {
    const mesh = ref.current;
    const entry = worldState.get(id);
    if (!mesh || !entry) return;

    const t = entry.target;
    const alpha = 1 - Math.pow(0.001, dt); // 프레임레이트 독립 damping

    // 이동 속도 추정(idle/walk 판정)
    const moved = Math.hypot(t.position.x - prev.current.x, t.position.z - prev.current.z);
    const moving = moved > 0.002;
    prev.current.x = t.position.x;
    prev.current.z = t.position.z;

    // 서버 y(=스폰 0.5)를 기준으로, 걸을 때만 바운스를 더한다(로컬 플레이어와 동일 기준).
    mesh.position.lerp(
      _target.set(
        t.position.x,
        t.position.y + (moving ? bounce((walkPhase.current += dt * 12)) : 0),
        t.position.z,
      ),
      alpha,
    );
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

function bounce(phase: number): number {
  return Math.abs(Math.sin(phase)) * 0.08;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

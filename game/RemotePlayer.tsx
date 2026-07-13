"use client";
// 원격 플레이어: 서버 스냅샷 목표값(worldState)으로 매 프레임 보간(lerp).
// GLB 캐릭터 + idle/walk는 "보간된 실제 이동 속도"로 판정(스냅샷 간 깜빡임 방지).
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldState } from "@/net/worldState";
import Character, { type AnimState } from "./Character";

export default function RemotePlayer({
  id,
  nick,
}: {
  id: string;
  nick: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const gPrev = useRef({ x: 0, z: 0 });
  const wasMoving = useRef(false);
  const [anim, setAnim] = useState<AnimState>("idle");

  useFrame((_, dt) => {
    const g = ref.current;
    const entry = worldState.get(id);
    if (!g || !entry) return;

    const t = entry.target;
    const alpha = 1 - Math.pow(0.001, dt); // 프레임레이트 독립 damping

    g.position.x = THREE.MathUtils.lerp(g.position.x, t.position.x, alpha);
    g.position.z = THREE.MathUtils.lerp(g.position.z, t.position.z, alpha);
    g.position.y = 0; // 바닥 고정(캐릭터 피트가 y=0)
    g.rotation.y = lerpAngle(g.rotation.y, t.rotationY, alpha);

    // 보간된 위치의 프레임당 이동량으로 walk 판정
    const moved = Math.hypot(
      g.position.x - gPrev.current.x,
      g.position.z - gPrev.current.z,
    );
    gPrev.current.x = g.position.x;
    gPrev.current.z = g.position.z;
    const moving = moved > 0.0015;
    if (moving !== wasMoving.current) {
      wasMoving.current = moving;
      setAnim(moving ? "walk" : "idle");
    }
  });

  return (
    <group ref={ref}>
      <Character anim={anim} ringColor="#f472b6" nick={nick} />
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

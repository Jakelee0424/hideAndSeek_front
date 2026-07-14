"use client";
// 원격 플레이어: 서버 스냅샷 버퍼(worldState)를 INTERP_DELAY_MS 과거 시점으로 보간 재생.
// 추격형 lerp와 달리 상시 지연/러버밴딩이 없다.
// GLB 캐릭터 + idle/walk는 "보간된 실제 이동 속도"로 판정(스냅샷 간 깜빡임 방지).
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldState, INTERP_DELAY_MS } from "@/net/worldState";
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

  useFrame(() => {
    const g = ref.current;
    if (!g) return;

    // 렌더 시점을 INTERP_DELAY_MS 과거로 잡아 버퍼된 두 스냅샷 사이를 보간한다.
    const renderTime = performance.now() - INTERP_DELAY_MS;
    const tr = worldState.sample(id, renderTime);
    if (!tr) return;

    g.position.x = tr.x;
    g.position.z = tr.z;
    g.position.y = 0; // 바닥 고정(캐릭터 피트가 y=0)
    g.rotation.y = tr.rotationY;

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

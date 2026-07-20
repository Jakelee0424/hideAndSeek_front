"use client";
// 원격 플레이어: 서버 스냅샷 버퍼(worldState)를 INTERP_DELAY_MS 과거 시점으로 보간 재생.
// 추격형 lerp와 달리 상시 지연/러버밴딩이 없다.
// GLB 캐릭터 + idle/walk는 "보간된 실제 이동 속도"로 판정(스냅샷 간 깜빡임 방지).
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldState, INTERP_DELAY_MS } from "@/net/worldState";
import { punches } from "@/net/punches";
import { PUNCH_ANIM_MS } from "./punchConfig";
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
  const lastAnim = useRef<AnimState>("idle");
  const seenPunchAt = useRef(0); // 마지막으로 처리한 펀치 수신 시각
  const punchUntil = useRef(0); // 이 시각까지 펀치 모션 재생
  const [anim, setAnim] = useState<AnimState>("idle");

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;

    // 렌더 시점을 INTERP_DELAY_MS 과거로 잡아 버퍼된 두 스냅샷 사이를 보간한다.
    const renderTime = performance.now() - INTERP_DELAY_MS;
    const tr = worldState.sample(id, renderTime);
    if (!tr) return;

    g.position.x = tr.x;
    g.position.z = tr.z;
    g.position.y = tr.y; // 서버가 보낸 지면 위 높이(점프). 착지 상태면 0
    g.rotation.y = tr.rotationY;

    // 보간된 위치의 프레임당 이동량으로 walk/run 판정.
    // 로컬처럼 sprint 플래그를 받지 않고 "실제 이동 속도"로 가른다 — 전선에 플래그를 더
    // 올리지 않아도 되고, 서버가 배수를 이미 반영한 좌표라 결과가 같다.
    const dx = g.position.x - gPrev.current.x;
    const dz = g.position.z - gPrev.current.z;
    const moved = Math.hypot(dx, dz);
    gPrev.current.x = g.position.x;
    gPrev.current.z = g.position.z;
    const moving = moved > 0.0015;

    // 이 원격 플레이어가 펀치를 날렸으면(스냅샷 이벤트) 잠깐 펀치 모션으로 덮는다.
    // 넉백으로 밀리는 모습은 위 보간 위치가 이미 담고 있다 — 여기선 때리는 쪽 모션만 얹는다.
    const now = performance.now();
    const pAt = punches.lastPunchAt(id);
    if (pAt > seenPunchAt.current) {
      seenPunchAt.current = pAt;
      punchUntil.current = now + PUNCH_ANIM_MS;
    }
    const punching = now < punchUntil.current;

    // 걷기(6m/s)와 달리기(10.8m/s)의 중간(≈8.4m/s)을 경계로 삼는다. 펀치가 최우선.
    const speed = moved / Math.max(delta, 1e-4);
    const airborne = g.position.y > 0.02;
    const nextAnim: AnimState = punching
      ? "punch"
      : airborne
        ? "jump"
        : moving
          ? speed > 8.4
            ? "run"
            : "walk"
          : "idle";
    if (nextAnim !== lastAnim.current) {
      lastAnim.current = nextAnim;
      setAnim(nextAnim);
    }
  });

  return (
    <group ref={ref}>
      <Character anim={anim} ringColor="#f472b6" nick={nick} />
    </group>
  );
}

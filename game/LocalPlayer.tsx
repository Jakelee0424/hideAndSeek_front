"use client";
// 로컬 플레이어 컨트롤러:
//  - WASD 이동(즉시 반영, client-side prediction) + 3인칭 팔로우 카메라
//  - GLB 캐릭터 + idle/walk 애니메이션 상태 전환
//  - 근접 오브젝트 감지 → 하이라이트, E키로 상호작용(퍼즐 열기)
//  - 입력을 20Hz로 서버 전송
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "./useKeyboard";
import Character, { type AnimState } from "./Character";
import { sendInput } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";
import {
  INTERACTABLES,
  INTERACT_RANGE,
  useInteraction,
} from "./interactables";
import { resolveCollision } from "./collision";

const SPEED = 6; // m/s
const CAM_OFFSET = new THREE.Vector3(0, 4.5, 6);
const INPUT_HZ = 20;

const _camDesired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export default function LocalPlayer() {
  const ref = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const seq = useRef(0);
  const acc = useRef(0);
  const wasMoving = useRef(false);
  const [anim, setAnim] = useState<AnimState>("idle");
  const myNick = useGameStore((s) => s.myNick);

  // E키: 근접 오브젝트 상호작용(퍼즐 열기)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyE") return;
      const { nearId, openId, solved, open } = useInteraction.getState();
      if (openId || !nearId || solved[nearId]) return;
      open(nearId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;

    const locked = useInteraction.getState().openId !== null;

    const k = keys.current;
    let dx = locked ? 0 : (k.d ? 1 : 0) - (k.a ? 1 : 0);
    let dz = locked ? 0 : (k.s ? 1 : 0) - (k.w ? 1 : 0);
    const len = Math.hypot(dx, dz);
    const moving = len > 0;

    if (moving) {
      dx /= len;
      dz /= len;
      g.position.x += dx * SPEED * dt;
      g.position.z += dz * SPEED * dt;
      g.rotation.y = Math.atan2(dx, dz);

      // 벽/장애물 충돌 해석(서버와 동일 로직). 문은 해결 시 통과.
      const solved = useInteraction.getState().solved;
      const [rx, rz] = resolveCollision(g.position.x, g.position.z, solved);
      g.position.x = rx;
      g.position.z = rz;
    }

    // idle/walk 전환은 상태가 바뀔 때만 setState
    if (moving !== wasMoving.current) {
      wasMoving.current = moving;
      setAnim(moving ? "walk" : "idle");
    }

    // 카메라 팔로우
    _camDesired.copy(g.position).add(CAM_OFFSET);
    state.camera.position.lerp(_camDesired, 1 - Math.pow(0.001, dt));
    _lookAt.copy(g.position).setY(g.position.y + 1);
    state.camera.lookAt(_lookAt);

    // 근접 오브젝트 감지(사거리 내 최근접)
    let nearId: string | null = null;
    let best = INTERACT_RANGE * INTERACT_RANGE;
    for (const it of INTERACTABLES) {
      const ex = it.position[0] - g.position.x;
      const ez = it.position[2] - g.position.z;
      const d2 = ex * ex + ez * ez;
      if (d2 < best) {
        best = d2;
        nearId = it.id;
      }
    }
    useInteraction.getState().setNear(nearId);

    // 서버 전송(20Hz)
    acc.current += dt;
    if (acc.current >= 1 / INPUT_HZ) {
      acc.current = 0;
      const gs = useGameStore.getState();
      if (gs.status === "connected") {
        sendInput(gs.roomId, {
          seq: seq.current++,
          move: { x: dx, y: 0, z: dz },
          rotationY: g.rotation.y,
        });
      }
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      <Character anim={anim} ringColor="#38bdf8" nick={myNick} />
    </group>
  );
}

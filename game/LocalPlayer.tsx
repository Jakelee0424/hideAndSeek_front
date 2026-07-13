"use client";
// 로컬 플레이어 컨트롤러:
//  - WASD 이동(즉시 반영, client-side prediction) + 3인칭 팔로우 카메라
//  - 애니메이션 상태(idle/walk): 지금은 바운스로 표현. GLTF 캐릭터가 오면
//    useAnimations(gltf)로 clip을 animState에 따라 재생하도록 교체하면 된다.
//  - 근접 오브젝트 감지 → 하이라이트, E키로 상호작용(퍼즐 열기)
//  - 입력을 20Hz로 서버 전송
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "./useKeyboard";
import { sendInput } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";
import {
  INTERACTABLES,
  INTERACT_RANGE,
  useInteraction,
} from "./interactables";

const SPEED = 6; // m/s
const CAM_OFFSET = new THREE.Vector3(0, 6, 9);
const INPUT_HZ = 20;

const _camDesired = new THREE.Vector3();

export default function LocalPlayer() {
  const ref = useRef<THREE.Mesh>(null);
  const keys = useKeyboard();
  const seq = useRef(0);
  const acc = useRef(0);
  const walkPhase = useRef(0);

  // E키: 근접한 오브젝트 상호작용(퍼즐 열기)
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
    const mesh = ref.current;
    if (!mesh) return;

    // 퍼즐이 열려 있으면 이동 잠금
    const locked = useInteraction.getState().openId !== null;

    const k = keys.current;
    let dx = locked ? 0 : (k.d ? 1 : 0) - (k.a ? 1 : 0);
    let dz = locked ? 0 : (k.s ? 1 : 0) - (k.w ? 1 : 0);
    const len = Math.hypot(dx, dz);
    const moving = len > 0;

    if (moving) {
      dx /= len;
      dz /= len;
      mesh.position.x += dx * SPEED * dt;
      mesh.position.z += dz * SPEED * dt;
      mesh.rotation.y = Math.atan2(dx, dz);
    }

    // 애니메이션 상태: idle/walk → 걸을 때만 바운스
    if (moving) {
      walkPhase.current += dt * 12;
      mesh.position.y = 0.5 + Math.abs(Math.sin(walkPhase.current)) * 0.08;
    } else {
      mesh.position.y = 0.5;
    }

    // 카메라 팔로우
    _camDesired.copy(mesh.position).add(CAM_OFFSET);
    state.camera.position.lerp(_camDesired, 1 - Math.pow(0.001, dt));
    state.camera.lookAt(mesh.position);

    // 근접 오브젝트 감지(사거리 내 최근접)
    let nearId: string | null = null;
    let best = INTERACT_RANGE * INTERACT_RANGE;
    for (const it of INTERACTABLES) {
      const ex = it.position[0] - mesh.position.x;
      const ez = it.position[2] - mesh.position.z;
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
          rotationY: mesh.rotation.y,
        });
      }
    }
  });

  return (
    <mesh ref={ref} position={[0, 0.5, 0]} castShadow>
      <capsuleGeometry args={[0.4, 0.8, 8, 16]} />
      <meshStandardMaterial color="#38bdf8" />
    </mesh>
  );
}

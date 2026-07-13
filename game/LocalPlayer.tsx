"use client";
// 로컬 플레이어: 입력 즉시 반영(client-side prediction) + 카메라 팔로우 + 입력 서버 전송(20Hz).
// TODO: 서버 확정값과 어긋날 때의 reconciliation(현재는 로컬 예측만).
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "./useKeyboard";
import { sendInput } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";

const SPEED = 6; // m/s
const CAM_OFFSET = new THREE.Vector3(0, 6, 9);
const INPUT_HZ = 20;

// 프레임마다 new 하지 않도록 모듈 스코프 임시 벡터 재사용
const _camDesired = new THREE.Vector3();

export default function LocalPlayer() {
  const ref = useRef<THREE.Mesh>(null);
  const keys = useKeyboard();
  const seq = useRef(0);
  const acc = useRef(0);

  useFrame((state, dt) => {
    const mesh = ref.current;
    if (!mesh) return;

    const k = keys.current;
    let dx = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    let dz = (k.s ? 1 : 0) - (k.w ? 1 : 0);
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx /= len;
      dz /= len;
      mesh.position.x += dx * SPEED * dt;
      mesh.position.z += dz * SPEED * dt;
      mesh.rotation.y = Math.atan2(dx, dz);
    }

    // 카메라가 부드럽게 뒤를 추적
    _camDesired.copy(mesh.position).add(CAM_OFFSET);
    state.camera.position.lerp(_camDesired, 1 - Math.pow(0.001, dt));
    state.camera.lookAt(mesh.position);

    // 고정 주기로 이동 의도 전송
    acc.current += dt;
    if (acc.current >= 1 / INPUT_HZ) {
      acc.current = 0;
      const roomId = useGameStore.getState().roomId;
      if (useGameStore.getState().status === "connected") {
        sendInput(roomId, {
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

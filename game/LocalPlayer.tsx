"use client";
// 로컬 플레이어 컨트롤러:
//  - WASD 이동(카메라 기준, client-side prediction) + 포인터락 마우스룩 3인칭 카메라
//  - GLB 캐릭터 + idle/walk 애니메이션 상태 전환
//  - 근접 오브젝트 감지 → 하이라이트, E키로 상호작용(퍼즐 열기)
//  - 입력을 20Hz로 서버 전송(월드 방향 벡터로 변환해 전송 → 서버 권위 로직 무변경)
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "./useKeyboard";
import { useMouseLook } from "./useMouseLook";
import Character, { type AnimState } from "./Character";
import { sendDoor, sendInput } from "@/net/stompClient";
import { worldState } from "@/net/worldState";
import { useGameStore } from "@/store/gameStore";
import {
  INTERACTABLES,
  INTERACT_RANGE,
  useInteraction,
} from "./interactables";
import { DOOR_RANGE, DOORS, randomCellSpawn } from "./prisonLayout";
import { resolveCollision } from "./collision";

const SPEED = 6; // m/s
const CAM_DIST = 6.5; // 카메라~캐릭터 거리(m)
const CAM_LOOK_H = 1.4; // 시선 높이(캐릭터 머리 부근)
const INPUT_HZ = 20;

const _camDesired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

export default function LocalPlayer() {
  const ref = useRef<THREE.Group>(null);
  const keys = useKeyboard();
  const look = useMouseLook();
  const seq = useRef(0);
  const acc = useRef(0);
  const wasMoving = useRef(false);
  const spawned = useRef(false); // 첫 서버 스냅샷 때 배정된 감방 위치로 스냅
  // 프론트 단독 실행 시 초기 위치: 랜덤 감방 안. 서버 연결 시 첫 스냅샷이 덮어쓴다.
  const initPos = useMemo(() => {
    const [x, z] = randomCellSpawn();
    return [x, 0, z] as [number, number, number];
  }, []);
  const [anim, setAnim] = useState<AnimState>("idle");
  const myNick = useGameStore((s) => s.myNick);

  // E키: 근접 오브젝트 상호작용(퍼즐 열기) / F키: 근접 감방문 열기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useInteraction.getState();
      if (e.code === "KeyE") {
        if (st.openId || !st.nearId || st.solved[st.nearId]) return;
        st.open(st.nearId);
      } else if (e.code === "KeyF") {
        // 근접한 감방문을 토글(열림↔닫힘). 로컬 즉시 반영 + 서버 동기화.
        const id = st.nearDoorId;
        if (!id) return;
        st.toggleDoor(id);
        sendDoor(useGameStore.getState().roomId, id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;

    // 서버가 배정한 감방으로 최초 1회 스냅(예측은 그 뒤 이어받는다).
    if (!spawned.current) {
      const myId = useGameStore.getState().myId;
      const t = myId ? worldState.sample(myId, performance.now()) : null;
      if (t) {
        g.position.x = t.x;
        g.position.z = t.z;
        g.rotation.y = t.rotationY;
        spawned.current = true;
      }
    }

    const locked = useInteraction.getState().openId !== null;
    const { yaw, pitch } = look.current;

    // 카메라가 보는 방향을 기준으로 입력을 월드 방향 벡터로 변환.
    //   forward(yaw=0) = -Z (기존 카메라 뒤 배치와 동일 규약)
    //   right = cross(forward, up) = (-forward.z, 0, forward.x)
    const k = keys.current;
    const fwdAmt = locked ? 0 : (k.w ? 1 : 0) - (k.s ? 1 : 0);
    const rightAmt = locked ? 0 : (k.d ? 1 : 0) - (k.a ? 1 : 0);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let mx = fx * fwdAmt - fz * rightAmt;
    let mz = fz * fwdAmt + fx * rightAmt;
    const len = Math.hypot(mx, mz);
    const moving = len > 0;

    if (moving) {
      mx /= len;
      mz /= len;
      g.position.x += mx * SPEED * dt;
      g.position.z += mz * SPEED * dt;
      g.rotation.y = Math.atan2(mx, mz); // 캐릭터는 이동 방향을 바라봄

      // 벽/장애물 충돌 해석(서버와 동일 로직). 열린 감방문은 통과.
      const openDoors = useInteraction.getState().doorsOpen;
      const [rx, rz] = resolveCollision(g.position.x, g.position.z, openDoors);
      g.position.x = rx;
      g.position.z = rz;
    }

    // idle/walk 전환은 상태가 바뀔 때만 setState
    if (moving !== wasMoving.current) {
      wasMoving.current = moving;
      setAnim(moving ? "walk" : "idle");
    }

    // 3인칭 오빗 카메라: yaw/pitch 구면좌표로 캐릭터 주위에 배치(거리 일정).
    const cosP = Math.cos(pitch);
    _camDesired.set(
      g.position.x + Math.sin(yaw) * cosP * CAM_DIST,
      g.position.y + Math.sin(pitch) * CAM_DIST,
      g.position.z + Math.cos(yaw) * cosP * CAM_DIST,
    );
    state.camera.position.copy(_camDesired); // 마우스룩은 지연 없이 즉시 반영
    _lookAt.set(g.position.x, g.position.y + CAM_LOOK_H, g.position.z);
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

    // 근접 감방문 감지(사거리 내 최근접) → F 프롬프트/열기 대상
    let nearDoorId: string | null = null;
    let bestDoor = DOOR_RANGE * DOOR_RANGE;
    for (const d of DOORS) {
      const ex = d.pos[0] - g.position.x;
      const ez = d.pos[1] - g.position.z;
      const q = ex * ex + ez * ez;
      if (q < bestDoor) {
        bestDoor = q;
        nearDoorId = d.id;
      }
    }
    useInteraction.getState().setNearDoor(nearDoorId);

    // 서버 전송(20Hz)
    acc.current += dt;
    if (acc.current >= 1 / INPUT_HZ) {
      acc.current = 0;
      const gs = useGameStore.getState();
      if (gs.status === "connected") {
        sendInput(gs.roomId, {
          seq: seq.current++,
          move: { x: moving ? mx : 0, y: 0, z: moving ? mz : 0 },
          rotationY: g.rotation.y,
        });
      }
    }
  });

  return (
    <group ref={ref} position={initPos}>
      <Character anim={anim} ringColor="#38bdf8" nick={myNick} />
    </group>
  );
}

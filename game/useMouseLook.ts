"use client";
// 포인터락 기반 마우스룩. 캔버스를 클릭하면 포인터가 잠기고, 마우스 이동으로
// yaw(수평)·pitch(수직)를 조절한다. 값은 state가 아니라 ref에 쌓아 매 프레임
// 리렌더를 피한다(LocalPlayer의 useFrame에서 읽는다).
//   - 퍼즐 오버레이가 열리면 포인터락을 풀어 마우스로 오버레이를 조작할 수 있게 한다.
//   - ESC로 포인터락 해제(브라우저 기본 동작).
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useInteraction } from "./interactables";

export interface Look {
  yaw: number;
  pitch: number;
}

const SENS = 0.0025; // 마우스 감도(px → rad)
const PITCH_MIN = 0.08; // 거의 수평(아래에서 살짝 올려다봄)
const PITCH_MAX = 1.3; // 위에서 내려다보는 한계(짐벌락 방지)

export function useMouseLook() {
  // 시작 시점: 캐릭터 뒤에서 약간 내려다보는 각도
  const look = useRef<Look>({ yaw: 0, pitch: 0.5 });
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;

    // 캔버스 클릭 → 포인터 잠금(퍼즐 열려 있으면 무시).
    const onClick = () => {
      if (useInteraction.getState().openId !== null) return;
      if (document.pointerLockElement === el) return;
      // requestPointerLock는 최신 브라우저에서 Promise를 반환한다.
      // ESC 직후 재획득 시도는 SecurityError로 거부되므로 삼켜서 unhandledRejection을 막는다.
      const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    // 잠긴 동안에만 마우스 델타를 시점에 반영.
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const l = look.current;
      l.yaw -= e.movementX * SENS;
      l.pitch += e.movementY * SENS; // 마우스 위로 → 올려다봄
      if (l.pitch < PITCH_MIN) l.pitch = PITCH_MIN;
      else if (l.pitch > PITCH_MAX) l.pitch = PITCH_MAX;
    };

    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);

    // 퍼즐이 열리는 순간 포인터락을 풀어 오버레이를 마우스로 만질 수 있게 한다.
    const unsub = useInteraction.subscribe((s, prev) => {
      if (s.openId && !prev.openId && document.pointerLockElement === el) {
        document.exitPointerLock();
      }
    });

    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      unsub();
    };
  }, [gl]);

  return look;
}

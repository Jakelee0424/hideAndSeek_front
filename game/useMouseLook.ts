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
  /** 카메라~캐릭터 목표 거리(m). 휠로 조절한다. 가림 보정은 이 값을 상한으로 삼아 더 당긴다. */
  dist: number;
}

const SENS = 0.0025; // 마우스 감도(px → rad)
const PITCH_MIN = 0.08; // 거의 수평(아래에서 살짝 올려다봄)
const PITCH_MAX = 1.3; // 위에서 내려다보는 한계(짐벌락 방지)

// 휠 줌. 기본값은 옛 고정 거리(CAM_DIST)와 같아 아무것도 안 굴리면 예전과 똑같이 보인다.
// 판마다 기본값으로 돌아간다(저장하지 않는다 — 2026-08-05 사용자 지시).
export const DIST_DEFAULT = 6.5;
const DIST_MIN = 3; // 더 당기면 캐릭터가 화면을 덮는다(가림 보정은 이보다 더 당길 수 있다)
const DIST_MAX = 13; // 실외 기준. 실내에서는 벽에 걸려 가림 보정이 도로 당긴다
const WHEEL_SCALE = 0.01; // deltaY 100(휠 한 칸) ≈ 1m

export function useMouseLook() {
  // 시작 시점: 캐릭터 뒤에서 약간 내려다보는 각도
  const look = useRef<Look>({ yaw: 0, pitch: 0.5, dist: DIST_DEFAULT });
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;

    // 캔버스 클릭 → 포인터 잠금(퍼즐 조작 중이면 무시).
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

    // 휠 → 카메라 거리. 포인터가 잠긴 동안에만 받는다 — 안 그러면 도움말·이야기 패널을
    // 스크롤하려고 굴린 휠까지 시점을 움직인다. Ctrl+휠은 브라우저 확대라 건드리지 않는다.
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== el) return;
      if (e.ctrlKey) return;
      if (useInteraction.getState().openId !== null) return; // 퍼즐 모달 스크롤과 겹치지 않게
      e.preventDefault(); // 페이지가 같이 스크롤되지 않게(→ passive: false 필수)
      const l = look.current;
      // deltaMode 1(줄 단위)은 값이 작게 온다 — 픽셀 기준으로 환산해 감도를 맞춘다.
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      l.dist += dy * WHEEL_SCALE; // 아래로 굴리면(+) 멀어진다
      if (l.dist < DIST_MIN) l.dist = DIST_MIN;
      else if (l.dist > DIST_MAX) l.dist = DIST_MAX;
    };

    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("wheel", onWheel, { passive: false });

    // 퍼즐이 열리는 순간 포인터락을 풀어 오버레이를 마우스로 만질 수 있게 한다.
    const unsub = useInteraction.subscribe((s, prev) => {
      if (s.openId && !prev.openId && document.pointerLockElement === el) {
        document.exitPointerLock();
      }
    });

    return () => {
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("wheel", onWheel);
      unsub();
    };
  }, [gl]);

  return look;
}

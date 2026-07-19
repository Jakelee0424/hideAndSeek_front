"use client";
// 포인터락이 걸려 있는지 알려준다. 조작 안내(클릭해서 시작 / ESC로 해제)를 띄우는 데 쓴다.
//
// useMouseLook은 Canvas 안(R3F 트리)에 있고 안내는 HUD(2D 오버레이)라 서로 접근할 수 없다.
// 상태를 공유하는 대신 브라우저 이벤트를 각자 듣는다 — 어차피 document 단위 상태라 그게 단순하다.
import { useEffect, useState } from "react";

export function usePointerLock(): boolean {
  // 서버 렌더 시엔 document가 없다. 마운트 후 실제 값으로 맞춘다.
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const sync = () => setLocked(document.pointerLockElement !== null);
    sync();
    document.addEventListener("pointerlockchange", sync);
    return () => document.removeEventListener("pointerlockchange", sync);
  }, []);

  return locked;
}

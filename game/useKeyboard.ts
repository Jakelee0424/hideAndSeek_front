// 키 입력을 ref에 기록. 매 프레임 setState 하지 않기 위해 state가 아닌 ref 사용.
import { useEffect, useRef } from "react";

export interface Keys {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
}

const CODE_MAP: Record<string, keyof Keys> = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  ArrowUp: "w",
  ArrowLeft: "a",
  ArrowDown: "s",
  ArrowRight: "d",
};

export function useKeyboard() {
  const keys = useRef<Keys>({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = CODE_MAP[code];
      if (k) keys.current[k] = v;
    };
    const down = (e: KeyboardEvent) => set(e.code, true);
    const up = (e: KeyboardEvent) => set(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return keys;
}

// 키 입력을 ref에 기록. 매 프레임 setState 하지 않기 위해 state가 아닌 ref 사용.
import { useEffect, useRef } from "react";
import { useChat } from "@/net/chat";

export interface Keys {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  /** R: 달리기 */
  sprint: boolean;
  /** Space: 점프 */
  jump: boolean;
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
  KeyR: "sprint",
  Space: "jump",
};

export function useKeyboard() {
  const keys = useRef<Keys>({
    w: false,
    a: false,
    s: false,
    d: false,
    sprint: false,
    jump: false,
  });

  useEffect(() => {
    const set = (code: string, v: boolean) => {
      const k = CODE_MAP[code];
      if (k) keys.current[k] = v;
    };
    const down = (e: KeyboardEvent) => {
      // 채팅 입력 중에는 이동 키를 먹지 않는다. "wasd"를 치면 캐릭터가 같이 달린다.
      if (useChat.getState().composing) return;
      // Space의 기본 동작은 페이지 스크롤이라 막지 않으면 화면이 튄다.
      if (e.code === "Space") e.preventDefault();
      set(e.code, true);
    };
    const up = (e: KeyboardEvent) => {
      if (useChat.getState().composing) return;
      set(e.code, false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    // 채팅을 여는 순간 눌려 있던 키를 전부 놓은 것으로 친다.
    // 이게 없으면 W를 누른 채 Enter를 쳤을 때 keyup이 위에서 걸러져 W가 영영 true로 남고,
    // 채팅을 닫은 뒤에도 캐릭터가 혼자 앞으로 달린다.
    const unsub = useChat.subscribe((s, prev) => {
      if (s.composing && !prev.composing) {
        const k = keys.current;
        k.w = k.a = k.s = k.d = false;
        k.sprint = false;
        k.jump = false;
      }
    });

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      unsub();
    };
  }, []);

  return keys;
}

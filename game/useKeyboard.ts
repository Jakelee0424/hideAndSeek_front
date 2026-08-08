// 키 입력을 ref에 기록. 매 프레임 setState 하지 않기 위해 state가 아닌 ref 사용.
import { useEffect, useRef } from "react";
import { useInteraction } from "./interactables";

export interface Keys {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  /** Shift: 달리기 */
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
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
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
      // Space의 기본 동작은 페이지 스크롤이라 막지 않으면 화면이 튄다.
      if (e.code === "Space") e.preventDefault();
      set(e.code, true);
    };
    const up = (e: KeyboardEvent) => {
      set(e.code, false);
    };

    // ⚠️ 눌린 키를 놓는 순간 창이 포커스를 잃으면 **keyup이 영영 안 온다** — 그 키는 눌린
    //    채로 굳는다. Alt+Tab·다른 창 클릭·개발자도구·알림이 전부 이 경로다.
    //    증상이 헷갈리는 이유: 굳은 키가 W면 혼자 걸어가지만, **S면 W를 눌러도 앞으로
    //    안 간다**(fwdAmt = W − S = 0). 좌우는 멀쩡해서 "갑자기 앞으로만 못 간다"가 된다.
    //    → 포커스를 잃거나 탭이 가려지면 전부 뗀 것으로 친다.
    const clear = () => {
      const k = keys.current;
      for (const key of Object.keys(k) as (keyof Keys)[]) k[key] = false;
    };
    const onVisibility = () => {
      if (document.hidden) clear();
    };
    // 퍼즐·아케이드 모달이 열리고 닫힐 때도 리셋한다. 모달이 뜨면 이동이 멈추는데(openId 게이트)
    // 그 사이 뗀 키의 keyup을 미니게임이 자기 것으로 소비할 수 있고, 그러면 모달을 닫는 순간
    // 눌린 적 없는 키로 걷기 시작한다.
    // ⚠️ **openId가 바뀔 때만**이다. 스토어 전체를 구독해 무조건 clear 하면 nearId가 바뀔 때
    //    (오브젝트 옆을 지나가기만 해도) 달리던 키가 풀린다.
    const unsub = useInteraction.subscribe((s, prev) => {
      if (s.openId !== prev.openId) clear();
    });

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
      unsub();
    };
  }, []);

  return keys;
}

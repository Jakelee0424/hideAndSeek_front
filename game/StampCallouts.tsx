"use client";
// 표식 발견 말풍선: 표식 퀴즈가 풀리는 순간, 그 퀴즈 아이템(작업장 작업도구함, 식당 냉장고
// 잠금장치, 의무실·세탁실 퀴즈) 머리 위에 몇 초간 깜빡이며 뜬다.
//
// drei <Html>은 벽에 가려지지 않으므로 멀리 있는 사람도 "어디서" 표식이 열렸는지
// 위치째로 본다 — 표식 4개를 모으는 협동 목표의 진행 공유가 목적이라 의도된 동작이다.
// 트리거는 net/session(서버 solvedIds 브로드캐스트) → stampNotice store — 방 전원에게 뜬다.
import { useEffect } from "react";
import { Html } from "@react-three/drei";
import { STAMP_QUIZ_ROOM, findInteractable } from "./interactables";
import { useStampNotice } from "@/store/stampNotice";

/** 말풍선을 띄워 두는 시간(ms). 깜빡임 5회가 끝나고도 잠깐 읽을 여유. */
const TTL_MS = 5200;

export default function StampCallouts() {
  const active = useStampNotice((s) => s.active);
  const expire = useStampNotice((s) => s.expire);

  // TTL 타이머. active가 바뀔 때만 다시 건다(말풍선 수는 최대 4라 부담 없음).
  useEffect(() => {
    const timers = Object.entries(active).map(([id, at]) =>
      setTimeout(() => expire(id), Math.max(0, at + TTL_MS - Date.now())),
    );
    return () => timers.forEach(clearTimeout);
  }, [active, expire]);

  return (
    <>
      {Object.keys(active).map((id) => {
        const it = findInteractable(id);
        if (!it) return null;
        const [x, y, z] = it.position;
        return (
          <Html key={id} position={[x, y + 1.6, z]} center distanceFactor={12}>
            <div
              className="pointer-events-none select-none whitespace-nowrap rounded-xl border-2 border-amber-300/70 bg-black/85 px-4 py-2 text-center shadow-[0_0_24px_rgba(251,191,36,0.45)]"
              style={{
                animation:
                  "stampPop 300ms ease-out both, stampBlink 640ms ease-in-out 300ms 5",
              }}
            >
              <style>{`
                @keyframes stampPop{from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}}
                @keyframes stampBlink{0%,100%{opacity:1}50%{opacity:0.35}}
              `}</style>
              <p className="font-mono text-[10px] tracking-[0.3em] text-amber-300/80">
                ✦ 표식 발견 ✦
              </p>
              <p className="text-base font-bold text-amber-200">
                {STAMP_QUIZ_ROOM[id]} 벽에 표식이 드러났다
              </p>
            </div>
          </Html>
        );
      })}
    </>
  );
}

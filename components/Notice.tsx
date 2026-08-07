"use client";
// 짧은 안내 토스트. 협동 중 남의 행동 때문에 내 화면이 바뀌었을 때 이유를 알려 준다
// (지금은 "내가 붙잡고 있던 퍼즐을 남이 먼저 풀었다" 하나).
// 표식 발견 공지는 여기가 아니라 그 퀴즈 아이템 위 3D 말풍선(game/StampCallouts)이 맡는다.
//
// ⚠️ 위치는 상단 중앙이되 PhaseBanner(top-4) 아래다. 화면 한가운데는 3인칭 카메라상
//    캐릭터 이름표·조작 안내가 있는 자리라 피한다.
import { useEffect } from "react";
import { useNotice } from "@/store/noticeStore";

const SHOW_MS = 3600;

export default function Notice() {
  const text = useNotice((s) => s.text);
  const seq = useNotice((s) => s.seq);
  const clear = useNotice((s) => s.clear);

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(clear, SHOW_MS);
    return () => clearTimeout(t);
    // seq가 바뀌면 타이머를 다시 건다 — 같은 문구가 연달아 떠도 표시 시간이 새로 시작된다.
  }, [text, seq, clear]);

  if (!text) return null;

  return (
    <div
      key={seq}
      className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-lg border border-amber-300/30 bg-black/70 px-4 py-2 text-sm text-amber-100 shadow-lg backdrop-blur"
      style={{ animation: "noticeIn 220ms ease-out both" }}
      role="status"
    >
      <style>{`@keyframes noticeIn{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      {text}
    </div>
  );
}

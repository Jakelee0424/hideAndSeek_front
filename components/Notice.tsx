"use client";
// 짧은 안내 토스트. 협동 중 남의 행동 때문에 내 화면이 바뀌었을 때 이유를 알려 준다.
//
// 두 가지 겉모습(noticeStore.kind):
//   - default: 상단 중앙의 작은 토스트(PhaseBanner 아래). 화면 한가운데는 캐릭터
//     이름표·조작 안내가 있는 자리라 피한다 — 사소한 안내("먼저 풀렸다")용.
//   - stamp: 화면 중앙에 크게 깜빡이는 강조 — 표식 공지처럼 전원이 놓치면 안 되는 진행.
import { useEffect } from "react";
import { useNotice } from "@/store/noticeStore";

const SHOW_MS = 3600;
const STAMP_SHOW_MS = 4600; // 강조는 조금 더 오래 — 깜빡임까지 눈에 담을 시간

export default function Notice() {
  const text = useNotice((s) => s.text);
  const kind = useNotice((s) => s.kind);
  const seq = useNotice((s) => s.seq);
  const clear = useNotice((s) => s.clear);

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(clear, kind === "stamp" ? STAMP_SHOW_MS : SHOW_MS);
    return () => clearTimeout(t);
    // seq가 바뀌면 타이머를 다시 건다 — 같은 문구가 연달아 떠도 표시 시간이 새로 시작된다.
  }, [text, kind, seq, clear]);

  if (!text) return null;

  if (kind === "stamp") {
    return (
      <div
        key={seq}
        className="pointer-events-none absolute left-1/2 top-[42%] z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-amber-300/60 bg-black/80 px-8 py-4 text-center shadow-[0_0_40px_rgba(251,191,36,0.35)] backdrop-blur"
        style={{ animation: "stampIn 320ms ease-out both, stampBlink 640ms ease-in-out 320ms 4" }}
        role="status"
      >
        <style>{`
          @keyframes stampIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.82)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
          @keyframes stampBlink{0%,100%{opacity:1}50%{opacity:0.35}}
          @media (prefers-reduced-motion: reduce){[role="status"]{animation:stampIn 1ms both !important}}
        `}</style>
        <p className="mb-1 font-mono text-[11px] tracking-[0.35em] text-amber-300/70">
          ✦ 표식 발견 ✦
        </p>
        <p className="text-xl font-bold text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]">
          {text}
        </p>
      </div>
    );
  }

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

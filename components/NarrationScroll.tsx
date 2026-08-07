"use client";
// 대기방 "수신 전문" 패널 안에서 게임 도입 나레이션을 천천히 위로 흘려 읽게 한다
// (엔딩 크레딧처럼). 브리핑 전문답게 왼쪽 정렬 + 모노스페이스 + 줄머리 기호(▸)를 단다.
//
// 정본 나레이션은 StoryPanel.buildLines 하나다 — 여기선 그걸 받아 두 벌 쌓고 절반만큼(-50%)
// 위로 미는 애니메이션으로 끊김 없이 순환시킨다. Tailwind arbitrary animate-[...]가 커스텀
// keyframes를 못 잡는 경우가 있어, CSS가 아니라 Web Animations API(element.animate)로 직접 건다.
//
// 겉 테두리는 없다 — 감싸는 ConsolePanel이 액자를 제공한다.
import { useEffect, useRef } from "react";
import type { Line } from "./StoryPanel";

export default function NarrationScroll({ lines }: { lines: Line[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // 한 벌 높이만큼(-50%) 위로 올리면 둘째 벌이 첫째 벌 자리에 이어져 매끄럽게 반복된다.
    const anim = el.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-50%)" }],
      { duration: 30000, iterations: Infinity, easing: "linear" },
    );
    return () => anim.cancel();
  }, [lines]);

  const copy = (k: number) => (
    <div key={k} className="flex flex-col gap-3 px-2 py-4" aria-hidden={k === 1}>
      {lines.map((l, i) => (
        <p
          key={i}
          className={`flex gap-2 text-left font-mono text-[13px] leading-relaxed ${
            l.final ? "font-medium text-amber-200" : "text-slate-300"
          }`}
        >
          <span className={`shrink-0 ${l.final ? "text-amber-400" : "text-amber-500/50"}`}>▸</span>
          <span>
            {l.boldLen ? (
              <>
                <span className="font-semibold text-slate-100">{l.text.slice(0, l.boldLen)}</span>
                {l.text.slice(l.boldLen)}
              </>
            ) : (
              l.text
            )}
          </span>
        </p>
      ))}
    </div>
  );

  return (
    <div
      className="relative h-36 overflow-hidden bg-black/30"
      // 위·아래 가장자리를 부드럽게 페이드해 글이 경계에서 툭 끊기지 않게.
      style={{
        maskImage: "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, black 16%, black 84%, transparent)",
      }}
    >
      <div ref={trackRef} style={{ willChange: "transform" }}>
        {[0, 1].map(copy)}
      </div>
    </div>
  );
}

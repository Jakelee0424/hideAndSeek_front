"use client";
// 소등(ONBOARDING) 단계에 한 번 흐르는 도입 내레이션.
//
// 엔딩이 "자정의 종"·"배수관"·"가면을 쓴 자"라는 말을 쓴다. 그 전제를 깔아 두는 곳이
// 여기다 — 앞에서 아무 설명이 없으면 마지막 문장이 갑자기 튀어나온 것처럼 들린다.
//
// 한 번 흐르고 나면 다시 뜨지 않는다(소등은 한 판에 한 번뿐이지만, 재접속 등으로 단계가
// 다시 들어와도 도입부를 두 번 보여 주지 않는다).
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";

const LINES = [
  "소등. 복도의 불이 하나씩 꺼진다.",
  // 탈출구의 생김새는 말하지 않는다. 맵이 바뀌면(2026-07-21 도면 재설계로 배수관 → 정문)
  // 여기부터 어긋나기 때문이다. 위치는 맵이 알려주고, 여기서는 "밖으로 나가는 문"까지만 말한다.
  "자정까지 시간이 있다. 감방을 나가, 바깥으로 이어지는 철문을 열어라.",
  "철문은 네 자리 번호로 잠겨 있고, 그 번호는 세 곳에 나뉘어 적혀 있다. 혼자서는 다 모을 수 없다.",
  // 순찰 규칙은 반드시 여기서 알려야 한다. 시스템이 조작을 막지 않으므로,
  // 미리 듣지 못한 사람에겐 "가만히 있으면 된다"는 걸 알 방법이 없다.
  "밤사이 간수가 한두 번 복도를 돈다. 순찰이 도는 동안 움직이거나 무언가를 건드리면 들킨다.",
  "막아 주지 않는다. 멈추는 건 네 몫이고, 들키면 자정이 그만큼 앞당겨진다.",
  "그리고 — 오늘 밤 이 안에는, 사람이 아닌 것이 하나 섞여 있다.",
];

/** 한 줄이 떠 있는 시간(ms). */
const LINE_MS = 3000;
/** 마지막 줄이 사라지고 화면이 걷히기까지(ms). */
const OUTRO_MS = 1600;

export default function OnboardingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const [seen, setSeen] = useState(false);
  const [step, setStep] = useState(0);

  const active = phase === "ONBOARDING" && !seen;

  useEffect(() => {
    if (!active) return;
    const timers = LINES.map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * LINE_MS),
    );
    timers.push(
      setTimeout(() => setSeen(true), LINES.length * LINE_MS + OUTRO_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  if (!active) return null;

  // step은 "다음 줄로 넘어간 횟수". 지금 보여 줄 줄은 그 직전 것이다.
  const idx = Math.min(step, LINES.length - 1);

  return (
    // 조작은 막지 않는다 — 도입이 흐르는 동안에도 감방 안을 둘러볼 수 있어야 한다.
    <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center bg-gradient-to-t from-black/85 via-black/30 to-transparent pb-28">
      <style>{`
        @keyframes obFade {
          0%   { opacity: 0; transform: translateY(10px); }
          15%  { opacity: 1; transform: translateY(0); }
          85%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ob-line] { animation-duration: 1ms !important; opacity: 1 !important; }
        }
      `}</style>
      <p
        key={idx}
        data-ob-line
        className="max-w-xl px-8 text-center text-[15px] leading-relaxed text-slate-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]"
        style={{ animation: `obFade ${LINE_MS}ms ease-out both` }}
      >
        {LINES[idx]}
      </p>
    </div>
  );
}

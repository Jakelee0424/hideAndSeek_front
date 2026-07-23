"use client";
// 소등(ONBOARDING) 단계에 한 번 흐르는 도입 내레이션.
//
// 화면 하단 자막 밴드에 한 줄씩 타자 치듯 드러내고, 다음 줄이 앞줄을 대체한다. 전체를 60초에
// 고정해 천천히 진행한다(예전 3초 페이드로 스쳐 못 읽던 문제 해결).
//   ⚠️ 중앙에 두지 않는다 — 3인칭 카메라상 캐릭터 이름표·클릭 안내가 중앙에 있어 겹친다.
//      또 "소등" 자체는 PhaseBanner의 전환 토스트가 이미 크게 띄우므로 여기서 또 쓰지 않는다.
//
// 엔딩이 "자정의 종"·"정문 너머"·"가면을 쓴 자"라는 말을 쓴다. 그 전제를 여기서 깐다.
// 시작(phase가 ONBOARDING이 되는 순간)한 뒤에는 단계가 넘어가도 60초 시퀀스를 끝까지 돌린다.
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";

// 줄 스펙. boldLen — 줄 앞 몇 글자를 볼드 강조. final — 마지막 한 방(호박색).
interface Line {
  text: string;
  boldLen?: number;
  final?: boolean;
}

// ⚠️ 탈출구의 생김새(정문/배수관)는 말하지 않는다 — 맵이 바뀌면 여기부터 어긋난다.
const LINES: Line[] = [
  { text: "소등. 복도의 불이 하나씩 꺼진다.", boldLen: 3 },
  { text: "자정까지 시간이 있다. 감방을 나가, 바깥으로 이어지는 철문을 열어라." },
  { text: "철문은 네 자리 번호로 잠겨 있다. 네 방의 표식이 네 몫의 숫자를 쥐고 있고, 셈법은 세 곳에 나뉘어 적혀 있다." },
  { text: "네 몫은 너만 안다. 남의 몫은 물어라 — 혼자서는 문이 열리지 않는다." },
  { text: "밤사이 간수가 한두 번 복도를 돈다. 순찰이 도는 동안 움직이거나 무언가를 건드리면 들킨다." },
  { text: "막아 주지 않는다. 멈추는 건 네 몫이고, 들키면 자정이 그만큼 앞당겨진다." },
  { text: "그리고 — 오늘 밤 이 안에는, 사람이 아닌 것이 하나 섞여 있다.", final: true },
];

const LEAD_MS = 1200; // 첫 줄 전 여백(PhaseBanner 전환 토스트가 먼저 지나가게)
const TYPE_MS = 60; // 글자당 타자 간격
const PAUSE_MS = 2800; // 줄과 줄 사이 멈춤(다음 줄이 앞줄을 대체)
const OUTRO_MS = 1800; // 마지막에 걷히는 페이드
const TOTAL_MS = 60000; // 전체 고정 진행 시간(60초)

export default function OnboardingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!startedRef.current && phase === "ONBOARDING") {
      startedRef.current = true;
      setStarted(true);
    }
  }, [phase]);

  const active = started && !done;

  const [outro, setOutro] = useState(false);
  const [display, setDisplay] = useState<{ line: Line; text: string; typing: boolean } | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    at(TOTAL_MS - OUTRO_MS, () => !cancelled && setOutro(true));
    at(TOTAL_MS, () => !cancelled && setDone(true));

    if (reduce) {
      // 타자 없이 줄을 차례로(한 줄씩) 보여준다.
      const dwell = Math.max(
        1800,
        Math.floor((TOTAL_MS - LEAD_MS - OUTRO_MS) / LINES.length),
      );
      LINES.forEach((line, i) =>
        at(LEAD_MS + i * dwell, () =>
          !cancelled && setDisplay({ line, text: line.text, typing: false }),
        ),
      );
    } else {
      at(LEAD_MS, () => !cancelled && typeLine(0));
    }

    function typeLine(i: number) {
      if (cancelled || i >= LINES.length) return;
      const chars = Array.from(LINES[i].text);
      let c = 0;
      const step = () => {
        if (cancelled) return;
        c += 1;
        setDisplay({ line: LINES[i], text: chars.slice(0, c).join(""), typing: c < chars.length });
        if (c < chars.length) at(TYPE_MS, step);
        else at(PAUSE_MS, () => typeLine(i + 1));
      };
      step();
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active]);

  if (!active) return null;

  return (
    // 하단 자막 밴드. 조작은 막지 않는다. 좌하단 조작안내/채팅과 겹치지 않게 가운데 정렬.
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-20 transition-opacity ease-out ${
        outro ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${OUTRO_MS}ms` }}
    >
      <style>{`
        @keyframes obCaret { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes obBar { from { width: 0%; } to { width: 100%; } }
      `}</style>

      <div className="w-full max-w-xl rounded-xl bg-black/55 px-6 py-4 text-center backdrop-blur-sm">
        {display ? (
          <NarrationLine line={display.line} text={display.text} caret={display.typing} />
        ) : (
          <p className="text-[15px] leading-relaxed text-slate-400">…</p>
        )}
      </div>

      {/* 60초 고정 진행 바 */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div className="h-full bg-slate-300/70" style={{ animation: `obBar ${TOTAL_MS}ms linear both` }} />
      </div>
    </div>
  );
}

// 한 줄 렌더: boldLen(앞부분 볼드) + final(불길한 강조) + 타이핑 캐럿.
function NarrationLine({ line, text, caret }: { line: Line; text: string; caret?: boolean }) {
  const bold = line.boldLen ?? 0;
  const head = bold > 0 ? text.slice(0, Math.min(bold, text.length)) : "";
  const rest = bold > 0 ? text.slice(head.length) : text;
  return (
    <p
      className={`leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] ${
        line.final ? "text-[15px] tracking-wide text-amber-200/90" : "text-[15px] text-slate-100"
      }`}
    >
      {head && <strong className="font-semibold text-white">{head}</strong>}
      {rest}
      {caret && (
        <span
          className="ml-0.5 inline-block w-[2px] translate-y-[2px] bg-slate-200"
          style={{ height: "1em", animation: "obCaret 1s step-end infinite" }}
        />
      )}
    </p>
  );
}

"use client";
// 소등(ONBOARDING) 단계에 한 번 흐르는 도입 내레이션.
//
// 예전엔 한 줄이 3초 페이드로 스쳐 지나가 긴 문장을 다 못 읽었다(사용자 지적). 이제는
//   - 소등 연출로 시작하고,
//   - 줄을 타자 치듯 한 글자씩 드러내며(typewriter),
//   - 드러난 줄은 사라지지 않고 쌓여 끝까지 읽을 수 있고,
//   - 전체를 60초에 고정해 천천히 진행한다.
//
// 엔딩이 "자정의 종"·"정문 너머"·"가면을 쓴 자"라는 말을 쓴다. 그 전제를 깔아 두는 곳이
// 여기다 — 앞에서 아무 설명이 없으면 마지막 문장이 갑자기 튀어나온 것처럼 들린다.
//
// 한 번 흐르고 나면 다시 뜨지 않는다. 시작(phase가 ONBOARDING이 되는 순간)한 뒤에는 단계가
// 넘어가도(TEST 방처럼 단계가 짧아도) 60초 시퀀스를 끝까지 돌린다 — 조작을 막지 않으므로
// 단계 경계를 넘겨 흘러도 문제되지 않는다.
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";

// 줄 스펙: 프로토타입과 같은 모양.
//   gapBefore — 이 줄 앞에 문단 간격을 둔다(장면이 바뀌는 지점).
//   boldLen   — 줄 앞 몇 글자를 볼드로 강조한다(0/미지정이면 없음).
//   final     — 마지막 한 방. 색과 자간을 달리해 불길하게.
interface Line {
  text: string;
  gapBefore?: boolean;
  boldLen?: number;
  final?: boolean;
}

// ⚠️ 탈출구의 생김새(정문/배수관)는 말하지 않는다 — 맵이 바뀌면 여기부터 어긋난다.
// 위치는 맵이 알려주고, 여기서는 "밖으로 나가는 문"까지만 말한다(2026-07-22 재설계 반영).
const LINES: Line[] = [
  { text: "소등. 복도의 불이 하나씩 꺼진다.", boldLen: 3 },
  { text: "자정까지 시간이 있다. 감방을 나가, 바깥으로 이어지는 철문을 열어라.", gapBefore: true },
  { text: "철문은 네 자리 번호로 잠겨 있다. 네 방의 표식이 네 몫의 숫자를 쥐고 있고, 셈법은 세 곳에 나뉘어 적혀 있다.", gapBefore: true },
  { text: "네 몫은 너만 안다. 남의 몫은 물어라 — 혼자서는 문이 열리지 않는다." },
  { text: "밤사이 간수가 한두 번 복도를 돈다. 순찰이 도는 동안 움직이거나 무언가를 건드리면 들킨다.", gapBefore: true },
  { text: "막아 주지 않는다. 멈추는 건 네 몫이고, 들키면 자정이 그만큼 앞당겨진다." },
  { text: "그리고 — 오늘 밤 이 안에는, 사람이 아닌 것이 하나 섞여 있다.", gapBefore: true, final: true },
];

const INTRO_MS = 2600; // 소등(불이 꺼지는) 시간
const TYPE_MS = 60; // 글자당 타자 간격
const PAUSE_MS = 2800; // 줄과 줄 사이 멈춤
const OUTRO_MS = 1800; // 마지막에 화면이 걷히는 페이드
const TOTAL_MS = 60000; // 전체 고정 진행 시간(60초)

export default function OnboardingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  // 소등 단계에 진입하는 순간 한 번만 시작한다. 이후 phase가 바뀌어도 startedRef가 막는다.
  useEffect(() => {
    if (!startedRef.current && phase === "ONBOARDING") {
      startedRef.current = true;
      setStarted(true);
    }
  }, [phase]);

  const active = started && !done;

  // 진행 상태: 소등 → 타이핑(누적) → 고정 홀드 → 걷힘.
  const [stage, setStage] = useState<"intro" | "type" | "outro">("intro");
  const [reveal, setReveal] = useState(0); // 완전히 드러난 줄 수
  const [typed, setTyped] = useState(""); // 지금 타이핑 중인 줄의 부분 문자열

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

    // 전체 종료(걷힘)는 타이핑과 무관하게 60초에 고정한다.
    at(TOTAL_MS - OUTRO_MS, () => !cancelled && setStage("outro"));
    at(TOTAL_MS, () => !cancelled && setDone(true));

    if (reduce) {
      // 모션 최소화: 소등·타자 없이 전문을 바로 띄우고 60초 뒤 걷는다.
      setStage("type");
      setReveal(LINES.length);
    } else {
      at(INTRO_MS, () => {
        if (cancelled) return;
        setStage("type");
        typeLine(0);
      });
    }

    function typeLine(i: number) {
      if (cancelled || i >= LINES.length) return;
      const chars = Array.from(LINES[i].text);
      let c = 0;
      const step = () => {
        if (cancelled) return;
        c += 1;
        setTyped(chars.slice(0, c).join(""));
        if (c < chars.length) {
          at(TYPE_MS, step);
        } else {
          // 줄 완성 → 누적으로 밀어 넣고, 잠깐 쉬었다가 다음 줄.
          setReveal(i + 1);
          setTyped("");
          at(PAUSE_MS, () => typeLine(i + 1));
        }
      };
      step();
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active]);

  if (!active) return null;

  const typingLine = reveal < LINES.length && typed ? LINES[reveal] : null;

  return (
    // 조작은 막지 않는다 — 도입이 흐르는 동안에도 감방 안을 둘러볼 수 있어야 한다.
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-8 transition-opacity ease-out ${
        stage === "outro" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        transitionDuration: `${OUTRO_MS}ms`,
        background:
          stage === "intro"
            ? "#000"
            : "radial-gradient(120% 90% at 50% 55%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.86) 100%)",
      }}
    >
      <style>{`
        @keyframes obFlicker {
          0% { opacity: 0; } 8% { opacity: 1; } 12% { opacity: 0.5; }
          20% { opacity: 1; } 26% { opacity: 0.7; } 40% { opacity: 1; } 100% { opacity: 1; }
        }
        @keyframes obCaret { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes obBar { from { width: 0%; } to { width: 100%; } }
      `}</style>

      {stage === "intro" ? (
        // 소등: 화면이 깜빡이며 어두워진다.
        <p
          className="text-center text-2xl font-semibold tracking-[0.3em] text-slate-300"
          style={{ animation: `obFlicker ${INTRO_MS}ms ease-out both` }}
        >
          소등
        </p>
      ) : (
        <div className="w-full max-w-xl space-y-1 text-center">
          {LINES.slice(0, reveal).map((l, i) => (
            <NarrationLine key={i} line={l} text={l.text} />
          ))}
          {typingLine && (
            <NarrationLine line={typingLine} text={typed} caret />
          )}
        </div>
      )}

      {/* 60초 고정 진행 바 */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div
          className="h-full bg-slate-300/70"
          style={{ animation: `obBar ${TOTAL_MS}ms linear both` }}
        />
      </div>
    </div>
  );
}

// 한 줄 렌더: gapBefore(문단 간격) + boldLen(앞부분 볼드) + final(불길한 강조) + 타이핑 캐럿.
function NarrationLine({
  line,
  text,
  caret,
}: {
  line: Line;
  text: string;
  caret?: boolean;
}) {
  const bold = line.boldLen ?? 0;
  const head = bold > 0 ? text.slice(0, Math.min(bold, text.length)) : "";
  const rest = bold > 0 ? text.slice(head.length) : text;
  return (
    <p
      className={`leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] ${
        line.gapBefore ? "pt-4" : ""
      } ${
        line.final
          ? "text-[15px] tracking-wide text-amber-200/90"
          : "text-[15px] text-slate-100"
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

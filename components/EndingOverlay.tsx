"use client";
// 엔딩 연출. ENDED 단계에서 정체가 공개되면 뜬다.
//
// 결말은 탈출 성패 × AI 지목 성패 네 가지다(game/endings.ts). 각 결말마다 배경 연출과
// 소리가 다르고, 내레이션이 한 줄씩 떠오른 뒤 정체와 득표가 공개된다.
//
// 연출은 단계(beat)로 진행한다 — 타이머 하나로 0→1→2…를 올리고, 각 조각은 자기 beat에
// 도달했을 때만 렌더한다. 애니메이션마다 타이머를 두면 순서가 어긋나기 쉽다.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveEnding, type EndingKey } from "@/game/endings";
import { ESCAPE_PIPE_ID, useInteraction } from "@/game/interactables";
import { sfxBell, sfxDawn, sfxReveal, sfxSiren } from "@/game/sfx";
import { leaveRoom } from "@/net/session";
import { useGameStore } from "@/store/gameStore";

/** 연출 단계가 넘어가는 시각(ms, 오버레이가 뜬 순간 기준). */
const BEATS = [
  600, // 1: 배경 연출 시작
  1400, // 2: 제목
  2400, // 3~: 내레이션 한 줄씩(BEAT_LINE 간격)
];
const LINE_GAP = 2100;

export default function EndingOverlay() {
  const phase = useGameStore((s) => s.phase);
  const aiId = useGameStore((s) => s.aiId);
  const escaped = useInteraction((s) => !!s.solved[ESCAPE_PIPE_ID]);

  // 연출 본체는 결말이 확정된 뒤에만 마운트한다. 상태 초기화를 마운트에 맡기면
  // "다시 보일 때 beat를 0으로 되돌리는" 효과가 필요 없어진다.
  if (phase !== "ENDED" || !aiId) return null;
  return <EndingScene aiId={aiId} escaped={escaped} />;
}

function EndingScene({ aiId, escaped }: { aiId: string; escaped: boolean }) {
  const nicks = useGameStore((s) => s.nicks);
  const votes = useGameStore((s) => s.votes);
  const router = useRouter();

  // 득표 집계 → 최다 득표자가 진짜 AI였는가.
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const caught = !!top && top[0] === aiId;

  const ending = resolveEnding(escaped, caught);

  const [beat, setBeat] = useState(0);
  // BEATS의 마지막(2400ms)이 곧 첫 내레이션이다. 그래서 i번째 줄은 beat = BEATS.length + i,
  // 정체 공개는 마지막 줄 다음 beat다. 여기서 하나만 밀려도 아무것도 안 뜨는 빈 구간이 생긴다.
  const revealBeat = BEATS.length + ending.lines.length;

  // 결말이 뜨는 순간부터 연출 시계를 돌린다.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= revealBeat; i++) {
      const at =
        i <= BEATS.length ? BEATS[i - 1] : BEATS[2] + (i - BEATS.length) * LINE_GAP;
      timers.push(setTimeout(() => setBeat(i), at));
    }
    return () => timers.forEach(clearTimeout);
  }, [revealBeat]);

  // 결말별 소리. 정체 공개음은 마지막 beat에서 따로 울린다.
  useEffect(() => {
    if (ending.key === "perfect") sfxDawn();
    else if (ending.key === "recaptured") sfxSiren();
    else sfxBell();
  }, [ending.key]);

  useEffect(() => {
    if (beat >= revealBeat) sfxReveal();
  }, [beat, revealBeat]);

  const lineBeat = (i: number) => BEATS.length + i;

  function exit() {
    leaveRoom();
    router.push("/");
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 overflow-hidden bg-black">
      <style>{KEYFRAMES}</style>

      {beat >= 1 && <Backdrop kind={ending.key} />}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 text-center">
        {beat >= 2 && (
          <div style={{ animation: "endRise 900ms ease-out both" }}>
            <p className="mb-2 text-xs font-semibold tracking-[0.4em] text-white/45">
              {ending.kicker}
            </p>
            <h1
              className={`mb-8 text-5xl font-black drop-shadow-[0_2px_24px_rgba(0,0,0,0.9)] ${ending.accent}`}
            >
              {ending.title}
            </h1>
          </div>
        )}

        {/* 내레이션 — 한 줄씩 떠오른다 */}
        <div className="mb-8 max-w-lg space-y-3">
          {ending.lines.map((line, i) =>
            beat >= lineBeat(i) ? (
              <p
                key={i}
                className="text-[15px] leading-relaxed text-slate-200/90"
                style={{ animation: "endRise 1100ms ease-out both" }}
              >
                {line}
              </p>
            ) : null,
          )}
        </div>

        {/* 정체 공개 + 득표 */}
        {beat >= revealBeat && (
          <div
            className="w-full max-w-sm"
            style={{ animation: "endRise 900ms ease-out both" }}
          >
            <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-5 py-4">
              <p className="text-[11px] tracking-[0.3em] text-rose-300/70">AI</p>
              <p className="mt-1 text-2xl font-black text-rose-300">
                {aiId ? (nicks[aiId] ?? aiId) : "?"}
              </p>
            </div>

            {ranked.length > 0 && (
              <div className="mb-5 space-y-1.5">
                {ranked.map(([id, count]) => {
                  const isAi = id === aiId;
                  const max = ranked[0][1] || 1;
                  return (
                    <div key={id} className="flex items-center gap-2 text-left">
                      <span
                        className={`w-28 shrink-0 truncate text-xs ${
                          isAi ? "font-bold text-rose-300" : "text-slate-400"
                        }`}
                      >
                        {nicks[id] ?? id}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${isAi ? "bg-rose-400" : "bg-slate-500"}`}
                          style={{
                            width: `${(count / max) * 100}%`,
                            animation: "endBar 800ms ease-out both",
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-400">
                        {count}표
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={exit}
              className="w-full rounded-lg bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              로비로 나가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 결말별 배경 연출 ──────────────────────────────────────────────
function Backdrop({ kind }: { kind: EndingKey }) {
  if (kind === "perfect") {
    // 새벽이 아래에서 차오르고, 실루엣들이 오른쪽으로 걸어 나간다.
    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, #fb923c 0%, #f59e0b 18%, #7c3aed 48%, #0b0e14 78%)",
            animation: "endDawn 3500ms ease-out both",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: "linear-gradient(to top, #0b0e14, transparent)" }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute bottom-16 h-16 w-6 rounded-t-full bg-black/80"
            style={{ animation: `endWalk 6000ms ${i * 700}ms ease-in-out both` }}
          />
        ))}
      </div>
    );
  }

  if (kind === "recaptured") {
    // 붉은 사이렌이 좌우로 훑고, 창살이 위에서 내려온다.
    return (
      <div className="absolute inset-0 bg-[#160607]">
        <div
          className="absolute inset-y-0 w-1/2"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(244,63,94,0.55), transparent 70%)",
            animation: "endSiren 1800ms ease-in-out infinite",
          }}
        />
        <Bars anim="endBarsDrop 1200ms 400ms ease-in both" />
      </div>
    );
  }

  if (kind === "partial") {
    // 스포트라이트 하나와 종소리의 파문.
    return (
      <div className="absolute inset-0 bg-[#070b12]">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 42%, rgba(56,189,248,0.22), transparent 55%)",
            animation: "endPulse 3000ms ease-in-out infinite",
          }}
        />
        <Bars anim="endBarsFade 2000ms ease-out both" opacity={0.35} />
      </div>
    );
  }

  // worst — 붉게 물든 뒤 창살이 내려와 닫힌다.
  return (
    <div className="absolute inset-0 bg-black">
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, #4c0519, #000 75%)",
          animation: "endFlood 2500ms ease-out both",
        }}
      />
      <Bars anim="endBarsSlam 900ms 300ms cubic-bezier(0.6,0,0.9,1) both" />
    </div>
  );
}

/** 창살 실루엣. 결말마다 내려오는 방식만 다르다. */
function Bars({ anim, opacity = 0.7 }: { anim: string; opacity?: number }) {
  return (
    <div className="absolute inset-0" style={{ animation: anim, opacity }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-3 bg-black"
          style={{ left: `${6 + i * 11}%` }}
        />
      ))}
    </div>
  );
}

const KEYFRAMES = `
@keyframes endRise {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes endBar {
  from { width: 0; }
}
@keyframes endDawn {
  from { opacity: 0; transform: translateY(45%); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes endWalk {
  from { left: 38%; opacity: 0; }
  25%  { opacity: 0.85; }
  to   { left: 104%; opacity: 0; }
}
@keyframes endSiren {
  0%, 100% { left: -12%; }
  50%      { left: 62%; }
}
@keyframes endPulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
@keyframes endFlood {
  from { opacity: 0; transform: scale(1.5); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes endBarsDrop {
  from { transform: translateY(-100%); }
  to   { transform: translateY(0); }
}
@keyframes endBarsSlam {
  from { transform: translateY(-100%); }
  to   { transform: translateY(0); }
}
@keyframes endBarsFade {
  from { opacity: 0; }
}
/* 연출이 부담스러운 사람에겐 움직임을 줄인다(접근성 기본값 존중) */
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
`;

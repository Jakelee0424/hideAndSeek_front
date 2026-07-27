"use client";
// 정기 순찰 경고. 서버가 순찰 상태를 실어 보내면 뜬다.
//
// 규칙상 조작을 막지 않는다 — 멈추는 건 플레이어 몫이다. 그래서 이 화면은 시야를 가리지도,
// 클릭을 먹지도 않는다(pointer-events-none). 대신 순찰이 도는 동안임을 놓칠 수 없게
// 화면 가장자리를 붉게 물들이고 남은 시간을 크게 센다.
//
// ⚠️ 적발 조건이 바뀌었다. 예전엔 "순찰 중 맵 어디서든 움직이면"이라 이 배너가 곧 규칙이었지만,
//    지금은 **간수 시야 안에서** 움직여야 걸린다. 시야 밖이면 뛰어도 안전하다 —
//    실제로 어디가 위험한지는 바닥의 노란 부채꼴(PatrolGuards)이 알려 준다.
//    그래서 여기 문구는 "움직이지 마라"가 아니라 "시야를 피해라"여야 한다.
//
// 카운트다운은 서버가 준 남은 시간에서 로컬로 진행한다(단계 카운트다운과 같은 규약).
import { useEffect, useRef, useState } from "react";
import { sfxCaught, sfxPatrolWarn, sfxWhistle } from "@/game/sfx";
import { useGameStore } from "@/store/gameStore";

/** 적발 문구를 띄워 두는 시간(ms). */
const CAUGHT_MS = 4000;

export default function PatrolOverlay() {
  const patrol = useGameStore((s) => s.patrol);
  const patrolEndsAt = useGameStore((s) => s.patrolEndsAt);
  const caughtId = useGameStore((s) => s.patrolCaughtId);
  const myId = useGameStore((s) => s.myId);
  const nicks = useGameStore((s) => s.nicks);

  const [now, setNow] = useState(() => Date.now());
  const [caughtShown, setCaughtShown] = useState<string | null>(null);
  const heardCaught = useRef<string | null>(null);

  // 1초 틱. 표시가 초 단위라 매 프레임 돌 이유가 없다.
  useEffect(() => {
    if (patrol === "NONE") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [patrol]);

  // 상태가 바뀌는 순간의 소리.
  useEffect(() => {
    if (patrol === "WARNING") sfxPatrolWarn();
    else if (patrol === "ACTIVE") sfxWhistle();
  }, [patrol]);

  // 누가 걸린 순간. 같은 사람으로 두 번 울리지 않게 마지막으로 들은 값을 기억한다.
  useEffect(() => {
    if (!caughtId || heardCaught.current === caughtId) return;
    heardCaught.current = caughtId;
    sfxCaught();
    setCaughtShown(caughtId);
    const t = setTimeout(() => setCaughtShown(null), CAUGHT_MS);
    return () => clearTimeout(t);
  }, [caughtId]);

  const remainSec = patrolEndsAt
    ? Math.max(0, Math.ceil((patrolEndsAt - now) / 1000))
    : 0;

  if (patrol === "NONE" && !caughtShown) return null;

  const active = patrol === "ACTIVE";
  const caughtNick = caughtShown
    ? caughtShown === myId
      ? "당신"
      : (nicks[caughtShown] ?? caughtShown)
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <style>{KEYFRAMES}</style>

      {/* 가장자리 붉은 테두리 — 순찰 중에만. 화면 가운데를 가리지 않는다. */}
      {active && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: "inset 0 0 140px 30px rgba(244,63,94,0.55)",
            animation: "patPulse 1.6s ease-in-out infinite",
          }}
        />
      )}

      {patrol !== "NONE" && (
        <div className="absolute left-1/2 top-20 -translate-x-1/2 text-center">
          <div
            className={`rounded-xl border px-6 py-3 backdrop-blur ${
              active
                ? "border-rose-400/50 bg-rose-950/70"
                : "border-amber-400/40 bg-amber-950/60"
            }`}
            style={{ animation: "patDrop 400ms ease-out both" }}
          >
            <p
              className={`text-xs font-semibold tracking-[0.3em] ${
                active ? "text-rose-300" : "text-amber-300"
              }`}
            >
              {active ? "순 찰 중" : "순찰이 다가온다"}
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {active ? "간수를 피해라" : "숨을 준비"}
            </p>
            <p className="mt-1 font-mono text-3xl tabular-nums text-white/90">
              {remainSec}
            </p>
            <p className="mt-1 text-[11px] text-white/50">
              {active
                ? "노란 부채꼴 안에서 움직이면 자정이 앞당겨진다"
                : "곧 간수가 복도를 돈다"}
            </p>
          </div>
        </div>
      )}

      {caughtNick && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 text-center">
          <div
            className="rounded-xl border border-rose-400/60 bg-rose-950/85 px-8 py-4 backdrop-blur"
            style={{ animation: "patShake 500ms ease-out both" }}
          >
            <p className="text-sm font-bold tracking-widest text-rose-300">
              들켰다
            </p>
            <p className="mt-1 text-xl font-black text-white">
              {caughtNick}의 움직임이 간수에게 들켰다
            </p>
            <p className="mt-1 text-sm text-rose-200/80">자정이 앞당겨진다</p>
          </div>
        </div>
      )}
    </div>
  );
}

const KEYFRAMES = `
@keyframes patPulse {
  0%, 100% { opacity: 0.65; }
  50%      { opacity: 1; }
}
@keyframes patDrop {
  from { opacity: 0; transform: translateY(-14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes patShake {
  0%   { opacity: 0; transform: scale(1.15); }
  40%  { opacity: 1; transform: scale(1); }
  55%  { transform: translateX(-6px); }
  70%  { transform: translateX(6px); }
  100% { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="animation"] { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
}
`;

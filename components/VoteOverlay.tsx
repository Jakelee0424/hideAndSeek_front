"use client";
// AI 지목 투표. VOTE 단계에만 뜬다.
//
// 서버는 결말 전까지 roster.bot을 전부 false로 보내고 aiId도 싣지 않는다.
// 그래서 이 화면이 켜져 있는 동안 클라는 누가 AI인지 알 방법이 없다.
//
// 결과 공개(ENDED)는 EndingOverlay가 맡는다 — 결말이 탈출 성패와 엮이면서
// 여기 붙여 두기엔 연출이 커졌다.
import { useEffect, useState } from "react";
import { sendVote } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";

export default function VoteOverlay() {
  const phase = useGameStore((s) => s.phase);
  const myId = useGameStore((s) => s.myId);
  const roomId = useGameStore((s) => s.roomId);
  const playerIds = useGameStore((s) => s.playerIds);
  const nicks = useGameStore((s) => s.nicks);
  const votes = useGameStore((s) => s.votes);
  const phaseEndsAt = useGameStore((s) => s.phaseEndsAt);

  const voting = phase === "VOTE";

  // 남은 시간 표시용 1초 틱. 이 오버레이(z-30)가 PhaseBanner를 덮어 버려서, 투표 중에는
  // 상단 카운트다운이 보이지 않는다. 그래서 여기서 따로 보여준다.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!voting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [voting]);
  const remainSec = phaseEndsAt
    ? Math.max(0, Math.ceil((phaseEndsAt - now) / 1000))
    : 0;

  if (!voting) return null;

  const myVote = myId ? votes[myId] : undefined;

  // 득표 집계(지목 현황을 실시간으로 보여 준다).
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12161f] p-6 text-slate-100 shadow-2xl">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-bold">누가 AI였을까?</h2>
          <span
            className={`font-mono text-2xl tabular-nums ${
              remainSec <= 10 ? "text-rose-400" : "text-slate-300"
            }`}
          >
            {remainSec}
          </span>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          함께 탈옥한 사람 중 하나는 AI였습니다. 시간이 끝나면 정체가 공개됩니다.
        </p>

        <div className="flex flex-col gap-2">
          {playerIds
            .filter((id) => id !== myId)
            .map((id) => {
              const count = tally[id] ?? 0;
              const mine = myVote === id;
              return (
                <button
                  key={id}
                  onClick={() => roomId && sendVote(roomId, id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    mine
                      ? "border-sky-400 bg-sky-500/20"
                      : "border-white/10 bg-black/30 hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">{nicks[id] ?? id}</span>
                  <span className="text-sm text-slate-400">
                    {count > 0 ? `${count}표` : ""}
                  </span>
                </button>
              );
            })}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {myVote ? "다시 눌러 바꿀 수 있습니다." : "아직 지목하지 않았습니다."}
        </p>
      </div>
    </div>
  );
}

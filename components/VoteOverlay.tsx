"use client";
// AI 지목 투표. VOTE 단계에 투표판이 뜨고, ENDED에 정답이 공개된다.
//
// 서버는 결말 전까지 roster.bot을 전부 false로 보내고 aiId도 싣지 않는다.
// 그래서 이 화면이 켜져 있는 동안 클라는 누가 AI인지 알 방법이 없다.
import { sendVote } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";

export default function VoteOverlay() {
  const phase = useGameStore((s) => s.phase);
  const myId = useGameStore((s) => s.myId);
  const roomId = useGameStore((s) => s.roomId);
  const playerIds = useGameStore((s) => s.playerIds);
  const nicks = useGameStore((s) => s.nicks);
  const votes = useGameStore((s) => s.votes);
  const aiId = useGameStore((s) => s.aiId);

  const voting = phase === "VOTE";
  const revealed = phase === "ENDED" && !!aiId;
  if (!voting && !revealed) return null;

  const myVote = myId ? votes[myId] : undefined;

  // 득표 집계.
  const tally: Record<string, number> = {};
  for (const target of Object.values(votes)) {
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const caught = revealed && top?.[0] === aiId;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12161f] p-6 text-slate-100 shadow-2xl">
        {revealed ? (
          <>
            <p className="mb-1 text-sm font-medium tracking-[0.25em] text-amber-300/80">
              RESULT
            </p>
            <h2 className="mb-4 text-2xl font-black">
              {caught ? "AI를 찾아냈다" : "AI가 숨는 데 성공했다"}
            </h2>
            <p className="mb-5 text-sm text-slate-300">
              AI는{" "}
              <span className="font-bold text-rose-300">
                {aiId ? (nicks[aiId] ?? aiId) : "?"}
              </span>
              였습니다.
              {top && (
                <>
                  {" "}
                  최다 득표는 {nicks[top[0]] ?? top[0]} ({top[1]}표).
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-bold">누가 AI였을까?</h2>
            <p className="mb-4 text-sm text-slate-400">
              함께 탈옥한 사람 중 하나는 AI였습니다. 지목하세요.
            </p>
          </>
        )}

        <div className="flex flex-col gap-2">
          {playerIds
            .filter((id) => id !== myId)
            .map((id) => {
              const count = tally[id] ?? 0;
              const mine = myVote === id;
              const isAi = revealed && id === aiId;
              return (
                <button
                  key={id}
                  disabled={revealed}
                  onClick={() => roomId && sendVote(roomId, id)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    isAi
                      ? "border-rose-400 bg-rose-500/20"
                      : mine
                        ? "border-sky-400 bg-sky-500/20"
                        : "border-white/10 bg-black/30 enabled:hover:bg-white/5"
                  }`}
                >
                  <span className="font-medium">
                    {nicks[id] ?? id}
                    {isAi && (
                      <span className="ml-2 text-xs text-rose-300">AI</span>
                    )}
                  </span>
                  <span className="text-sm text-slate-400">
                    {count > 0 ? `${count}표` : ""}
                  </span>
                </button>
              );
            })}
        </div>

        {voting && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {myVote ? "다시 눌러 바꿀 수 있습니다." : "아직 지목하지 않았습니다."}
          </p>
        )}
      </div>
    </div>
  );
}

"use client";
// 대기방: 입장한 플레이어 목록 + 준비 토글 + (방장) 게임 시작.
// 백엔드 연결 전에도 본인은 목록에 표시된다(store에 시드됨).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { joinRoom, leaveRoom } from "@/net/session";

const STATUS_LABEL: Record<string, string> = {
  idle: "연결 끊김",
  connecting: "연결 중…",
  connected: "서버 연결됨",
  error: "서버 오프라인 (로컬 대기)",
};

export default function WaitingRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const status = useGameStore((s) => s.status);
  const myId = useGameStore((s) => s.myId);
  const myNick = useGameStore((s) => s.myNick);
  const ready = useGameStore((s) => s.ready);
  const setReady = useGameStore((s) => s.setReady);
  const playerIds = useGameStore((s) => s.playerIds);
  const nicks = useGameStore((s) => s.nicks);
  const bots = useGameStore((s) => s.bots);

  // 닉네임 없이 직접/새로고침으로 들어온 경우 로비로 돌려보냄
  useEffect(() => {
    if (!myNick) {
      router.replace("/");
      return;
    }
    // 세션이 없으면(예: 새로고침) 다시 입장
    if (!myId) joinRoom(roomId, myNick);
  }, [myNick, myId, roomId, router]);

  // 방장 = 목록의 첫 번째 "사람"(서버 없을 땐 본인).
  // 봇을 빼지 않으면 봇이 방장이 되어 사람에게 시작 버튼이 안 뜬다 — 스냅샷의 플레이어 순서는
  // 서버 ConcurrentHashMap 순회 순서라 사람이 먼저라는 보장이 없다.
  const hostId = playerIds.find((id) => !bots[id]);
  const isHost = hostId === myId;
  const allReady = playerIds.length > 0; // TODO: 서버 연동 시 전원 ready 체크

  function start() {
    router.push(`/rooms/${roomId}/play`);
  }

  function leave() {
    leaveRoom();
    router.push("/");
  }

  if (!myNick) return null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0b0f17] p-6 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">방 코드</p>
            <p className="text-2xl font-bold tracking-widest">{roomId}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === "connected"
                ? "bg-emerald-500/20 text-emerald-300"
                : status === "error"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-slate-500/20 text-slate-300"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        <p className="mb-2 text-xs font-medium text-slate-400">
          플레이어 ({playerIds.length})
        </p>
        <ul className="mb-6 space-y-2">
          {playerIds.map((id, i) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-500">#{i + 1}</span>
                <span className="font-medium">{nicks[id] ?? id}</span>
                {id === myId && (
                  <span className="text-xs text-sky-400">(나)</span>
                )}
                {bots[id] && (
                  <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                    AI
                  </span>
                )}
                {id === hostId && (
                  <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-300">
                    방장
                  </span>
                )}
              </span>
              {id === myId && ready && (
                <span className="text-xs text-emerald-400">준비완료</span>
              )}
            </li>
          ))}
        </ul>

        <button
          onClick={() => setReady(!ready)}
          className={`mb-2 w-full rounded-lg py-2.5 text-sm font-semibold transition ${
            ready
              ? "bg-emerald-500 text-white hover:bg-emerald-400"
              : "border border-white/10 text-slate-200 hover:bg-white/5"
          }`}
        >
          {ready ? "준비 완료 ✓" : "준비하기"}
        </button>

        {isHost && (
          <button
            onClick={start}
            disabled={!allReady}
            className="mb-2 w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-40"
          >
            게임 시작
          </button>
        )}

        <button
          onClick={leave}
          className="w-full rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
        >
          나가기
        </button>
      </div>
    </main>
  );
}

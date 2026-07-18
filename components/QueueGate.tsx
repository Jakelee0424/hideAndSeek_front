"use client";
// 접속 대기열 화면. 정원이 차서 줄을 선 동안 순번을 1초마다 폴링해 보여준다.
// 승급되면(ADMITTED) onAdmitted로 토큰을 넘기고, 호출자가 방으로 들여보낸다.
//
// ⚠️ WaitingRoom.tsx(대기방)와 다른 것이다. 대기방은 게임 시작 전 플레이어가 모이는
//    방 안의 화면이고, 이건 그보다 앞단에서 접속 자체를 막는 관문이다.
import { useEffect, useRef, useState } from "react";
import { enterQueue, leaveQueue, queueStatus, type QueueTicket } from "@/net/queue";

const POLL_MS = 1000;

export default function QueueGate({
  playerId,
  nick,
  initial,
  onAdmitted,
  onCancel,
  cancellable = true,
}: {
  playerId: string;
  nick: string;
  initial: QueueTicket;
  onAdmitted: (token: string | null) => void;
  onCancel: () => void;
  /** 접속 관문으로 쓸 때는 취소해도 갈 곳이 없어 버튼을 숨긴다. */
  cancellable?: boolean;
}) {
  const [ticket, setTicket] = useState<QueueTicket>(initial);
  const [error, setError] = useState<string | null>(null);
  // onAdmitted가 매 렌더 새 함수여도 폴링이 재시작되지 않도록 ref로 고정한다.
  const admittedRef = useRef(onAdmitted);
  admittedRef.current = onAdmitted;

  useEffect(() => {
    let alive = true;
    const timer = setInterval(async () => {
      try {
        let next = await queueStatus(playerId);
        // 서버에서 사라졌다(재시작·TTL 회수 등) → 조용히 다시 줄을 선다.
        if (next === null) next = await enterQueue(playerId, nick);
        if (!alive) return;
        setTicket(next);
        setError(null);
        if (next.status === "ADMITTED") {
          clearInterval(timer);
          admittedRef.current(next.token);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "대기열 조회 실패");
      }
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [playerId, nick]);

  const ahead = Math.max(ticket.position - 1, 0);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0b0f17] p-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">잠시만요</h1>
        <p className="mb-6 text-sm text-slate-400">
          지금 접속이 많아 순서대로 입장하고 있어요
        </p>

        <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-6">
          <div className="text-xs font-medium text-slate-400">내 순번</div>
          <div className="my-1 text-5xl font-bold tabular-nums text-sky-400">
            {ticket.position}
          </div>
          <div className="text-xs text-slate-400">
            {ahead === 0 ? "다음 차례예요" : `앞에 ${ahead}명`}
          </div>
        </div>

        <div className="mb-6 flex justify-center gap-6 text-xs text-slate-400">
          <span>
            입장 <span className="tabular-nums text-slate-200">{ticket.active}</span>
            <span className="tabular-nums">/{ticket.capacity}</span>
          </span>
          <span>
            대기 <span className="tabular-nums text-slate-200">{ticket.waiting}</span>명
          </span>
        </div>

        {error && (
          <p className="mb-4 text-xs text-amber-400">
            {error} — 계속 재시도 중이에요
          </p>
        )}

        {cancellable && (
          <button
            onClick={async () => {
              await leaveQueue(playerId);
              onCancel();
            }}
            className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5"
          >
            대기 취소
          </button>
        )}
      </div>
    </main>
  );
}

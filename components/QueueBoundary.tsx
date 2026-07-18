"use client";
// 사이트 접속 자체를 막는 관문. 페이지에 들어오는 순간 대기열에 등록하고,
// 통과한 사람에게만 children(로비)을 보여준다.
//
// 통과 후에도 방에 들어가기 전까지 폴링을 유지한다 — 서버가 이 폴링을 keepalive로 보고
// TTL을 갱신하기 때문이다. 안 그러면 로비에서 닉네임 치는 30초 사이에 자리를 뺏긴다.
import { useEffect, useRef, useState } from "react";
import { enterQueue, queueStatus, type QueueTicket } from "@/net/queue";
import QueueGate from "./QueueGate";

/** 통과 후 자리를 지키기 위한 폴링 주기. TTL(30s)보다 충분히 짧아야 한다. */
const KEEPALIVE_MS = 5000;

/**
 * 방문자 식별자. sessionStorage라 탭마다 다른 사람으로 취급된다 —
 * localStorage로 두면 탭을 여러 개 열어도 같은 슬롯을 공유해 대기열 테스트가 불가능해진다.
 */
function visitorId(): string {
  const KEY = "queue.visitorId";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export default function QueueBoundary({
  children,
}: {
  children: (admission: { playerId: string; token: string | null }) => React.ReactNode;
}) {
  const [state, setState] = useState<
    | { phase: "checking" }
    | { phase: "waiting"; playerId: string; ticket: QueueTicket }
    | { phase: "admitted"; playerId: string; token: string | null }
    | { phase: "error"; message: string }
  >({ phase: "checking" });

  // 최신 상태를 keepalive 타이머에서 읽기 위한 ref(타이머를 재설치하지 않으려고).
  const admittedRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const id = visitorId();

    (async () => {
      try {
        const ticket = await enterQueue(id, "");
        if (!alive) return;
        if (ticket.status === "ADMITTED") {
          admittedRef.current = id;
          setState({ phase: "admitted", playerId: id, token: ticket.token });
        } else {
          setState({ phase: "waiting", playerId: id, ticket });
        }
      } catch (e) {
        if (alive) {
          setState({
            phase: "error",
            message: e instanceof Error ? e.message : "서버에 연결할 수 없어요",
          });
        }
      }
    })();

    // 통과한 뒤 자리 유지용 keepalive. 방에 들어가면 STOMP 연결이 자리를 지키므로
    // 그때부터는 이 폴링이 없어도 되지만, 로비로 되돌아오는 경우까지 감안해 계속 둔다.
    //
    // 응답을 반드시 확인해야 한다. 서버가 재시작했거나(인메모리라 큐가 비워진다) 탭이 절전돼
    // 폴링이 끊긴 사이 슬롯이 회수되면 404(null)가 온다. 이걸 무시하면 클라만 "통과"인 채로
    // 로비를 보여주다가, 닉네임까지 입력한 뒤 joinRoom에서 조용히 거부된다.
    const timer = setInterval(async () => {
      const id = admittedRef.current;
      if (!id) return;
      try {
        let next = await queueStatus(id);
        if (next === null) next = await enterQueue(id, ""); // 슬롯이 사라졌다 → 다시 줄을 선다
        if (!alive) return;
        if (next.status === "ADMITTED") return; // 자리 유지됨
        // 밀려났다 → 대기 화면으로 되돌린다.
        admittedRef.current = null;
        setState({ phase: "waiting", playerId: id, ticket: next });
      } catch {
        // 일시적 네트워크 오류는 넘긴다 — 한 번 실패했다고 사용자를 내보내면 안 된다.
        // 진짜로 자리를 잃었다면 다음 폴링에서 404로 드러난다.
      }
    }, KEEPALIVE_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (state.phase === "checking") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0b0f17] text-sm text-slate-400">
        접속 확인 중…
      </main>
    );
  }

  if (state.phase === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#0b0f17] p-6 text-slate-100">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="mb-4 text-sm text-amber-300">{state.message}</p>
          <button
            onClick={() => location.reload()}
            className="w-full rounded-lg border border-white/10 py-2.5 text-sm text-slate-300 hover:bg-white/5"
          >
            다시 시도
          </button>
        </div>
      </main>
    );
  }

  if (state.phase === "waiting") {
    return (
      <QueueGate
        playerId={state.playerId}
        nick=""
        initial={state.ticket}
        onAdmitted={(token) => {
          admittedRef.current = state.playerId;
          setState({ phase: "admitted", playerId: state.playerId, token });
        }}
        // 접속 관문에서는 취소해도 갈 곳이 없다 → 줄을 계속 서게 두고 버튼만 숨긴다.
        onCancel={() => {}}
        cancellable={false}
      />
    );
  }

  return <>{children({ playerId: state.playerId, token: state.token })}</>;
}

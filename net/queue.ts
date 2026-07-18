// 접속 대기열(Virtual Waiting Room) REST 클라이언트.
// 게임 트래픽은 STOMP지만 대기열은 REST다 — "아직 게임에 못 들어온 사람"이 쓰는 것이라
// 게임 연결 위에 얹으면 앞뒤가 바뀐다. 백엔드 net/QueueController와 필드명 일치.

/** 백엔드 QueueTicket과 필드명 일치. */
export interface QueueTicket {
  status: "ADMITTED" | "WAITING";
  /** 대기 순번(1부터). ADMITTED면 0. */
  position: number;
  /** 입장 토큰. WAITING이면 null. STOMP join에 실어 보낸다. */
  token: string | null;
  /** 현재 대기 인원 */
  waiting: number;
  /** 동시 입장 정원 */
  capacity: number;
  /** 현재 입장해 있는 인원 */
  active: number;
}

/**
 * REST 베이스 URL. 별도 env를 두지 않고 WS URL에서 유도한다
 * (ws://host:8081/ws → http://host:8081). 둘이 어긋나 대기열만 다른 서버를 보는 사고를 막는다.
 */
const API_BASE = (() => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  const ws = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
  return ws.replace(/^ws/, "http").replace(/\/ws$/, "");
})();

/** 대기열 진입(멱등). 자리가 있으면 바로 ADMITTED가 돌아온다. */
export async function enterQueue(
  id: string,
  nick: string,
): Promise<QueueTicket> {
  const res = await fetch(`${API_BASE}/api/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, nick }),
  });
  if (!res.ok) throw new Error(`대기열 진입 실패 (${res.status})`);
  return res.json();
}

/** 순번 폴링. 서버에서 사라졌으면(만료 등) null → 호출자가 다시 enterQueue 한다. */
export async function queueStatus(id: string): Promise<QueueTicket | null> {
  const res = await fetch(`${API_BASE}/api/queue/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`대기열 조회 실패 (${res.status})`);
  return res.json();
}

/** 대기 취소 / 자리 반납. 브라우저를 닫는 경우는 서버가 WS 종료로 알아서 처리한다. */
export async function leaveQueue(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/queue/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {
    /* 이탈은 실패해도 그만 — 서버가 TTL로 회수한다 */
  });
}

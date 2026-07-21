// STOMP(WebSocket) 저수준 래퍼. 목적지 규약은 백엔드 CLAUDE.md와 일치시킬 것.
//   구독: /topic/rooms/{roomId}/state   (월드 스냅샷)
//   발행: /app/rooms/{roomId}/join      (입장)
//   발행: /app/rooms/{roomId}/input     (이동 의도)
//
// 주의: 네이티브 WebSocket을 사용한다(SockJS 아님).
//       → 백엔드는 registerStompEndpoints("/ws")에 .withSockJS()를 붙이지 말 것.
import { Client } from "@stomp/stompjs";
import type {
  ChatEvent,
  ConnStatus,
  InputMessage,
  JoinMessage,
  WorldSnapshot,
} from "./types";

interface Handlers {
  onStatus: (s: ConnStatus) => void;
  onSnapshot: (snap: WorldSnapshot) => void;
  onChat: (e: ChatEvent) => void;
}

let client: Client | null = null;

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";

export function connect(
  roomId: string,
  join: JoinMessage,
  handlers: Handlers,
): void {
  disconnect();

  client = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => {
      client?.subscribe(`/topic/rooms/${roomId}/state`, (msg) => {
        try {
          handlers.onSnapshot(JSON.parse(msg.body) as WorldSnapshot);
        } catch {
          /* 잘못된 payload 무시 */
        }
      });
      // 채팅은 스냅샷과 별도 토픽이다(저빈도 + 유실되면 안 되는 값).
      client?.subscribe(`/topic/rooms/${roomId}/chat`, (msg) => {
        try {
          handlers.onChat(JSON.parse(msg.body) as ChatEvent);
        } catch {
          /* 잘못된 payload 무시 */
        }
      });
      client?.publish({
        destination: `/app/rooms/${roomId}/join`,
        body: JSON.stringify(join),
      });
      handlers.onStatus("connected");
    },
    onWebSocketError: () => handlers.onStatus("error"),
    onStompError: () => handlers.onStatus("error"),
    onWebSocketClose: () => handlers.onStatus("idle"),
  });

  handlers.onStatus("connecting");
  client.activate();
}

export function sendInput(roomId: string, input: InputMessage): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/input`,
      body: JSON.stringify(input),
    });
  }
}

/** 펀치. 누굴 맞혔는지·넉백은 서버가 위치로 정하므로(위조 방지) 페이로드 없이 보낸다. */
export function sendPunch(roomId: string): void {
  if (client?.connected) {
    client.publish({ destination: `/app/rooms/${roomId}/punch`, body: "{}" });
  }
}

export function sendSolve(roomId: string, objectId: string): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/solve`,
      body: JSON.stringify({ objectId }),
    });
  }
}

/** 대기방 준비 토글. 누구인지는 서버가 STOMP 세션에서 알아낸다. */
export function sendReady(roomId: string, ready: boolean): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/ready`,
      body: JSON.stringify({ ready }),
    });
  }
}

/** 게임 시작 요청. 전원이 준비돼 있지 않으면 서버가 무시한다. */
export function sendStart(roomId: string): void {
  if (client?.connected) {
    client.publish({ destination: `/app/rooms/${roomId}/start`, body: "{}" });
  }
}

/** AI 지목 투표. 투표자는 서버가 STOMP 세션에서 알아내므로 대상만 보낸다. */
export function sendVote(roomId: string, targetId: string): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/vote`,
      body: JSON.stringify({ targetId }),
    });
  }
}

/**
 * 채팅 발화. 말한 사람은 서버가 STOMP 세션에서 알아내므로 본문만 보낸다 —
 * 여기서 id를 실어 보내면 남의 이름으로 발언을 지어낼 수 있고, 마지막 단계가
 * 말을 근거로 AI를 가리는 투표라 그건 게임을 무너뜨린다.
 */
export function sendChat(roomId: string, text: string): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/chat`,
      body: JSON.stringify({ text }),
    });
  }
}

/** 감방문 열림 상태 토글 요청. 서버가 실제 상태를 확정해 스냅샷 openDoors로 되돌린다. */
export function sendDoor(roomId: string, doorId: string): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/door`,
      body: JSON.stringify({ doorId }),
    });
  }
}

export function disconnect(): void {
  client?.deactivate();
  client = null;
}

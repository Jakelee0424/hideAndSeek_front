// STOMP(WebSocket) 저수준 래퍼. 목적지 규약은 백엔드 CLAUDE.md와 일치시킬 것.
//   구독: /topic/rooms/{roomId}/state   (월드 스냅샷)
//   발행: /app/rooms/{roomId}/join      (입장)
//   발행: /app/rooms/{roomId}/input     (이동 의도)
//
// 주의: 네이티브 WebSocket을 사용한다(SockJS 아님).
//       → 백엔드는 registerStompEndpoints("/ws")에 .withSockJS()를 붙이지 말 것.
import { Client } from "@stomp/stompjs";
import type {
  ConnStatus,
  InputMessage,
  JoinMessage,
  WorldSnapshot,
} from "./types";

interface Handlers {
  onStatus: (s: ConnStatus) => void;
  onSnapshot: (snap: WorldSnapshot) => void;
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

export function sendSolve(roomId: string, objectId: string): void {
  if (client?.connected) {
    client.publish({
      destination: `/app/rooms/${roomId}/solve`,
      body: JSON.stringify({ objectId }),
    });
  }
}

export function disconnect(): void {
  client?.deactivate();
  client = null;
}

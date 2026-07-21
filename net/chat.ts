// 인게임 채팅 상태(zustand).
//
// worldState/punches와 달리 스토어(리렌더 유발)로 두는 이유: 채팅은 저빈도 이벤트이고
// 화면에 목록으로 남아야 한다. 20Hz로 갱신되는 값이 아니라 리렌더 비용이 문제되지 않는다.
//
// composing은 "지금 입력창에 타이핑 중"이라는 뜻이다. 이동·시점·상호작용을 막는 데 쓰인다 —
// 퍼즐 오버레이의 openId와 정확히 같은 역할이라, 게이팅 지점도 그쪽과 같은 곳에 둔다.
import { create } from "zustand";
import type { ChatEvent } from "./types";

/**
 * 화면에 들고 있는 최대 줄 수. 넘으면 오래된 것부터 버린다.
 * 한 판이 20분이라 상한이 없으면 계속 쌓인다.
 */
const MAX_LINES = 60;

/** 로그에 남는 줄. 서버 이벤트 + 클라가 붙인 표시용 키. */
export interface ChatLine extends ChatEvent {
  /** React key. 같은 사람이 같은 ms에 두 줄을 보낼 수 없어 (senderId, at, seq)면 충분하다. */
  key: string;
}

interface ChatStore {
  lines: ChatLine[];
  /** 입력창에 타이핑 중인가. true면 이동·시점·상호작용을 막는다. */
  composing: boolean;
  /** 마지막으로 읽은 뒤 새로 온 줄 수. 입력창을 닫고 있을 때 뱃지로 보여준다. */
  unread: number;

  receive: (e: ChatEvent) => void;
  setComposing: (v: boolean) => void;
  clear: () => void;
}

let seq = 0;

export const useChat = create<ChatStore>((set) => ({
  lines: [],
  composing: false,
  unread: 0,

  receive: (e) =>
    set((s) => {
      const next = [...s.lines, { ...e, key: `${e.senderId}-${e.at}-${seq++}` }];
      return {
        lines: next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next,
        // 입력창을 열어 두고 있으면 이미 보고 있는 것이라 안 읽음으로 세지 않는다.
        unread: s.composing ? 0 : s.unread + 1,
      };
    }),

  setComposing: (v) => set(v ? { composing: true, unread: 0 } : { composing: false }),

  clear: () => set({ lines: [], composing: false, unread: 0 }),
}));

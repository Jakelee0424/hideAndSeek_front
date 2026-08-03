// 인게임 감정표현(이모트). 예전엔 텍스트 채팅이었는데, 1~4 단축키로 정해진 감정만
// 표현하는 방식으로 바꿨다. 표현은 머리 위 말풍선으로 잠깐 떴다 사라진다.
//
// 전송은 기존 채팅 토픽(/topic/rooms/{id}/chat)을 그대로 재사용한다 — 저빈도 + 유실되면
// 안 되는 값이라 스냅샷이 아니라 전용 토픽이 맞고, 백엔드를 건드리지 않아도 된다.
// 채팅 본문(text)에 사람이 칠 수 없는 토큰을 실어 보내고, 받는 쪽에서 그 토큰만 골라낸다.
// (봇이 흘리는 자연어 채팅은 토큰이 아니라 parseEmote가 null로 걸러 무시된다.)
//
// worldState/punches처럼 "머리 위에 잠깐 뜨는 저빈도 이벤트"라, 리렌더를 부르는 zustand
// 스토어가 아니라 모듈 싱글턴 버스로 둔다. 각 플레이어 컴포넌트가 useFrame에서 폴링해
// 값이 바뀔 때만(=말풍선이 뜨거나 질 때만) setState 한다(punches의 lastHitAt과 같은 패턴).

export type EmoteId = "hello" | "laugh" | "sad" | "angry";

export interface EmoteDef {
  id: EmoteId;
  /** 안내·발동에 쓰는 숫자 키(문자). Digit/Numpad 양쪽 코드에 매핑된다. */
  key: string;
  /** 말풍선·안내에 쓰는 이모지. */
  glyph: string;
  /** 안내 라벨. */
  label: string;
}

// 표시 순서 = 키 순서(1~4). HUD 안내가 이 배열을 그대로 그린다.
export const EMOTE_LIST: readonly EmoteDef[] = [
  { id: "hello", key: "1", glyph: "👋", label: "안녕" },
  { id: "laugh", key: "2", glyph: "😄", label: "웃음" },
  { id: "sad", key: "3", glyph: "😢", label: "슬픔" },
  { id: "angry", key: "4", glyph: "😠", label: "화남" },
];

export const EMOTES = Object.fromEntries(
  EMOTE_LIST.map((e) => [e.id, e]),
) as Record<EmoteId, EmoteDef>;

/** 키보드 code → 감정표현. 숫자열(Digit)과 넘패드(Numpad) 둘 다 받는다. */
export const EMOTE_KEYS: Record<string, EmoteId> = {
  Digit1: "hello",
  Numpad1: "hello",
  Digit2: "laugh",
  Numpad2: "laugh",
  Digit3: "sad",
  Numpad3: "sad",
  Digit4: "angry",
  Numpad4: "angry",
};

/** 머리 위 말풍선이 떠 있는 시간(ms). */
export const EMOTE_TTL_MS = 3000;

// 채팅 토픽에 실어 나르는 토큰. 텍스트 입력창을 아예 없앴으므로 사람이 이 문자열을 채팅으로
// 지어낼 길이 없고, 봇의 자연어가 이 접두사로 시작할 일도 사실상 없어 평문으로 충분하다.
const WIRE_PREFIX = "emote:";

export function encodeEmote(id: EmoteId): string {
  return WIRE_PREFIX + id;
}

/** 채팅 본문에서 감정표현 토큰을 골라낸다. 토큰이 아니면(일반 채팅) null. */
export function parseEmote(text: string): EmoteId | null {
  if (!text.startsWith(WIRE_PREFIX)) return null;
  const id = text.slice(WIRE_PREFIX.length) as EmoteId;
  return EMOTES[id] ? id : null;
}

/** 지금 어떤 감정을 언제 표현했는가. at은 수신 시각(performance.now) — TTL 계산은 이 시계로만. */
export interface ActiveEmote {
  emote: EmoteId;
  at: number;
}

// senderId → 마지막 감정표현. 사람마다 하나만 들고, 새 표현이 오면 덮어쓴다.
const active = new Map<string, ActiveEmote>();

export const emotes = {
  /** 수신(또는 내 발동 즉시 반영). at은 performance.now()를 넣는다. */
  ingest(id: string, emote: EmoteId, at: number): void {
    active.set(id, { emote, at });
  },
  /** 이 플레이어의 마지막 감정표현. 컴포넌트가 useFrame에서 폴링한다. */
  lastEmote(id: string): ActiveEmote | null {
    return active.get(id) ?? null;
  },
  /** 방을 옮길 때 비운다(옛 방 표현이 새 화면에 남지 않게). */
  clear(): void {
    active.clear();
  },
};

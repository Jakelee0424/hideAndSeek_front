"use client";
// 감정표현 단축키(1~4) 입력. 채팅을 없앤 자리를 대신한다.
//   1 안녕 · 2 웃음 · 3 슬픔 · 4 화남
//
// 렌더는 없다(effect만). 눌리면 (1) 즉시 내 버스에 넣어 로컬에서 바로 말풍선을 띄우고
// (오프라인·지연 대비) (2) 서버로 보내 다른 사람에게도 보이게 한다. 서버 echo는 같은 버스로
// 돌아오지만 같은 감정이라 무해하다(TTL만 다시 채워진다).
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { useInteraction } from "@/game/interactables";
import { sendEmote } from "@/net/stompClient";
import { emotes, EMOTE_KEYS } from "@/net/emotes";

export default function EmoteControls() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const id = EMOTE_KEYS[e.code];
      if (!id) return;
      // 퍼즐(아케이드 미니게임)이 열려 있으면 그쪽 조작이라 넘긴다.
      if (useInteraction.getState().openId !== null) return;
      // 혹시 입력 필드에 포커스가 있으면(폼 등) 타이핑을 가로채지 않는다.
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;

      const gs = useGameStore.getState();
      // 판이 끝났거나 아직 게임에 들어오지 않았으면 무시.
      if (gs.phase === "ENDED" || gs.phase === null) return;

      e.preventDefault();
      if (gs.myId) emotes.ingest(gs.myId, id, performance.now()); // 즉시 로컬 피드백
      if (gs.status === "connected") sendEmote(gs.roomId, id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

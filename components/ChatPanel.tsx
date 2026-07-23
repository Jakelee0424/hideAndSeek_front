"use client";
// 인게임 채팅. 화면 좌하단에 대화 로그, Enter로 입력창을 연다.
//
// 이 게임의 마지막 단계가 "누가 AI인가"를 가리는 투표라, 채팅은 편의 기능이 아니라
// 투표의 <b>근거를 만드는 장치</b>다. 그래서 두 가지를 지킨다:
//   - VOTE 단계에서도 보인다(z-35 > VoteOverlay z-30). 오히려 그때 가장 필요하다.
//   - 봇의 말도 사람과 똑같은 모양으로 온다. 서버가 발화자에 봇 표시를 싣지 않는다.
//
// 입력 중(composing)에는 이동·시점·상호작용이 전부 멈춘다. 게이팅은 퍼즐 오버레이의
// openId와 같은 지점들에 걸려 있다(useKeyboard / useMouseLook / LocalPlayer).
import { useEffect, useRef, useState } from "react";
import { useChat } from "@/net/chat";
import { sendChat } from "@/net/stompClient";
import { useInteraction } from "@/game/interactables";
import { useGameStore } from "@/store/gameStore";

/** 입력창을 닫고 있을 때 보여줄 최근 줄 수. 시야를 가리지 않을 만큼만. */
const PEEK_LINES = 5;
/** 입력창을 열었을 때 보여줄 줄 수. */
const OPEN_LINES = 12;

export default function ChatPanel() {
  const lines = useChat((s) => s.lines);
  const composing = useChat((s) => s.composing);
  const unread = useChat((s) => s.unread);
  const setComposing = useChat((s) => s.setComposing);

  const puzzleOpen = useInteraction((s) => s.openId !== null);
  const phase = useGameStore((s) => s.phase);
  const roomId = useGameStore((s) => s.roomId);
  const myId = useGameStore((s) => s.myId);

  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // 퍼즐(아케이드 미니게임)이 열려 있으면 채팅을 아예 닫는다. 미니게임은 방향키·스페이스를
  // 그대로 쓰기 때문에 입력창이 살아 있으면 조작이 통째로 채팅으로 빨려 들어간다.
  const hidden = puzzleOpen || phase === "ENDED" || phase === null;

  // Enter로 입력창 열기. 입력창 안의 Enter는 아래 onKeyDown이 따로 처리한다.
  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Enter" && e.code !== "NumpadEnter") return;
      if (useChat.getState().composing) return; // 이미 열려 있다(입력창이 처리)
      e.preventDefault();
      setComposing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, setComposing]);

  // 열리면 포커스. 포커스가 안 가면 키가 계속 게임으로 흘러 캐릭터가 움직인다.
  useEffect(() => {
    if (composing) inputRef.current?.focus();
  }, [composing]);

  // 퍼즐이 열리는 등으로 채팅이 숨겨지면 입력 상태도 반드시 푼다.
  // 안 그러면 composing이 true로 남아 이동이 영영 잠긴다.
  useEffect(() => {
    if (hidden && useChat.getState().composing) {
      setComposing(false);
      setDraft("");
    }
  }, [hidden, setComposing]);

  // 새 줄이 오면 항상 맨 아래를 본다.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, composing]);

  if (hidden) return null;

  function close() {
    setComposing(false);
    setDraft("");
    inputRef.current?.blur();
  }

  function submit() {
    const text = draft.trim();
    if (text) sendChat(roomId, text);
    close();
  }

  const shown = composing ? lines.slice(-OPEN_LINES) : lines.slice(-PEEK_LINES);

  return (
    <div className="absolute bottom-16 left-4 z-[35] w-[22rem] max-w-[calc(100vw-2rem)] select-none">
      {/* 로그. 입력 중이 아니면 클릭을 통과시켜 조작을 막지 않는다. */}
      <div
        ref={logRef}
        className={`max-h-48 overflow-y-auto rounded-lg px-3 py-2 text-xs leading-relaxed backdrop-blur transition ${
          composing
            ? "pointer-events-auto bg-black/70"
            : "pointer-events-none bg-black/40"
        }`}
      >
        {shown.length === 0 ? (
          <p className="text-slate-500">아직 대화가 없어요</p>
        ) : (
          shown.map((l) => (
            <p key={l.key} className="break-words">
              <span
                className={
                  l.senderId === myId
                    ? "font-semibold text-emerald-300"
                    : "font-semibold text-sky-300"
                }
              >
                {l.nick}
              </span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-100">{l.text}</span>
            </p>
          ))
        )}
      </div>

      {composing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={close}
          onKeyDown={(e) => {
            // 한글 입력 중의 Enter는 글자를 확정하는 것이지 전송이 아니다.
            // 이 검사가 없으면 "안녕"의 마지막 글자가 확정되며 그대로 전송된다.
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
            // 이동 키가 게임으로도 새어 나가지 않게 여기서 막는다.
            e.stopPropagation();
          }}
          maxLength={120}
          placeholder="Enter 전송 · Esc 취소"
          className="pointer-events-auto mt-1 w-full rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs text-white outline-none backdrop-blur placeholder:text-slate-500 focus:border-emerald-400/60"
        />
      ) : (
        // 채팅 여는 법을 항상 보여 준다(예전엔 로그가 빌 때만 안내가 있었다). 클릭으로도 열 수
        // 있어 포인터락이 풀린 상태(퍼즐 직후 등)에서 마우스 유저도 대화를 시작할 수 있다.
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="pointer-events-auto mt-1 inline-flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[11px] text-slate-300 backdrop-blur transition hover:bg-black/70"
        >
          <kbd className="rounded bg-white/15 px-1 font-mono">Enter</kbd>
          <span>대화하기</span>
          {unread > 0 && (
            <span className="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-black">
              새 메시지 {unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

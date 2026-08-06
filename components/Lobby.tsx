"use client";
// 로비: 죄수번호(자동) 확인 + 방 코드 입력 → 대기방으로 입장.
//
// 대기열은 이 화면에 오기 전(QueueBoundary)에 이미 통과했다. 여기서는 그때 배정받은
// playerId/token을 그대로 써야 한다 — 새 id를 만들면 잡아둔 슬롯과 어긋나 입장이 거부된다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinRoom } from "@/net/session";
import SoundToggle from "./SoundToggle";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++)
    c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

/**
 * 죄수번호를 무작위로 딴다.
 *
 * ⚠️ 서버 Room.botNick()이 **같은 형식**으로 봇 닉을 만든다. 한쪽만 바꾸면 봇 혼자
 * 다른 모양의 이름을 달게 되고, 마지막 단계인 AI 지목 투표에서 정답이 화면에 적혀
 * 있는 셈이 된다. 형식을 손대면 반드시 양쪽을 함께 고칠 것.
 */
function randomPrisonerNick() {
  return `죄수 ${1000 + Math.floor(Math.random() * 9000)}`;
}

export default function Lobby({
  playerId,
  token,
}: {
  playerId: string;
  token: string | null;
}) {
  const router = useRouter();
  // 입장할 때마다 새 번호를 딴다. 직접 짓지 않는다 — 수감된 처지에 이름을 고를 수 있으면
  // 이상하고, 무엇보다 봇도 같은 규칙으로 번호를 받아야 사람들 틈에 섞인다.
  const [nick, setNick] = useState(randomPrisonerNick);
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enter(roomId: string) {
    const code = roomId.trim().toUpperCase() || randomCode();
    try {
      joinRoom(code, nick, { playerId, token });
      router.push(`/rooms/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "입장에 실패했어요");
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[#0b0f17] p-6 text-slate-100">
      {/* 배경음이 처음 흐르는 화면이라, 끄는 자리도 여기서부터 있어야 한다 */}
      <SoundToggle className="absolute right-4 top-4" />

      {/*
        게임 제목. 이 화면에서 가장 큰 글자여야 한다 — 시연에서 심사위원이 처음 보는 글자다.
        ⚠️ flex-wrap이 필수다: 한 줄 고정으로 두면 좁은 화면에서 "Escape"가 잘린다.
           좁으면 ": Escape"가 아랫줄로 내려가고, sm 이상에서 한 줄로 붙는다.
      */}
      <header className="text-center">
        <h1 className="flex flex-wrap items-baseline justify-center gap-x-3 text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
          <span className="[text-shadow:0_0_30px_rgba(148,163,184,0.35)]">
            시야 밖으로
          </span>
          <span className="font-light text-slate-600">:</span>
          <span className="text-amber-300 [text-shadow:0_0_30px_rgba(252,211,77,0.45)]">
            Escape
          </span>
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          실시간 멀티플레이 3D 협동 방탈출
        </p>
      </header>

      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <label className="mb-1 block text-xs font-medium text-slate-400">
          수감 번호
        </label>
        <div className="mb-4 flex items-center gap-2">
          <div className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-lg font-bold tracking-widest text-amber-300">
            {nick}
          </div>
          <button
            onClick={() => setNick(randomPrisonerNick())}
            title="다른 번호로 다시 뽑기"
            className="rounded-lg border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5"
          >
            ↻
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-400">
          방 코드 (선택)
        </label>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          maxLength={5}
          placeholder="비우면 새 방 생성"
          className="mb-6 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-sky-400"
        />

        {error && (
          <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {error}
          </p>
        )}

        <button
          onClick={() => enter(room)}
          className="mb-2 w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          {room.trim() ? "방 참가" : "새 방 만들기"}
        </button>
        {/* <button
          onClick={() => enter(randomCode())}
          className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5"
        >
          빠른 시작
        </button> */}
      </div>
    </main>
  );
}

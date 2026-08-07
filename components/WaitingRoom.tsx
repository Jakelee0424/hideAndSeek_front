"use client";
// 대기방: 입장한 플레이어 목록 + 준비 토글 + (방장) 게임 시작.
// 백엔드 연결 전에도 본인은 목록에 표시된다(store에 시드됨).
//
// 화면은 스타크래프트의 게임 전 브리핑을 흉내 내되, 군사 작전이 아니라 죄수들의
// "탈옥 모의"다 — 콘솔 패널(모서리 브래킷), 스캔라인, 모노스페이스 타이포에
// "공범 명단 / 탈옥 순서 / 감옥 도면 / 돌려 읽는 쪽지"를 담는다.
// 게임 로직(준비·시작·이탈 판정)은 서버가 갖고, 여기는 겉모습만 브리핑이다.
import { useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { joinRoom, leaveRoom } from "@/net/session";
import { sendReady, sendStart } from "@/net/stompClient";
import { buildLines } from "./StoryPanel";
import { cafeteriaPlan, DAYS } from "@/game/cafeteriaPlan";
import LobbyMap from "./LobbyMap";
import NarrationScroll from "./NarrationScroll";

const STATUS_LABEL: Record<string, string> = {
  idle: "연락 끊김",
  connecting: "몰래 연결 중…",
  connected: "비밀 회선 확보",
  error: "바깥 연락 두절 (단독 대기)",
  rejected: "감방 정원 초과",
};

/** 탈옥 순서. 나레이션(StoryPanel.buildLines)이 말하는 것 이상은 흘리지 않는다. */
const OBJECTIVES = [
  "감방 문을 열어라 — 자물쇠에 박힌 압수 게임기를 공략",
  "식당 배식 순서표에서 오늘 줄을 찾아라",
  "별관의 문제를 풀어 벽의 표식을 밝혀라",
  "거짓말쟁이들의 문을 열고, 자정 전에 탈출하라",
];

export default function WaitingRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const status = useGameStore((s) => s.status);
  const myId = useGameStore((s) => s.myId);
  const myNick = useGameStore((s) => s.myNick);
  const ready = useGameStore((s) => s.ready);
  const setReady = useGameStore((s) => s.setReady);
  const playerIds = useGameStore((s) => s.playerIds);
  const nicks = useGameStore((s) => s.nicks);
  const rosterOrder = useGameStore((s) => s.rosterOrder);
  const readys = useGameStore((s) => s.readys);
  const phase = useGameStore((s) => s.phase);

  // 3D 에셋 미리 받기(로비에서 이미 시작했으면 두 번째부터는 공짜다 — 캐시가 받는다).
  //
  // ⚠️ 언마운트를 이유로 취소하면 안 된다. 예전엔 `alive` 가드를 뒀는데, 그러면 **TEST
  //    방에서는 미리받기가 한 번도 안 걸렸다** — 테스트 방은 서버가 즉시 시작해 대기방이
  //    수십 ms 만에 play로 넘어가므로, 동적 import가 끝나기도 전에 언마운트된다.
  //    미리 받기는 화면과 무관한 캐시 채우기라 늦게 끝나도 손해가 없다.
  useEffect(() => {
    import("@/game/prisonAssets").then((m) => m.preloadPrisonAssets());
  }, []);

  // 닉네임 없이 직접/새로고침으로 들어온 경우 로비로 돌려보냄
  useEffect(() => {
    if (!myNick) {
      router.replace("/");
      return;
    }
    // 세션이 없으면(예: 새로고침) 다시 입장
    if (!myId) joinRoom(roomId, myNick);
  }, [myNick, myId, roomId, router]);

  // 방장 = 가장 먼저 입장한 사람. 서버가 로스터를 입장 순으로 담아 보내므로 그 첫 번째다.
  //
  // 예전엔 "봇이 아닌 첫 번째"로 뽑았는데, AI 지목 투표를 넣으면서 서버가 roster.bot을
  // 결말 전까지 전부 false로 보내게 됐다(정체를 숨겨야 하므로). 그래서 그 방식은 더 이상
  // 봇을 걸러내지 못한다. 대신 봇은 첫 사람이 들어온 뒤에 스폰되므로 rosterOrder에서
  // 언제나 사람보다 뒤에 온다 — 첫 번째만 집으면 봇이 방장이 될 일이 없다.
  const hostId = rosterOrder[0] ?? playerIds[0];
  const isHost = hostId === myId;

  // 준비 판정의 주인은 서버다. 클라의 ready는 버튼 눌림 표시일 뿐이라, 그걸로 시작을
  // 막으면 남이 준비했는지 알 수 없다.
  //
  // ⚠️ 여기서 봇을 걸러내려 하지 말 것. roster.bot은 결말 전까지 전부 false라(정체 은닉)
  //    클라는 누가 봇인지 모른다. 예전엔 `bots[id] || readys[id]`로 썼다가, 봇이 사람으로
  //    잡히고 준비도 못 눌러서 3명이 다 준비해도 시작 버튼이 안 열렸다.
  //    대신 서버가 봇을 준비 완료 상태로 실어 보낸다.
  const memberIds = rosterOrder.length ? rosterOrder : playerIds;
  const allReady = memberIds.length > 0 && memberIds.every((id) => readys[id]);

  // 오른편 나레이션. 정본은 StoryPanel.buildLines 하나 — 요일은 방 시드로 정해진다.
  const narration = useMemo(() => buildLines(DAYS[cafeteriaPlan(roomId).today]), [roomId]);

  // 시작은 서버가 확정한다. 여기서 화면을 옮기지 않는다 — 누른 사람만 넘어가면 나머지는
  // 대기방에 남는다(예전 동작). 아래 useEffect가 단계 전환을 보고 전원을 함께 옮긴다.
  function start() {
    sendStart(roomId);
  }

  // 서버가 게임을 시작하면 단계가 LOBBY를 벗어난다 → 그때 모두 함께 게임 화면으로.
  useEffect(() => {
    if (phase && phase !== "LOBBY") {
      router.replace(`/rooms/${roomId}/play`);
    }
  }, [phase, roomId, router]);

  function leave() {
    leaveRoom();
    router.push("/");
  }

  if (!myNick) return null;

  return (
    // lg에서는 화면 높이에 잠가(overflow-hidden) 스크롤이 생기지 않게 한다.
    // 도면 패널이 flex-1로 남는 높이를 받고, 캔버스가 그 높이에 맞춰 줄어든다.
    <main className="relative flex min-h-dvh flex-col bg-[#070b12] p-4 text-slate-100 sm:p-5 lg:h-dvh lg:overflow-hidden">
      {/* 화면 위쪽에서 내려오는 은은한 감시등 불빛(앰버) */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(245,158,11,0.06), transparent 70%)",
        }}
      />
      {/* CRT 스캔라인 — 아주 옅게, 화면 전체 */}
      <div
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.05]"
        aria-hidden
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #000 0, #000 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* 낮은 모니터에서는 이 래퍼가 통째로 축소된다(globals.css .briefing-scale) */}
      <div className="briefing-scale relative flex w-full flex-1 flex-col lg:min-h-0">
      {/* ── 브리핑 헤더 ─────────────────────────────────────── */}
      <header className="relative mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-zinc-500/30 pb-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-lg font-bold tracking-[0.2em] text-amber-300">
            // 탈옥 모의
          </h1>
          <span className="hidden font-mono text-[11px] tracking-[0.25em] text-slate-500 sm:inline">
            PRISON BREAK: OUT-OF-SIGHT
          </span>
          <span className="animate-pulse font-mono text-amber-300">▮</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-sm border border-rose-400/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.3em] text-rose-300/90">
            간수 열람 금지
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status === "connected"
                  ? "animate-pulse bg-emerald-400"
                  : status === "rejected"
                    ? "bg-rose-400"
                    : status === "error"
                      ? "bg-amber-400"
                      : "animate-pulse bg-slate-400"
              }`}
            />
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      </header>

      {/* 좌우 5:7 그리드 — 헤더와 같은 max-w-6xl이라 양쪽 바깥 여백이 똑같이 떨어진다 */}
      <div className="relative mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-5 lg:min-h-0 lg:grid-cols-[5fr_7fr] lg:items-stretch">
        {/* ── 왼쪽: 공범 명단 + 탈옥 순서 (창이 아주 낮을 때만 안에서 스크롤) ── */}
        <div className="flex w-full flex-col gap-5 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:thin]">
          <ConsolePanel
            title="공범 명단 // CREW"
            right={
              <span className="font-mono text-[11px] text-slate-400">
                모인 인원 {playerIds.length}
              </span>
            }
          >
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] text-slate-500">
                  탈옥 암호
                </p>
                <p className="font-mono text-2xl font-bold tracking-[0.3em] text-amber-200">
                  {roomId}
                </p>
              </div>
              <p className="font-mono text-[10px] text-slate-500">
                암호를 아는 자만 합류한다
              </p>
            </div>

            <ul className="mb-5 space-y-1.5">
              {playerIds.map((id, i) => (
                <li
                  key={id}
                  className="flex items-center justify-between border border-white/10 bg-black/30 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-zinc-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono font-medium tracking-wide">
                      {nicks[id] ?? id}
                    </span>
                    {id === myId && (
                      <span className="font-mono text-[10px] text-sky-400">(나)</span>
                    )}
                    {/* AI 배지는 없앴다 — 마지막 단계가 AI 지목 투표라 여기서 알려주면 게임이
                        성립하지 않는다. 정체는 결말에 VoteOverlay가 공개한다. */}
                    {id === hostId && (
                      <span className="rounded-sm bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                        주모자
                      </span>
                    )}
                  </span>
                  {/* 남의 준비 상태도 보여준다 — 서버가 실어 보내므로 알 수 있다. */}
                  {readys[id] ? (
                    <span className="font-mono text-[11px] text-emerald-400">✓ 준비 완료</span>
                  ) : (
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                      <span className="h-1 w-1 animate-pulse rounded-full bg-slate-500" />
                      대기 중
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {/* 아직 준비 전이면 튀는 화살표가 버튼을 가리킨다 — 뭘 눌러야 할지 헤매지 않게 */}
            {!ready && (
              <div className="mb-1 flex items-end justify-center gap-2 text-amber-300" aria-hidden>
                <span className="animate-bounce font-mono text-base leading-none">▼</span>
                <span className="pb-0.5 font-mono text-[11px] tracking-[0.2em]">
                  눌러서 준비
                </span>
                <span className="animate-bounce font-mono text-base leading-none">▼</span>
              </div>
            )}
            <button
              onClick={() => {
                const next = !ready;
                setReady(next); // 로컬은 즉시 반영(버튼이 굼뜨게 보이지 않도록)
                sendReady(roomId, next); // 판정은 서버가 한다
              }}
              className={`relative mb-2 w-full border py-2.5 font-mono text-sm font-semibold tracking-widest transition ${
                ready
                  ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  : "border-amber-400/40 text-slate-100 hover:border-amber-400/70 hover:bg-amber-400/10"
              }`}
            >
              {/* 준비 전에는 테두리가 은은하게 고동쳐 시선을 끈다 */}
              {!ready && (
                <span
                  className="pointer-events-none absolute -inset-1 animate-pulse border border-amber-400/50"
                  aria-hidden
                />
              )}
              {ready ? "✓ 준비 완료" : "준비하기"}
            </button>

            {isHost && (
              <>
                {/* 전원 준비되면 이번엔 결행 버튼을 가리킨다 */}
                {allReady && (
                  <div className="mb-1 mt-1 flex items-end justify-center gap-2 text-amber-300" aria-hidden>
                    <span className="animate-bounce font-mono text-base leading-none">▼</span>
                    <span className="pb-0.5 font-mono text-[11px] tracking-[0.2em]">
                      전원 준비 완료 — 시작하라
                    </span>
                    <span className="animate-bounce font-mono text-base leading-none">▼</span>
                  </div>
                )}
                <button
                  onClick={start}
                  disabled={!allReady}
                  className="relative w-full border border-amber-400/60 bg-amber-500/20 py-2.5 font-mono text-sm font-bold tracking-[0.3em] text-amber-300 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {allReady && (
                    <span
                      className="pointer-events-none absolute -inset-1 animate-pulse border border-amber-400/60"
                      aria-hidden
                    />
                  )}
                  ▶ 게임 시작
                </button>
                {!allReady && (
                  <p className="mt-1.5 text-center font-mono text-[10px] text-slate-500">
                    모두의 준비 신호를 기다리는 중…
                  </p>
                )}
              </>
            )}

            <button
              onClick={leave}
              className="mt-2 w-full py-1.5 font-mono text-xs text-slate-500 transition hover:text-slate-200"
            >
              ↩ 계획에서 빠지기
            </button>
          </ConsolePanel>

          <ConsolePanel title="탈옥 순서 // THE PLAN">
            <ul className="space-y-2.5">
              {OBJECTIVES.map((o, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
                  <span className="mt-0.5 font-mono text-amber-400">◆</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1.5 border-t border-amber-400/20 pt-3">
              <p className="flex gap-2 text-[13px] leading-relaxed text-amber-300/90">
                <span className="mt-0.5">⚠</span>
                <span>간수 순찰 중에 움직이면 발각된다 — 들킬수록 자정이 앞당겨진다.</span>
              </p>
              <p className="flex gap-2 text-[13px] leading-relaxed text-amber-300/90">
                <span className="mt-0.5 animate-pulse">⚠</span>
                <span>공범 중 하나는 사람이 아니다. 끝까지 눈을 떼지 마라.</span>
              </p>
            </div>
          </ConsolePanel>
        </div>

        {/* ── 오른쪽: 감옥 도면 + 돌려 읽는 쪽지 ───────────────── */}
        <div className="flex w-full flex-col gap-5 lg:min-h-0">
          <ConsolePanel
            title="감옥 도면 // BLUEPRINT"
            right={
              <span className="font-mono text-[11px] text-slate-400">
                쇠창살 너머까지 외워 둘 것
              </span>
            }
            className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
            bodyClassName="p-3 sm:p-4 lg:min-h-0 lg:flex-1"
          >
            <LobbyMap />
          </ConsolePanel>

          <ConsolePanel
            title="돌려 읽는 쪽지 // KITE"
            right={
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-rose-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                몰래 전달 중
              </span>
            }
          >
            <NarrationScroll lines={narration} />
          </ConsolePanel>
        </div>
      </div>
      </div>
    </main>
  );
}

/** 감옥풍 철판 패널: 강철 테두리 + 네 모서리 리벳 + 위쪽 경고 스트라이프 + 헤더 스트립. */
function ConsolePanel({
  title,
  right,
  children,
  className = "",
  bodyClassName,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  /** 패널 자체에 얹을 레이아웃 클래스(예: flex-1로 남는 높이 차지). */
  className?: string;
  /** 본문 영역 클래스. 주면 기본 패딩(p-4 sm:p-5)을 통째로 대체한다. */
  bodyClassName?: string;
}) {
  return (
    <section
      className={`relative border border-zinc-500/30 bg-gradient-to-b from-[#131720] to-[#0b0e15] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* 위쪽 모서리의 공사장 경고 스트라이프 — 감옥 철문의 주의 표식 느낌 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-70"
        aria-hidden
        style={{
          background:
            "repeating-linear-gradient(45deg, rgba(245,158,11,0.55) 0 8px, transparent 8px 16px)",
        }}
      />
      {/* 네 모서리 리벳 — 철판을 박아 놓은 못 대가리 */}
      {[
        "left-1.5 top-1.5",
        "right-1.5 top-1.5",
        "bottom-1.5 left-1.5",
        "bottom-1.5 right-1.5",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`pointer-events-none absolute ${pos} h-1.5 w-1.5 rounded-full bg-zinc-400/60 shadow-[inset_0_-1px_1px_rgba(0,0,0,0.9),0_0_3px_rgba(0,0,0,0.7)]`}
        />
      ))}
      <header className="flex items-center justify-between gap-2 border-b border-zinc-500/25 bg-white/[0.03] px-5 py-2">
        <h2 className="font-mono text-[11px] font-semibold tracking-[0.3em] text-amber-300/90">
          {title}
        </h2>
        {right}
      </header>
      <div className={bodyClassName ?? "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

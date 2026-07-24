"use client";
// 게임 화면 위 오버레이 HUD.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { punches } from "@/net/punches";
import { reimprison } from "@/net/reimprison";
import { leaveRoom } from "@/net/session";
import { escapePlan } from "@/game/escapePlan";
import { findInteractable, useInteraction } from "@/game/interactables";
import PhaseBanner from "./PhaseBanner";
import Minimap from "./Minimap";

export default function HUD() {
  const router = useRouter();
  const status = useGameStore((s) => s.status);
  const roomId = useGameStore((s) => s.roomId);
  const count = useGameStore((s) => s.playerIds.length);
  const myNick = useGameStore((s) => s.myNick);

  const nearId = useInteraction((s) => s.nearId);
  const openId = useInteraction((s) => s.openId);
  const solvedNear = useInteraction((s) => (nearId ? s.solved[nearId] : false));
  const near = findInteractable(nearId);

  function exit() {
    leaveRoom();
    router.push("/");
  }

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* 피격 시 화면 가장자리 붉은 플래시 */}
      <HitVignette />

      {/* 정문 함정 발동 연출 */}
      <TrapOverlay />

      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-200 backdrop-blur">
        <span className="font-semibold tracking-widest">{roomId}</span>
        {myNick && (
          <>
            <span className="text-slate-400">·</span>
            {/* 내 죄수번호(=닉네임). 캐릭터 머리 위 이름표는 중앙 겹침 때문에 뺐고, 여기로 옮겼다.
                발밑 하늘색 링과 같은 색이라 3D의 내 캐릭터와 이어진다. */}
            <span className="font-semibold text-sky-300">{myNick}</span>
          </>
        )}
        <span className="text-slate-400">·</span>
        <span>플레이어 {count}</span>
        <span className="text-slate-400">·</span>
        <span
          className={
            status === "connected" ? "text-emerald-400" : "text-amber-400"
          }
        >
          {status === "connected" ? "온라인" : "오프라인"}
        </span>
      </div>

      {/* 진행 단계 + 남은 시간 (상단 중앙) */}
      <PhaseBanner />

      {/* 맵 개요 미니맵 + 내 위치 (상단 우측, M키로 접기) */}
      <Minimap />

      {/* 내 감방 단서(표식·수) — 감방을 탈출하면 지급된다 */}
      <ClueChip />

      <div className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        이동 <kbd className="font-mono">W A S D</kbd> · 달리기{" "}
        <kbd className="font-mono">R</kbd> · 상호작용{" "}
        <kbd className="font-mono">E</kbd> · 채팅{" "}
        <kbd className="font-mono">Enter</kbd> · 지도{" "}
        <kbd className="font-mono">M</kbd>
      </div>

      {/* 소음 게이지 (하단 우측) */}
      <NoiseGauge />

      {/* 상호작용 프롬프트 */}
      {near && !openId && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-lg bg-black/70 px-4 py-2 text-sm text-white backdrop-blur">
          {solvedNear ? (
            <span className="text-emerald-400">{near.label} · 완료 ✓</span>
          ) : (
            <>
              <kbd className="mr-2 rounded bg-white/15 px-1.5 py-0.5 font-mono">
                E
              </kbd>
              {near.label}
            </>
          )}
        </div>
      )}

      <button
        onClick={exit}
        className="pointer-events-auto absolute right-4 top-4 rounded-lg bg-black/40 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur transition hover:bg-black/60"
      >
        나가기
      </button>
    </div>
  );
}

// 피격 비네트: 내가 맞으면 화면 가장자리가 붉게 번쩍였다 잦아든다.
// store를 매 프레임 건드리지 않도록 자체 rAF로 punches 버스(내 id의 마지막 피격 시각)를 폰다.
function HitVignette() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let seen = 0;
    let inited = false; // 입장 직후 과거 피격으로 헛번쩍이지 않게 첫 값은 그냥 동기화
    let flash = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = now - last;
      last = now;
      const myId = useGameStore.getState().myId;
      if (myId) {
        const h = punches.lastHitAt(myId);
        if (!inited) {
          seen = h;
          inited = true;
        } else if (h > seen) {
          seen = h;
          flash = 1;
        }
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt / 450); // ~0.45s 감쇠
        if (ref.current) ref.current.style.opacity = String(flash);
      } else if (ref.current && ref.current.style.opacity !== "0") {
        ref.current.style.opacity = "0";
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0"
      style={{
        opacity: 0,
        boxShadow: "inset 0 0 130px 35px rgba(220,20,20,0.7)",
      }}
    />
  );
}

// 정문 함정 연출: 누군가 정문을 통과하려다 함정을 밟으면 방 전체에 경보 배너가 잠깐 뜬다.
// 내가 재수감된 경우엔 "다시 갇혔다"까지 함께 뜬다. store를 매 프레임 건드리지 않도록
// 자체 rAF로 reimprison 버스를 폴링한다(피격 비네트와 같은 패턴).
const TRAP_HOLD_MS = 3600;
function TrapOverlay() {
  const [msg, setMsg] = useState<{ victim: boolean } | null>(null);
  useEffect(() => {
    let raf = 0;
    let seenTrap = reimprison.trapAt();
    let seenVictim = reimprison.victimAt();
    let inited = false;
    let hideAt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const t = reimprison.trapAt();
      const v = reimprison.victimAt();
      if (!inited) {
        seenTrap = t;
        seenVictim = v;
        inited = true;
      } else if (t > seenTrap) {
        const victim = v > seenVictim;
        seenTrap = t;
        seenVictim = v;
        hideAt = now + TRAP_HOLD_MS;
        setMsg({ victim });
      }
      if (hideAt && now >= hideAt) {
        hideAt = 0;
        setMsg(null);
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!msg) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 flex flex-col items-center gap-2 text-center">
      <div className="rounded-lg bg-rose-950/80 px-5 py-2.5 backdrop-blur">
        <p className="text-xs font-medium tracking-[0.3em] text-rose-300/80">TRAP</p>
        <p className="mt-1 text-lg font-bold text-white">
          정문이 열렸다 — 하지만 함정이었다. 보는 눈이 너무 많았다
        </p>
      </div>
      {msg.victim && (
        <div className="rounded-md bg-black/70 px-4 py-1.5 text-sm font-semibold text-rose-200 backdrop-blur">
          당신은 붙잡혀 다시 감방에 갇혔다
        </div>
      )}
    </div>
  );
}

// 내 감방 단서 칩: 자기 감방 자물쇠를 풀면(=탈출) 그 방 고유의 "표식 + 수"가 지급된다.
// 탈옥문 코드에서 내 몫의 자리 하나를 계산하는 재료다 — 셈법은 낙서 3곳에 나뉘어 있고,
// 남의 몫은 알 수 없으니 채팅으로 모아야 한다(escapePlan.ts 참고).
function ClueChip() {
  const roomId = useGameStore((s) => s.roomId);
  const myCell = useGameStore((s) => s.myCell);
  const escaped = useInteraction((s) =>
    myCell ? !!s.solved[`lock-${myCell}`] : false,
  );
  if (!myCell || !escaped) return null;
  const clue = escapePlan(roomId).clues[myCell];
  if (!clue) return null;
  return (
    <div className="absolute left-4 top-16 rounded-lg border border-amber-400/25 bg-black/50 px-3 py-2 text-xs text-amber-100 backdrop-blur">
      <div className="font-semibold">
        🔖 내 표식: {clue.symbol} · 수 {clue.value}
      </div>
      <div className="mt-0.5 text-[11px] text-amber-200/60">
        낙서 3곳(식당·복도·연병장)에서 셈법을 찾아라
      </div>
    </div>
  );
}

// 소음 게이지: 걸을 땐 0, 달리면 차오른다.
// 색상 구간 — 30 이하 초록 / 31~69 노랑 / 70 이상 빨강.
// noise만 구독하는 별도 컴포넌트라, 게이지 갱신(최대 15Hz)이 HUD 전체를 리렌더하지 않는다.
function NoiseGauge() {
  const noise = useGameStore((s) => s.noise);
  const level = noise <= 30 ? "low" : noise < 70 ? "mid" : "high";
  const barColor =
    level === "low"
      ? "bg-emerald-500"
      : level === "mid"
        ? "bg-yellow-400"
        : "bg-red-500";
  const textColor =
    level === "low"
      ? "text-emerald-400"
      : level === "mid"
        ? "text-yellow-300"
        : "text-red-400";

  return (
    <div className="absolute bottom-4 right-4 w-44 rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-300 backdrop-blur">
      <div className="mb-1 flex items-center justify-between">
        <span>소음</span>
        <span className={`font-mono font-semibold tabular-nums ${textColor}`}>
          {noise}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-100 ${barColor}`}
          style={{ width: `${noise}%` }}
        />
      </div>
    </div>
  );
}

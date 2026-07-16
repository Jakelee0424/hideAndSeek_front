"use client";
// 게임 화면 위 오버레이 HUD.
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { leaveRoom } from "@/net/session";
import { findInteractable, useInteraction } from "@/game/interactables";
import PhaseBanner from "./PhaseBanner";

export default function HUD() {
  const router = useRouter();
  const status = useGameStore((s) => s.status);
  const roomId = useGameStore((s) => s.roomId);
  const count = useGameStore((s) => s.playerIds.length);

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
      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-200 backdrop-blur">
        <span className="font-semibold tracking-widest">{roomId}</span>
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

      <div className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        이동 <kbd className="font-mono">W A S D</kbd> · 상호작용{" "}
        <kbd className="font-mono">E</kbd>
      </div>

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

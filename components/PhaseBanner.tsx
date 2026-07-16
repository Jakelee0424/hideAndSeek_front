"use client";
// 현재 진행 단계 + 남은 시간 표시. 단계가 바뀌면 잠깐 큰 배너로 알린다.
//
// 서버는 단계를 "전환 시에만" 보낸다(로스터와 같은 규약). 그래서 카운트다운은 여기서
// 로컬로 돌린다 — 남은 시간을 받은 순간 종료 시각으로 환산해두고(gameStore.phaseEndsAt)
// 1초마다 현재 시각만 갱신해 다시 계산한다. 20Hz 스냅샷에 시간을 실을 필요가 없는 이유다.
//
// 표시값은 전부 now에서 파생시킨다. effect에서 setState로 밀어넣으면 연쇄 렌더가 된다.
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { PHASE_LABEL } from "@/net/types";

/** 단계 전환 배너를 띄워두는 시간(ms) */
const TOAST_MS = 2500;

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PhaseBanner() {
  const phase = useGameStore((s) => s.phase);
  const phaseEndsAt = useGameStore((s) => s.phaseEndsAt);
  const phaseStartedAt = useGameStore((s) => s.phaseStartedAt);

  const [now, setNow] = useState(() => Date.now());

  // 1초 틱. 카운트다운 표시는 초 단위라 매 프레임 돌 이유가 없다.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 전환 배너를 제때 내리기 위한 1회성 타이머.
  // 1초 틱에만 기대면 배너가 최대 1초 늦게 사라진다.
  useEffect(() => {
    if (phaseStartedAt == null) return;
    const left = phaseStartedAt + TOAST_MS - Date.now();
    if (left <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(id);
  }, [phaseStartedAt]);

  if (!phase) return null;

  const label = PHASE_LABEL[phase];
  const ended = phase === "ENDED";
  const remain = phaseEndsAt != null ? phaseEndsAt - now : 0;
  const toast = phaseStartedAt != null && now < phaseStartedAt + TOAST_MS;

  return (
    <>
      {/* 상단 상시 표시 */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-black/50 px-4 py-2 text-center backdrop-blur">
        <div className="text-xs font-semibold tracking-widest text-slate-200">
          {label}
        </div>
        {!ended && (
          <div
            className={`font-mono text-lg tabular-nums ${
              remain <= 10_000 ? "text-red-400" : "text-white"
            }`}
          >
            {mmss(remain)}
          </div>
        )}
      </div>

      {/* 전환 순간에만 뜨는 배너 */}
      {toast && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl bg-black/70 px-8 py-4 text-3xl font-bold text-white backdrop-blur">
          {label}
        </div>
      )}
    </>
  );
}

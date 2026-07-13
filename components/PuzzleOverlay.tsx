"use client";
// 퍼즐 UI 오버레이: 자물쇠 다이얼 + 힌트. openId가 있으면 표시.
import { useEffect, useState } from "react";
import { findInteractable, useInteraction } from "@/game/interactables";
import { sendSolve } from "@/net/stompClient";
import { useGameStore } from "@/store/gameStore";

export default function PuzzleOverlay() {
  const openId = useInteraction((s) => s.openId);
  const close = useInteraction((s) => s.close);
  const markSolved = useInteraction((s) => s.markSolved);
  const data = findInteractable(openId);

  const [digits, setDigits] = useState<number[]>([0, 0, 0]);
  const [error, setError] = useState(false);

  // 퍼즐이 열릴 때마다 다이얼 초기화
  useEffect(() => {
    setDigits([0, 0, 0]);
    setError(false);
  }, [openId]);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!data) return null;

  const isCodeLock = data.type !== "note" && !!data.puzzle?.code;

  function spin(i: number, delta: number) {
    setError(false);
    setDigits((d) => {
      const next = [...d];
      next[i] = (next[i] + delta + 10) % 10;
      return next;
    });
  }

  function submit() {
    if (digits.join("") === data!.puzzle?.code) {
      // 서버에 해결 알림(방 전체 동기화) + 로컬 즉시 반영(오프라인에서도 동작)
      sendSolve(useGameStore.getState().roomId, data!.id);
      markSolved(data!.id);
    } else {
      setError(true);
    }
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12161f] p-6 text-slate-100 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{data.label}</h2>
          <button
            onClick={close}
            className="rounded px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
          >
            닫기 (Esc)
          </button>
        </div>

        {/* 힌트 */}
        {data.puzzle?.hint && (
          <div className="mb-5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            💡 {data.puzzle.hint}
          </div>
        )}

        {isCodeLock ? (
          <>
            {/* 자물쇠 다이얼 */}
            <div className="mb-4 flex justify-center gap-3">
              {digits.map((n, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => spin(i, +1)}
                    className="h-7 w-12 rounded bg-white/5 text-slate-300 hover:bg-white/10"
                  >
                    ▲
                  </button>
                  <div className="flex h-14 w-12 items-center justify-center rounded-lg border border-white/15 bg-black/40 font-mono text-2xl">
                    {n}
                  </div>
                  <button
                    onClick={() => spin(i, -1)}
                    className="h-7 w-12 rounded bg-white/5 text-slate-300 hover:bg-white/10"
                  >
                    ▼
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p className="mb-3 text-center text-sm text-rose-400">
                틀렸습니다. 다시 시도하세요.
              </p>
            )}

            <button
              onClick={submit}
              className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              확인
            </button>
          </>
        ) : (
          // 코드가 없는 오브젝트(쪽지 등): 힌트만 보여주고 닫기
          <button
            onClick={close}
            className="w-full rounded-lg border border-white/10 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            확인
          </button>
        )}
      </div>
    </div>
  );
}

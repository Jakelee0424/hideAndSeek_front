"use client";
// 조작 안내. 포인터락이 풀려 있으면 "클릭해서 조작 시작", 막 잠겼으면 "ESC로 해제"를 잠깐.
//
// 풀렸을 때 안내가 더 중요하다 — ESC를 누른 사람은 **다시 조작하는 법**을 몰라서 멈춰 선다.
// 반대로 잠긴 뒤에는 화면을 가리면 안 되므로 몇 초만 띄우고 사라진다.
import { useEffect, useState } from "react";
import { useInteraction } from "@/game/interactables";
import { usePointerLock } from "@/game/usePointerLock";
import { useGameStore } from "@/store/gameStore";

/** 잠긴 뒤 "ESC로 해제"를 띄워 두는 시간(ms). */
const ESC_HINT_MS = 3500;

export default function ControlHint() {
  const locked = usePointerLock();
  const puzzleOpen = useInteraction((s) => s.openId !== null);
  const phase = useGameStore((s) => s.phase);
  const [showEsc, setShowEsc] = useState(false);

  // 잠기는 순간에만 잠깐 띄운다.
  useEffect(() => {
    if (!locked) return;
    setShowEsc(true);
    const t = setTimeout(() => setShowEsc(false), ESC_HINT_MS);
    return () => clearTimeout(t);
  }, [locked]);

  // 다른 오버레이가 떠 있을 때는 안내를 내린다. 그때 포인터가 풀린 건 일부러 푼 것이라
  // "클릭해서 조작 시작"이 퍼즐·투표 화면 위에 겹쳐 방해만 된다.
  const overlayOpen = puzzleOpen || phase === "VOTE" || phase === "ENDED";
  if (overlayOpen) return null;

  if (!locked) {
    return (
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <div className="rounded-xl bg-black/70 px-7 py-5 text-center backdrop-blur">
          <p className="mb-1 text-lg font-bold text-white">클릭해서 조작 시작</p>
          <p className="text-sm text-slate-300">
            WASD 이동 · Shift 달리기 · 클릭 펀치 · E 상호작용 · F 문
          </p>
          <p className="mt-2 text-xs text-slate-500">
            마우스를 다시 쓰려면 ESC
          </p>
        </div>
      </div>
    );
  }

  if (!showEsc) return null;
  return (
    <div className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
      <div className="rounded-lg bg-black/60 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
        마우스를 쓰려면 <span className="font-semibold text-white">ESC</span>
      </div>
    </div>
  );
}

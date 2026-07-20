"use client";
// 탈옥문(교도소 정문)이 열린 순간의 연출. solvedIds는 서버가 방 전체에 뿌리므로 모두에게 함께 뜬다.
//
// 잠깐 띄우고 걷는다. 예전엔 한 번 뜨면 끝까지 남아서, 탈출한 뒤의 정보 공유·투표 단계가
// 내내 검은 막 뒤에 가려 있었다. 여기는 한 판의 끝이 아니라 중간 고비다 —
// 진짜 마무리는 EndingOverlay가 맡는다.
import { useEffect, useState } from "react";
import { ESCAPE_GATE_ID, useInteraction } from "@/game/interactables";
import { sfxEscape } from "@/game/sfx";
import { useGameStore } from "@/store/gameStore";

/** 연출을 띄워 두는 시간(ms). */
const HOLD_MS = 5200;

export default function EscapeOverlay() {
  const escaped = useInteraction((s) => !!s.solved[ESCAPE_GATE_ID]);
  const phase = useGameStore((s) => s.phase);
  const [done, setDone] = useState(false);

  // 화면이 뜨는 순간 팡파르 + 걷을 시각 예약. escaped가 false→true로 바뀔 때만 돈다.
  useEffect(() => {
    if (!escaped) return;
    sfxEscape();
    const t = setTimeout(() => setDone(true), HOLD_MS);
    return () => clearTimeout(t);
  }, [escaped]);

  if (!escaped || done || phase === "ENDED") return null;

  return (
    // 퍼즐 모달(z-20)보다 위. 클릭은 통과시켜 뒤에서 계속 돌아다닐 수 있게 둔다.
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="px-8 text-center">
        <p className="mb-3 text-sm font-medium tracking-[0.3em] text-amber-300/80">
          ESCAPE COMPLETE
        </p>
        <h1 className="mb-4 text-5xl font-black text-white drop-shadow-lg">
          탈출로가 열렸다
        </h1>
        <p className="text-slate-300">
          담을 넘었다. 하지만 아직 끝이 아니다 — 누가 사람이었는지 밝혀야 한다.
        </p>
      </div>
    </div>
  );
}

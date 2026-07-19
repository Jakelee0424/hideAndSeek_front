"use client";
// 탈옥문이 열리면 뜨는 클리어 화면. solvedIds는 서버가 방 전체에 뿌리므로 모두에게 함께 뜬다.
import { ESCAPE_GATE_ID, useInteraction } from "@/game/interactables";

export default function EscapeOverlay() {
  const escaped = useInteraction((s) => !!s.solved[ESCAPE_GATE_ID]);
  if (!escaped) return null;

  return (
    // 퍼즐 모달(z-20)보다 위. 클릭은 통과시켜 뒤에서 계속 돌아다닐 수 있게 둔다.
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="px-8 text-center">
        <p className="mb-3 text-sm font-medium tracking-[0.3em] text-amber-300/80">
          ESCAPE COMPLETE
        </p>
        <h1 className="mb-4 text-5xl font-black text-white drop-shadow-lg">
          탈옥 성공
        </h1>
        <p className="text-slate-300">
          담을 넘었다. 뒤는 돌아보지 않는 편이 좋다.
        </p>
      </div>
    </div>
  );
}

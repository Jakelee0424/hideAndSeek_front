"use client";
// Canvas는 SSR 하지 않는다(three는 브라우저 전용).
import dynamic from "next/dynamic";
import EscapeOverlay from "./EscapeOverlay";
import HUD from "./HUD";
import PuzzleOverlay from "./PuzzleOverlay";
import VoteOverlay from "./VoteOverlay";
import WebGLGuard from "./WebGLGuard";

const Scene = dynamic(() => import("@/game/Scene"), { ssr: false });

export default function GameClient() {
  // WebGL을 못 쓰면 Scene을 아예 띄우지 않는다 — 띄워봐야 검은 화면이라 원인을 알 수 없다.
  return (
    <WebGLGuard>
      <main className="fixed inset-0 overflow-hidden">
        <Scene />
        <HUD />
        <PuzzleOverlay />
        <EscapeOverlay />
        {/* 투표는 클리어 화면보다 위에 온다 — 탈옥 뒤 마지막 단계라서. */}
        <VoteOverlay />
      </main>
    </WebGLGuard>
  );
}

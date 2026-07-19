"use client";
// Canvas는 SSR 하지 않는다(three는 브라우저 전용).
import dynamic from "next/dynamic";
import EscapeOverlay from "./EscapeOverlay";
import HUD from "./HUD";
import PuzzleOverlay from "./PuzzleOverlay";

const Scene = dynamic(() => import("@/game/Scene"), { ssr: false });

export default function GameClient() {
  return (
    <main className="fixed inset-0 overflow-hidden">
      <Scene />
      <HUD />
      <PuzzleOverlay />
      <EscapeOverlay />
    </main>
  );
}

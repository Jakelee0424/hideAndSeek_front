"use client";
// Canvas는 SSR 하지 않는다(three는 브라우저 전용).
import dynamic from "next/dynamic";
import ChatPanel from "./ChatPanel";
import ControlHint from "./ControlHint";
import EndingOverlay from "./EndingOverlay";
import EscapeOverlay from "./EscapeOverlay";
import HUD from "./HUD";
import OnboardingOverlay from "./OnboardingOverlay";
import PatrolOverlay from "./PatrolOverlay";
import PuzzleOverlay from "./PuzzleOverlay";
import Vignette from "./Vignette";
import VoteOverlay from "./VoteOverlay";
import WebGLGuard from "./WebGLGuard";

const Scene = dynamic(() => import("@/game/Scene"), { ssr: false });

export default function GameClient() {
  // WebGL을 못 쓰면 Scene을 아예 띄우지 않는다 — 띄워봐야 검은 화면이라 원인을 알 수 없다.
  return (
    <WebGLGuard>
      <main className="fixed inset-0 overflow-hidden">
        <Scene />
        {/* 밤 프레이밍(비네트+그레인). 캔버스 위, HUD 아래. */}
        <Vignette />
        <HUD />
        {/* 퍼즐·투표보다 아래(z-10) — 그 화면들이 뜨면 어차피 스스로 숨는다. */}
        <ControlHint />
        {/* 도입 내레이션·순찰 경고. 둘 다 조작을 막지 않으므로 퍼즐보다 아래에 둔다.
            특히 순찰은 "멈추는 건 플레이어 몫"이라는 게 규칙이라 가려서도 안 된다. */}
        <OnboardingOverlay />
        <PatrolOverlay />
        <PuzzleOverlay />
        <EscapeOverlay />
        {/* 투표는 클리어 화면보다 위에 온다 — 탈옥 뒤 마지막 단계라서. */}
        <VoteOverlay />
        {/* 채팅은 투표(z-30)보다 위다(z-35). 누가 AI인지 말로 가리는 단계라 그때 가장 필요하다. */}
        <ChatPanel />
        {/* 엔딩은 전부를 덮는다(z-40). 한 판의 마지막 화면이라 뒤가 보일 이유가 없다. */}
        <EndingOverlay />
      </main>
    </WebGLGuard>
  );
}

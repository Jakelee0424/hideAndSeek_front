"use client";
// Canvas는 SSR 하지 않는다(three는 브라우저 전용).
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import ControlHint from "./ControlHint";
import EmoteControls from "./EmoteControls";
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
  const router = useRouter();
  const myId = useGameStore((s) => s.myId);

  // 새로고침·주소 직접 입력으로 들어오면 세션이 없다(스토어는 메모리에만 산다).
  // 그 상태로는 서버가 아는 내가 없어 조작도 스냅샷도 성립하지 않으므로 로비로 돌려보낸다
  // — 예전엔 아무 가드가 없어 빈 감옥만 덩그러니 떴다. 대기방(WaitingRoom)은 이미 같은 규칙이다.
  useEffect(() => {
    if (!myId) router.replace("/");
  }, [myId, router]);

  // 돌려보내는 동안 게임 화면을 한 프레임도 보이지 않는다(빈 씬이 깜빡이는 것도 막는다).
  if (!myId) return null;

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
        {/* 감정표현 단축키(1~4) 입력. 렌더는 없고 키만 듣는다(말풍선은 3D 캐릭터 머리 위). */}
        <EmoteControls />
        {/* 엔딩은 전부를 덮는다(z-40). 한 판의 마지막 화면이라 뒤가 보일 이유가 없다. */}
        <EndingOverlay />
      </main>
    </WebGLGuard>
  );
}

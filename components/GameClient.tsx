"use client";
// Canvas는 SSR 하지 않는다(three는 브라우저 전용).
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import ControlHint from "./ControlHint";
import EmoteControls from "./EmoteControls";
import EndingOverlay from "./EndingOverlay";
import EscapeOverlay from "./EscapeOverlay";
import HUD from "./HUD";
import PatrolOverlay from "./PatrolOverlay";
import PerfStats from "./PerfStats";
import PuzzleOverlay from "./PuzzleOverlay";
import Vignette from "./Vignette";
import VoteOverlay from "./VoteOverlay";
import WebGLGuard from "./WebGLGuard";

const Scene = dynamic(() => import("@/game/Scene"), { ssr: false });

export default function GameClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const myId = useGameStore((s) => s.myId);

  // 새로고침으로 이 페이지에 바로 들어오면 스토어가 초기화돼 roomId가 "lobby"로 떨어지고,
  // 요일 시드(cafeteriaPlan)가 전부 월요일이 된다(달력·나레이션·식당 daycode 공통).
  // URL의 방 코드를 첫 렌더 전에 복원한다 — useState 초기화는 렌더당 한 번, 자식보다 먼저 돈다.
  // 정상 이동(대기실→플레이)에선 이미 roomId가 같아 setState를 건너뛰므로 세션에 영향이 없다.
  useState(() => {
    if (roomId && useGameStore.getState().roomId !== roomId) {
      useGameStore.setState({ roomId });
    }
  });

  // 그래도 새로고침이면 **로비로 돌려보낸다**(사용자 지시). 방 코드는 위에서 되살릴 수 있지만
  // 세션(myId)은 되살릴 수 없다 — 서버가 아는 내가 없어 조작도 스냅샷도 성립하지 않고,
  // 예전엔 가드가 없어 빈 감옥만 덩그러니 떴다. 대기방(WaitingRoom)도 같은 규칙이다.
  // ⚠️ 위 roomId 복원은 그래서 지금은 거의 타지 않는 경로다(지우진 않았다 — 시드 규약이 거기 적혀 있다).
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
        {/* 순찰 경고. 조작을 막지 않으므로 퍼즐보다 아래에 둔다 — "멈추는 건 플레이어 몫"이
            규칙이라 가려서도 안 된다.
            ⚠️ 도입 내레이션(OnboardingOverlay)은 없앴다. 이제 이야기는 HUD의 책 아이콘으로
            아무 때나 열어 보는 StoryPanel이다(자동 자막이 첫 1분을 덮던 것을 대체). */}
        <PatrolOverlay />
        <PuzzleOverlay />
        <EscapeOverlay />
        {/* 투표는 클리어 화면보다 위에 온다 — 탈옥 뒤 마지막 단계라서. */}
        <VoteOverlay />
        {/* 감정표현 단축키(1~4) 입력. 렌더는 없고 키만 듣는다(말풍선은 3D 캐릭터 머리 위). */}
        <EmoteControls />
        {/* 엔딩은 전부를 덮는다(z-40). 한 판의 마지막 화면이라 뒤가 보일 이유가 없다. */}
        <EndingOverlay />
        {/* 성능 계기판(F3). 기본 꺼짐 — 프레임 드랍 신고를 숫자로 확인할 때만 켠다. */}
        <PerfStats />
      </main>
    </WebGLGuard>
  );
}

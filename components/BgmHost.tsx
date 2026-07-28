"use client";
// BGM 재생을 단계에 맞춰 몰아주는 자리. 화면을 그리지 않는다.
//
// 앱 최상단(layout)에 딱 하나 마운트한다 — 로비→대기방→게임은 라우팅으로 오가는데,
// 화면마다 따로 두면 이동할 때마다 컴포넌트가 죽었다 살아나 곡이 처음부터 다시 시작한다.
// 여기 하나만 살아 있으면 곡은 끊기지 않고 단계에 따라 트랙만 갈린다.
import { useEffect } from "react";
import { playBgm } from "@/game/bgm";
import { useSoundStore } from "@/store/soundStore";
import { useGameStore } from "@/store/gameStore";

export default function BgmHost() {
  const phase = useGameStore((s) => s.phase);
  const restore = useSoundStore((s) => s.restore);

  // 저장된 음소거 설정은 마운트 뒤에 반영한다(SSR 하이드레이션 불일치 방지).
  useEffect(() => {
    restore();
  }, [restore]);

  // 결말 화면에서만 엔딩곡, 나머지(로비 포함, phase가 아직 null인 때)는 메인.
  useEffect(() => {
    playBgm(phase === "ENDED" ? "ending" : "main");
  }, [phase]);

  return null;
}

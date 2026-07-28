"use client";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import GameMap from "./Map";
import LocalPlayer from "./LocalPlayer";
import RemotePlayers from "./RemotePlayers";
import PatrolLight from "./PatrolLight";
import PatrolGuards from "./PatrolGuards";
import SceneEnvironment from "./SceneEnvironment";

// 조명은 밝은 기본값(2026-07-23 밤 톤 실험은 "너무 어둡다"로 롤백). 순찰 연출(PatrolLight)과
// 단서 발광·비네트는 조명과 무관해 그대로 둔다.
//
// ⚠️ 톤매핑은 R3F 기본값(ACES Filmic)을 쓰지 않는다 — onCreated에서 Neutral로 바꾼다.
//    에셋을 만든 도구(three-d-stage.js)는 톤매핑을 걸지 않는다(three 기본 NoToneMapping).
//    그래서 ACES를 그대로 두면 prisonAssets의 toStd()가 원본에 정확히 맞춰 놓은 색이 마지막
//    단계에서 한 번 더 틀어진다 — 특히 채도를 깎는다(조명 1.0 기준 실측: 소품 steel
//    #aeb6bf → #bcc1c6, 채도 64%. 금속이 허옇게 뜨는 인상의 원인).
//    Neutral(Khronos PBR Neutral)은 범위 안의 색은 색조·채도를 보존하고 하이라이트만 압축한다.
//    NoToneMapping과 달리 밝은 부분이 흰색으로 뭉개지지 않으면서 원본 의도에 가깝다 —
//    환경맵을 얹어 반사 하이라이트가 늘어난 지금은 이쪽이 안전하다.
//    ⚠️ gl={{ toneMapping }} 이 아니라 onCreated여야 한다. R3F는 첫 configure에서
//       toneMapping을 ACES로 덮어쓰고(configured 플래그로 한 번만), onCreated는 그 뒤에 불린다.
export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 4.5, 6], fov: 60 }}
      gl={{ powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <color attach="background" args={["#0b0f17"]} />
      <fog attach="fog" args={["#0b0f17", 25, 60]} />

      {/* 금속이 반사할 환경. 창살(metalness 0.6)·소품 금속이 검게 죽던 원인이라 조명보다 먼저 온다.
          배경으로는 쓰지 않는다 — 하늘은 위 <color>가 계속 맡는다. */}
      <SceneEnvironment intensity={0.35} />

      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#b9d5ff", "#20242e", 0.5]} />
      {/* ⚠️ 그림자 카메라가 맵 전체를 덮어야 한다. 예전 설정(±15m, 빛 [8,14,6])은
          맵(x −42~42 · z −30~30 = 84×60m) 한가운데 30×30m, **면적으로 9%**에만
          그림자를 만들었다. 연병장·별관·세탁실 소품은 castShadow를 달고도 그림자가 없어
          바닥에 닿지 않고 떠 보였다.

          ⚠️ 범위만 넓혀선 안 된다. 빛이 [8,14,6]으로 낮고 원점에 가까워, 맵 AABB를
          그림자 카메라 공간에 넣어 보면 near가 **−20.9**로 나온다 — +x/+z 구석이
          카메라 **뒤**라 아무리 넓혀도 그 부분은 그림자가 안 생긴다.
          그래서 빛을 같은 방향으로 5배 밀어냈다: [40,70,30] = 5×[8,14,6].
          방향이 같으니(둘 다 −0.465,−0.814,−0.349) **조명 결과는 완전히 동일**하고,
          그림자 카메라만 맵 밖으로 물러난다.

          아래 수치는 맵 AABB 8개 꼭짓점을 카메라 공간으로 변환해 구한 실측
          (필요 반폭 49.2 · 반높이 47.8 · near 47.9 · far 116.0)에 여유를 얹은 값이다.
          2048맵 기준 약 20텍셀/m. 넓은 직교 그림자는 아크네가 잘 나서 normalBias로
          밀어 준다 — bias(깊이 상수)보다 경사면에서 안전하고, 얇은 창살에서 그림자가
          떠버리는 부작용이 적다. */}
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-52}
        shadow-camera-right={52}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={40}
        shadow-camera-far={125}
        shadow-normalBias={0.05}
      />

      {/* 순찰 경광(예고·순찰 중에만 켜진다) */}
      <PatrolLight />

      {/* 순찰 간수 + 시야 부채꼴. 적발 판정이 이 시야로 결정된다 */}
      <PatrolGuards />

      <Suspense fallback={null}>
        <GameMap />
      </Suspense>
      <Suspense fallback={null}>
        <LocalPlayer />
        <RemotePlayers />
      </Suspense>
    </Canvas>
  );
}

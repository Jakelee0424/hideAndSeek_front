"use client";
// 순찰 간수 렌더. 예전 순찰은 "도는 동안 맵 어디서 움직이든 적발"이라 화면에 그릴 게
// 배너뿐이었다. 지금은 간수가 실제로 복도를 걷고 **그 시야 안에서** 움직여야만 걸리므로,
// 어디를 보고 있는지가 곧 규칙이다 — 몸통과 함께 시야 부채꼴을 바닥에 깔아 보여 준다.
//
// 좌표는 store가 아니라 worldState 버퍼에서 매 프레임 샘플링한다(원격 플레이어와 같은 방식·
// 같은 지연이라 함께 움직여도 어긋나지 않는다). 리렌더는 간수 수가 바뀔 때만 일어난다.
import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { INTERP_DELAY_MS, worldState } from "@/net/worldState";
import { useGameStore } from "@/store/gameStore";
import { AssetProp, usePrisonAssets } from "./prisonAssets";

// 부채꼴은 바닥에 살짝 띄워 깐다(바닥면과 z-fighting 방지).
const CONE_Y = 0.06;
/** 간수 모델 자연 높이 2.06m → 플레이어 눈높이(2.4m)에 맞추는 배율. */
const GUARD_SCALE = 1.15;

/**
 * 시야 부채꼴. 서버가 실어 준 range/fovDeg로 만든다 — 상수를 여기 베껴 두면
 * 서버 설정(game.patrol.view-*)을 바꿨을 때 화면만 옛 값으로 남는다.
 * ring/circle 계열은 +z가 아니라 +x 기준이라, 부채꼴을 정면(+z)에 맞추려면 90° 돌려야 한다.
 */
function ViewCone({ range, fovDeg }: { range: number; fovDeg: number }) {
  const geo = useMemo(() => {
    const fov = THREE.MathUtils.degToRad(fovDeg);
    // 원점(간수 발밑)에서 시작하는 부채꼴. thetaStart를 -fov/2로 잡고 +x→+z 보정.
    const g = new THREE.CircleGeometry(range, 40, -fov / 2, fov);
    g.rotateX(-Math.PI / 2); // 바닥에 눕힌다
    g.rotateY(Math.PI / 2); // 부채꼴 중심을 +z(정면)으로
    return g;
  }, [range, fovDeg]);

  return (
    <mesh geometry={geo} position={[0, CONE_Y, 0]} renderOrder={2}>
      <meshBasicMaterial
        color="#ffcf6a"
        transparent
        opacity={0.16}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Guard({ index }: { index: number }) {
  const assets = usePrisonAssets();
  const group = useRef<THREE.Group>(null);
  const view = worldState.guardView();

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = worldState.sampleGuard(index, performance.now() - INTERP_DELAY_MS);
    if (!t) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.rotationY;
  });

  return (
    <group ref={group}>
      {/* 간수 모델은 자연 높이 2.06m — 플레이어(2.4m)와 눈높이를 맞춘다 */}
      <AssetProp template={assets.guard} position={[0, 0, 0]} scale={GUARD_SCALE} />
      <ViewCone range={view.range} fovDeg={view.fovDeg} />
      {/* 발밑 표시등 — 어두운 복도에서 간수 위치를 놓치지 않게 */}
      <pointLight position={[0, 2.2, 0]} color="#ffb347" intensity={6} distance={7} />
    </group>
  );
}

export default function PatrolGuards() {
  const count = useGameStore((s) => s.guardCount);
  if (count <= 0) return null;
  return (
    // 간수 모델은 OBJ 키트에서 온다 — 로딩 중에 맵 전체를 되돌리지 않게 자체 Suspense.
    <Suspense fallback={null}>
      {Array.from({ length: count }, (_, i) => (
        <Guard key={i} index={i} />
      ))}
    </Suspense>
  );
}

"use client";
// GLB 애니메이션 캐릭터. idle/walk 클립을 anim prop에 따라 크로스페이드 재생.
// 인스턴스마다 스켈레톤을 복제(SkeletonUtils)해 로컬/원격 캐릭터가 서로 간섭하지 않게 한다.
import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { applyPrisonSuit } from "./prisonSuit";

const MODEL = "/models/character.glb";
const TARGET_HEIGHT = 2.4; // m
// 모델(RobotExpressive)의 실측 자연 높이(바인드 포즈, 파일 단위). measureGlb로 측정.
// Box3.setFromObject는 스킨/모프 때문에 실제보다 크게 잡혀 캐릭터가 과도하게 작아지므로 고정값 사용.
const MODEL_NATURAL_HEIGHT = 4.599;
const MODEL_FEET_OFFSET = 0.02; // min.y ≈ -0.02 → 발바닥 보정

useGLTF.preload(MODEL);

export type AnimState = "idle" | "walk" | "run" | "jump" | "punch";

/** AnimState → GLB(RobotExpressive) 클립 이름. */
const CLIP: Record<AnimState, string> = {
  idle: "Idle",
  walk: "Walking",
  run: "Running",
  jump: "Jump",
  punch: "Punch",
};

export default function Character({
  anim,
  ringColor,
  nick,
}: {
  anim: AnimState;
  ringColor?: string;
  nick?: string;
}) {
  const { scene, animations } = useGLTF(MODEL);
  const group = useRef<THREE.Group>(null);

  // 복제 + 그림자 + 높이 자동 맞춤(피트를 y=0에)
  const model = useMemo(() => {
    const c = skeletonClone(scene);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    applyPrisonSuit(c); // 몸통·팔·다리에 죄수복 줄무늬
    // 실측 자연 높이로 고정 스케일(Box3 자동맞춤은 스킨/모프로 부정확 → 캐릭터가 작아짐)
    const s = TARGET_HEIGHT / MODEL_NATURAL_HEIGHT;
    c.scale.setScalar(s);
    c.position.y = MODEL_FEET_OFFSET * s; // 발바닥을 바닥에 맞춤
    return c;
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const action = actions[CLIP[anim]];
    if (!action) return;
    const oneShot = anim === "jump" || anim === "punch";
    if (oneShot) {
      // 원샷 클립(점프·펀치). 루프로 두면 계속 반복되므로 한 번만 재생하고 마지막 포즈로 정지.
      // 상태 복귀(punch → idle/walk 등)는 재생 대상 컴포넌트가 타이머로 되돌린다.
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    // 원샷은 짧아서 0.25s 페이드로는 거의 안 보인다 → 진입만 빠르게.
    action.reset().fadeIn(oneShot ? 0.08 : 0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [anim, actions]);

  return (
    <group ref={group}>
      <primitive object={model} />
      {ringColor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.32, 0.46, 28]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.75} />
        </mesh>
      )}
      {nick && (
        <Html position={[0, TARGET_HEIGHT + 0.25, 0]} center distanceFactor={12}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
            {nick}
          </div>
        </Html>
      )}
    </group>
  );
}

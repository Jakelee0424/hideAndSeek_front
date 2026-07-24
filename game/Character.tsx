"use client";
// GLB 애니메이션 캐릭터. idle/walk 클립을 anim prop에 따라 크로스페이드 재생.
// 인스턴스마다 스켈레톤을 복제(SkeletonUtils)해 로컬/원격 캐릭터가 서로 간섭하지 않게 한다.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { applyPrisonSuit } from "./prisonSuit";

const MODEL = "/models/character.glb";
const TARGET_HEIGHT = 2.4; // m
const HIT_FLASH_MS = 320; // 피격 시 몸이 빨갛게 번쩍였다 잦아드는 시간
const HIT_COLOR = new THREE.Color("#ff2a2a"); // 피격 플래시 색(emissive에 세기만큼 얹는다)
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
  hitAt,
}: {
  anim: AnimState;
  ringColor?: string;
  nick?: string;
  /** 마지막으로 맞은 시각(performance.now). 값이 커지면 몸이 한 번 빨갛게 번쩍인다. */
  hitAt?: number;
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
    // 피격 플래시용: 재질을 인스턴스별로 복제해 emissive를 안전하게 흔든다.
    // 원본·줄무늬 재질은 여러 캐릭터가 공유하므로 그대로 건드리면 전원이 같이 번쩍인다.
    // ⚠️ Material.clone()은 onBeforeCompile·customProgramCacheKey(줄무늬 셰이더 패치)를
    //    복사하지 않는다 → 복제본이 민무늬가 된다. 원본에서 그 둘을 그대로 옮겨 붙여 줄무늬를
    //    살린다. 캐시 키가 같아 복제해도 셰이더는 한 번만 컴파일된다.
    const mats: { mat: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const src = mesh.material as THREE.Material;
      const cloned = src.clone();
      cloned.onBeforeCompile = src.onBeforeCompile;
      cloned.customProgramCacheKey = src.customProgramCacheKey;
      cloned.needsUpdate = true;
      mesh.material = cloned;
      const std = cloned as THREE.MeshStandardMaterial;
      if (std.emissive) mats.push({ mat: std, base: std.emissive.clone() });
    });
    // 실측 자연 높이로 고정 스케일(Box3 자동맞춤은 스킨/모프로 부정확 → 캐릭터가 작아짐)
    const s = TARGET_HEIGHT / MODEL_NATURAL_HEIGHT;
    c.scale.setScalar(s);
    c.position.y = MODEL_FEET_OFFSET * s; // 발바닥을 바닥에 맞춤
    return { scene: c, mats };
  }, [scene]);

  // 피격 플래시(0~1). hitAt이 커진 프레임에 1로 튀고, 매 프레임 감쇠하며 emissive에 얹힌다.
  const flash = useRef(0);
  const seenHit = useRef(0);
  useFrame((_, dt) => {
    if (hitAt && hitAt > seenHit.current) {
      seenHit.current = hitAt;
      flash.current = 1;
    }
    if (flash.current <= 0) return;
    flash.current = Math.max(0, flash.current - (dt * 1000) / HIT_FLASH_MS);
    const f = flash.current;
    for (const { mat, base } of model.mats) {
      mat.emissive.setRGB(
        base.r + HIT_COLOR.r * f,
        base.g + HIT_COLOR.g * f,
        base.b + HIT_COLOR.b * f,
      );
    }
  });

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
      <primitive object={model.scene} />
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

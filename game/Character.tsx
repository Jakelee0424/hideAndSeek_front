"use client";
// GLB 애니메이션 캐릭터. idle/walk 클립을 anim prop에 따라 크로스페이드 재생.
// 인스턴스마다 스켈레톤을 복제(SkeletonUtils)해 로컬/원격 캐릭터가 서로 간섭하지 않게 한다.
import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations, Html } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";

const MODEL = "/models/character.glb";
const TARGET_HEIGHT = 1.7; // m

useGLTF.preload(MODEL);

export type AnimState = "idle" | "walk";

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
    const box = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = TARGET_HEIGHT / size.y;
    c.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(c);
    c.position.y -= box2.min.y; // 발바닥을 바닥에 붙임
    return c;
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const name = anim === "walk" ? "Walking" : "Idle";
    const action = actions[name];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
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

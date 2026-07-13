"use client";
// 상호작용 오브젝트 1개. 근접(nearId) 시 발광 하이라이트, 해결(solved) 시 색 변경.
// 문은 해결 시 경첩을 기준으로 부드럽게 열린다(useFrame 보간).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useInteraction, type Interactable as InteractableData } from "./interactables";

const DOOR_OPEN_ANGLE = -1.5; // 열렸을 때 경첩 회전(rad)

const COLOR: Record<string, string> = {
  lockbox: "#b45309",
  door: "#7c3aed",
  note: "#e5e7eb",
};

export default function Interactable({ data }: { data: InteractableData }) {
  const nearId = useInteraction((s) => s.nearId);
  const solved = useInteraction((s) => s.solved[data.id] ?? false);
  const near = nearId === data.id;

  const geo = useMemo(() => {
    switch (data.type) {
      case "door":
        return <boxGeometry args={[1.6, 2, 0.25]} />;
      case "note":
        return <boxGeometry args={[0.5, 0.05, 0.7]} />;
      default:
        return <boxGeometry args={[0.9, 0.9, 0.9]} />; // lockbox
    }
  }, [data.type]);

  const base = COLOR[data.type] ?? "#888";
  const color = solved ? "#22c55e" : base;
  const isDoor = data.type === "door";
  const hinge = useRef<THREE.Group>(null);

  // 문 열림 모션: 목표 각도로 부드럽게 감쇠 보간
  useFrame((_, dt) => {
    if (!isDoor || !hinge.current) return;
    const target = solved ? DOOR_OPEN_ANGLE : 0;
    hinge.current.rotation.y = THREE.MathUtils.damp(
      hinge.current.rotation.y,
      target,
      4,
      dt,
    );
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={near ? "#fde68a" : "#000000"}
      emissiveIntensity={near ? 0.6 : 0}
      metalness={0.2}
      roughness={0.6}
    />
  );

  return (
    <group position={data.position}>
      {isDoor ? (
        // 왼쪽 모서리를 경첩으로: 해결(solved) 시 열림
        <group ref={hinge} position={[-0.8, 0, 0]}>
          <mesh position={[0.8, 0, 0]} castShadow receiveShadow>
            {geo}
            {mat}
          </mesh>
        </group>
      ) : (
        <mesh castShadow receiveShadow>
          {geo}
          {mat}
        </mesh>
      )}

      {near && (
        <Html center distanceFactor={10} position={[0, 1.3, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {solved ? `${data.label} ✓` : `[E] ${data.label}`}
          </div>
        </Html>
      )}
    </group>
  );
}

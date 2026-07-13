"use client";
// 상호작용 오브젝트 1개. 근접(nearId) 시 발광 하이라이트, 해결(solved) 시 색 변경.
import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { useInteraction, type Interactable as InteractableData } from "./interactables";

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

  return (
    <group position={data.position}>
      <mesh castShadow receiveShadow>
        {geo}
        <meshStandardMaterial
          color={color}
          emissive={near ? "#fde68a" : "#000000"}
          emissiveIntensity={near ? 0.6 : 0}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>

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

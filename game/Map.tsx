"use client";
// 맵. 지금은 절차적 지오메트리(방 + 벽 + 소품)로 구성.
// GLB 맵이 준비되면 <ModelMap/> 처럼 useGLTF("/models/map.glb")로 교체하면 된다.
//   import { useGLTF } from "@react-three/drei";
//   function ModelMap(){ const { scene } = useGLTF("/models/map.glb"); return <primitive object={scene} /> }
import Interactable from "./Interactable";
import { INTERACTABLES } from "./interactables";

const ROOM = 11; // 방 반경(±11)
const WALL_H = 3;

function Wall({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#2b303b" />
    </mesh>
  );
}

function Crate({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#6b5636" />
    </mesh>
  );
}

export default function GameMap() {
  const t = 0.4; // 벽 두께
  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM * 2, ROOM * 2]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>

      {/* 벽 4면 */}
      <Wall position={[0, WALL_H / 2, -ROOM]} size={[ROOM * 2, WALL_H, t]} />
      <Wall position={[0, WALL_H / 2, ROOM]} size={[ROOM * 2, WALL_H, t]} />
      <Wall position={[-ROOM, WALL_H / 2, 0]} size={[t, WALL_H, ROOM * 2]} />
      <Wall position={[ROOM, WALL_H / 2, 0]} size={[t, WALL_H, ROOM * 2]} />

      {/* 소품(장식) */}
      <Crate position={[3, 0.5, 3]} />
      <Crate position={[4, 0.5, 3]} />
      <Crate position={[4, 1.5, 3]} />
      <Crate position={[-4, 0.5, -5]} />

      {/* 상호작용 오브젝트 */}
      {INTERACTABLES.map((it) => (
        <Interactable key={it.id} data={it} />
      ))}
    </group>
  );
}

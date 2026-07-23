"use client";
// 상호작용 오브젝트 1개(자물쇠/힌트). 근접(nearId) 시 발광 하이라이트.
// 자물쇠(lockbox)는 해결(solved) 시 초록으로 바뀐다(→ 그 방 감방문이 열림).
import { Html } from "@react-three/drei";
import { useInteraction, type Interactable as InteractableData } from "./interactables";

// 근접 시 발광색
const NEAR_EMISSIVE = "#fde68a";
// 미해결 오브젝트의 평상시 은은한 발광. 밤 씬은 어두워서 이게 없으면 단서를 눈으로 못 찾는다.
// (미니맵엔 위치를 안 주는 설계라, 3D에서 빛으로만 유도한다.)
const IDLE_EMISSIVE = "#ffcf6a";
const IDLE_I = 0.3;

// ── 자물쇠(padlock): 몸통 + U자 고리 + 열쇠구멍 ──────────────────
function Padlock({ color, emissive, glow }: { color: string; emissive: string; glow: number }) {
  const emissiveIntensity = glow;
  return (
    <group>
      {/* U자 고리(스틸). 세로 링의 아랫부분은 몸통에 가려 U자로 보인다. */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <torusGeometry args={[0.26, 0.07, 12, 24]} />
        <meshStandardMaterial
          color="#c7ccd4"
          metalness={0.95}
          roughness={0.25}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.5}
        />
      </mesh>

      {/* 몸통(자물쇠 색). 해결 시 color가 초록으로 넘어온다. */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.9, 0.34]} />
        <meshStandardMaterial
          color={color}
          metalness={0.7}
          roughness={0.35}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* 열쇠구멍(앞면). 원 + 아래 홈. */}
      <mesh position={[0, -0.05, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
        <meshStandardMaterial color="#1b1e24" metalness={0.3} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.22, 0.18]}>
        <boxGeometry args={[0.06, 0.22, 0.06]} />
        <meshStandardMaterial color="#1b1e24" metalness={0.3} roughness={0.8} />
      </mesh>
    </group>
  );
}

export default function Interactable({ data }: { data: InteractableData }) {
  const nearId = useInteraction((s) => s.nearId);
  const solved = useInteraction((s) => s.solved[data.id] ?? false);
  const near = nearId === data.id;

  const isLock = data.type === "lockbox";
  // 자물쇠: 잠김=황동색, 해결=초록. 힌트(note): 종이색.
  const color = solved ? "#22c55e" : isLock ? "#b8860b" : "#e5e7eb";
  const promptH = isLock ? 1.5 : 1.0;
  // 발광: 해결되면 끈다. 미해결이면 은은히(어둠 속 유도), 근접하면 강하게.
  const glow = solved ? 0 : near ? 0.6 : IDLE_I;
  const emissive = solved ? "#000000" : near ? NEAR_EMISSIVE : IDLE_EMISSIVE;

  return (
    <group position={data.position}>
      {isLock ? (
        <Padlock color={color} emissive={emissive} glow={glow} />
      ) : (
        // 힌트 쪽지(납작한 종이)
        <mesh castShadow receiveShadow rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.7]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={glow}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
      )}

      {near && (
        <Html center distanceFactor={10} position={[0, promptH, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {solved ? `${data.label} ✓` : `[E] ${data.label}`}
          </div>
        </Html>
      )}
    </group>
  );
}

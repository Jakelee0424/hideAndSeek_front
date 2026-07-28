"use client";
// 상호작용 오브젝트 1개(자물쇠/힌트). 근접(nearId) 시 발광 하이라이트.
// 자물쇠(lockbox)는 해결(solved) 시 초록으로 바뀐다(→ 그 방 감방문이 열림).
import { Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useInteraction, type Interactable as InteractableData } from "./interactables";
import { usePrisonAssets } from "./prisonAssets";
import NoteVisual from "./noteVisuals";

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

// ── 자물쇠 변형(OBJ 프리팹) ──────────────────────────────────────
// 예전엔 아홉 개 잠금이 전부 같은 황동 자물쇠였다. 이제 잠금마다 생김새가 다르다.
//   - 감방 4개: 철창 색과 짝이 맞는 네 가지(어느 방 자물쇠인지 눈으로 구분된다)
//   - 별관 3개: 그 방 퍼즐 방식이 자물쇠 모양에 드러난다
//     (세탁실=색 순서판 / 작업장=문자 휠 / 의무실=숫자 다이얼 — 낙서 힌트와 같은 성격)
//   - 정문=크고 번듯한 황동 콤비네이션(함정답게 그럴듯하다) / 배수관=녹슨 콤비네이션
const LOCK_ASSET: Record<string, string> = {
  "lock-A": "lockCellA",
  "lock-B": "lockCellB",
  "lock-C": "lockCellC",
  "lock-D": "lockCellD",
  "lock-laundry": "lockColor",
  "lock-med": "lockNumber",
  // 식당 문 요일 코드 · 냉장고 칼로리 코드 — 숫자 다이얼 자물쇠 프리팹 재사용.
  "lock-cafe": "lockNumber",
  "lock-fridge": "lockNumber",
  // 작업장 방 안 비밀번호 퀴즈 — 예전 작업장 문자 자물쇠(lockLetter) 프리팹을 재사용한다.
  "quiz-work": "lockLetter",
  "gate-lock": "lockGate",
  "escape-pipe": "lockDrain",
};

function LockProp({ id, emissive, glow }: { id: string; emissive: string; glow: number }) {
  const assets = usePrisonAssets();
  const template = assets[LOCK_ASSET[id] ?? ""];

  const obj = useMemo(() => {
    if (!template) return null;
    const o = template.clone(true);
    // 재질을 인스턴스별로 복제한다 — 프리팹 재질을 그대로 쓰면 한 자물쇠를 풀 때
    // 같은 재질을 공유하는 다른 자물쇠까지 함께 빛난다.
    o.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    return o;
  }, [template]);

  // 발광만 갈아 끼운다(색은 프리팹 그대로 둔다 — 통째로 초록칠하면 변형이 무의미해진다).
  useEffect(() => {
    if (!obj) return;
    const color = new THREE.Color(emissive);
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list as THREE.MeshStandardMaterial[]) {
        if (!m.emissive) continue;
        m.emissive.copy(color);
        m.emissiveIntensity = glow;
      }
    });
  }, [obj, emissive, glow]);

  if (!obj) return null;
  return <primitive object={obj} />;
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
        // 프리팹이 로드될 때까지는 절차적 자물쇠로 버틴다(맵 전체를 되돌리지 않게 자체 Suspense).
        // 해결되면 초록으로 은은히 빛난다 — 프리팹은 몸통 색을 못 바꾸니 발광으로 알린다.
        <Suspense fallback={<Padlock color={color} emissive={emissive} glow={glow} />}>
          <LockProp
            id={data.id}
            emissive={solved ? "#22c55e" : emissive}
            glow={solved ? 0.4 : Math.max(glow, 0.22)}
          />
        </Suspense>
      ) : (
        // 힌트 물체 — id별로 성격에 맞는 비주얼(안내문·각인·모래 글씨·배식판 등)
        <NoteVisual id={data.id} emissive={emissive} glow={glow} />
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

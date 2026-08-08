"use client";
// 상호작용 오브젝트 1개(자물쇠/힌트). 근접(nearId) 시 발광 하이라이트.
// 자물쇠(lockbox)는 해결(solved) 시 초록으로 바뀐다(→ 그 방 감방문이 열림).
import { Html } from "@react-three/drei";
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useInteraction, type Interactable as InteractableData } from "./interactables";
import { usePrisonAssets } from "./prisonAssets";
import NoteVisual from "./noteVisuals";
import { wallAwayYaw } from "./collision";

// 근접 시 발광색
const NEAR_EMISSIVE = "#fde68a";
// 미해결 오브젝트의 평상시 은은한 발광. 밤 씬은 어두워서 이게 없으면 단서를 눈으로 못 찾는다.
// (미니맵엔 위치를 안 주는 설계라, 3D에서 빛으로만 유도한다.)
const IDLE_EMISSIVE = "#ffcf6a";
const IDLE_I = 0.3;

// ── 프리팹 자물쇠 전용 발광 세기 ────────────────────────────────────
// 절차적으로 그린 물건(쪽지·도구함·밸브 등)은 위 IDLE_I를 그대로 쓴다. 하지만 OBJ 프리팹
// 자물쇠는 원본 키트의 재질이 그대로 보여야 하는 물건이라 덧칠을 최소로 둔다 —
// 예전엔 평상시 0.3·근접 0.6을 **모든 재질**에 씌워 자물쇠가 통째로 노랗게 물들었다
// (사용자가 네 번 지적한 "원본과 다르게 보인다"의 직접 원인).
// 자물쇠는 다가가서 들여다보는 물건이라 근접값이 화면을 지배한다.
// 근접 신호는 [E] 라벨이 이미 하고 있으므로 발광까지 겹칠 필요가 없다.
//
// ⚠️ 여기가 손잡이다. 너무 어두워 못 찾겠다면 PREFAB_IDLE_I를 올리고,
//    아직도 노랗다면 세 값을 다 0으로 두면 원본 그대로가 된다. (옛 값: 0.3 / 0.6 / 0.4)
const PREFAB_IDLE_I = 0.05; // 평상시 — 어둠 속에서 윤곽만 겨우 잡히는 정도
const PREFAB_NEAR_I = 0.18; // 근접 — 옅게만
const PREFAB_SOLVED_I = 0.35; // 해결 — 초록(프리팹은 몸통 색을 못 바꿔 발광으로 알린다)

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

// ── 작업도구함(quiz-work 전용): 빨간 금속 공구함(몸통+뚜껑+손잡이+걸쇠) ──
// 자물쇠 대신 도구함 모양. 풀리면(solved) 다른 잠금처럼 초록 발광으로 알린다(발광만 갈아 끼운다).
function Toolbox({ emissive, glow }: { emissive: string; glow: number }) {
  const em = { emissive, emissiveIntensity: glow };
  const steel = { color: "#c7ccd4", metalness: 0.9, roughness: 0.3, ...em };
  return (
    <group>
      {/* 몸통 */}
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.32, 0.4]} />
        <meshStandardMaterial color="#b23b2e" metalness={0.4} roughness={0.5} {...em} />
      </mesh>
      {/* 뚜껑(몸통보다 살짝 큰 상판) */}
      <mesh position={[0, 0.37, 0]} castShadow>
        <boxGeometry args={[0.74, 0.12, 0.44]} />
        <meshStandardMaterial color="#8e2f24" metalness={0.4} roughness={0.5} {...em} />
      </mesh>
      {/* 손잡이(가로 바 + 기둥 2) */}
      <mesh position={[0, 0.54, 0]}>
        <boxGeometry args={[0.34, 0.035, 0.05]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 0.48, 0]}>
          <boxGeometry args={[0.035, 0.12, 0.035]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      {/* 앞면 걸쇠 2개(놋쇠) */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.26, 0.21]}>
          <boxGeometry args={[0.08, 0.1, 0.03]} />
          <meshStandardMaterial color="#e0c341" metalness={0.7} roughness={0.4} {...em} />
        </mesh>
      ))}
    </group>
  );
}

// ── 세탁실 배관 밸브 패널(lock-laundry 전용): 수직 관 + 밸브 핸들 4개 + 노선도 판 ──
// "돌리는 밸브"라는 게 멀리서도 읽히게 자물쇠 대신 배관 형태로 그린다. 풀리면 다른 잠금처럼
// 초록 발광으로 알린다(발광만 갈아 끼운다).
function ValveManifold({ emissive, glow }: { emissive: string; glow: number }) {
  const em = { emissive, emissiveIntensity: glow };
  const pipe = { color: "#8a9099", metalness: 0.85, roughness: 0.4, ...em };
  const wheel = { color: "#b8433a", metalness: 0.5, roughness: 0.5, ...em };
  return (
    <group>
      {/* 가로로 누운 본관(밸브 넷이 매달린다) + 양끝 수직 관 */}
      <mesh position={[0, 0.35, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.09, 1.5, 12]} />
        <meshStandardMaterial {...pipe} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, -0.05, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 12]} />
          <meshStandardMaterial {...pipe} />
        </mesh>
      ))}
      {/* 밸브 4개: 짧은 목 + 붉은 핸들 휠(도넛 + 살 두 개) */}
      {[-0.52, -0.17, 0.18, 0.53].map((x, i) => (
        <group key={i} position={[x, 0.35, 0]}>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.055, 0.055, 0.22, 10]} />
            <meshStandardMaterial {...pipe} />
          </mesh>
          {/* 휠은 위를 향해 눕힌다(위에서 돌리는 모양) */}
          <group position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, (i * Math.PI) / 5]}>
            <mesh castShadow>
              <torusGeometry args={[0.14, 0.028, 8, 18]} />
              <meshStandardMaterial {...wheel} />
            </mesh>
            {[0, Math.PI / 2].map((r) => (
              <mesh key={r} rotation={[0, 0, r]}>
                <boxGeometry args={[0.27, 0.03, 0.03]} />
                <meshStandardMaterial {...wheel} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {/* 옆에 걸린 배관 노선도 판(안에서 읽는 그 도면) */}
      <mesh position={[0, 0.95, -0.06]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.04]} />
        <meshStandardMaterial color="#1d2836" metalness={0.2} roughness={0.8} {...em} />
      </mesh>
    </group>
  );
}

// ── 건조대(quiz-laundry 전용): 파이프 걸이 + 널린 세탁물 ──────────
// 라벨을 대조할 옷이 걸린 곳. 옷감 색을 조금씩 달리해 여러 벌로 보이게 한다.
const HUNG = ["#cfd6df", "#b9a37e", "#9fb1c4", "#c8b9a6", "#a8b7a0", "#d3c7bb"];
function DryingRack({ emissive, glow }: { emissive: string; glow: number }) {
  const em = { emissive, emissiveIntensity: glow * 0.5 };
  const steel = { color: "#98a0aa", metalness: 0.8, roughness: 0.45, ...em };
  return (
    <group>
      {/* 양쪽 기둥 + 위 가로대 */}
      {[-0.85, 0.85].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 1.3, 8]} />
            <meshStandardMaterial {...steel} />
          </mesh>
          <mesh position={[x, -0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
            <meshStandardMaterial {...steel} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1.75, 8]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* 널린 세탁물 — 옷걸이 폭·길이를 조금씩 흩어 실제로 널어 둔 느낌을 준다 */}
      {HUNG.map((c, i) => {
        const x = -0.68 + i * 0.27;
        const h = 0.5 + ((i * 7) % 3) * 0.12;
        return (
          <mesh key={c} position={[x, 0.68 - h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, h, 0.06]} />
            <meshStandardMaterial color={c} roughness={0.95} metalness={0} {...em} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── 격리 구역 기록판(quiz-med 전용): 바퀴 달린 차트 보드 + 접촉 기록지 ──
// 병동에서 "읽는 물건"이라는 게 드러나게 자물쇠 대신 이젤형 기록판으로 그린다.
function ChartBoard({ emissive, glow }: { emissive: string; glow: number }) {
  const em = { emissive, emissiveIntensity: glow };
  const steel = { color: "#9aa3ad", metalness: 0.8, roughness: 0.4, ...em };
  return (
    <group>
      {/* 다리 두 짝 + 가로 지지대 */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, -0.05, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 1.1, 8]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      <mesh position={[0, -0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.56, 8]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* 판 + 종이 + 위쪽 집게 */}
      <mesh position={[0, 0.62, 0]} rotation={[-0.18, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.66, 0.8, 0.04]} />
        <meshStandardMaterial color="#39424e" metalness={0.3} roughness={0.7} {...em} />
      </mesh>
      <mesh position={[0, 0.62, 0.035]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.56, 0.7, 0.02]} />
        <meshStandardMaterial color="#eef2e9" roughness={0.9} metalness={0} {...em} />
      </mesh>
      <mesh position={[0, 0.98, 0.05]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.2, 0.06, 0.05]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* 의무실 표시(붉은 십자) */}
      <mesh position={[0, 0.86, 0.06]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.16, 0.045, 0.01]} />
        <meshStandardMaterial color="#c2382f" {...em} />
      </mesh>
      <mesh position={[0, 0.86, 0.06]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[0.045, 0.16, 0.01]} />
        <meshStandardMaterial color="#c2382f" {...em} />
      </mesh>
    </group>
  );
}

// ── 자물쇠 변형(OBJ 프리팹) ──────────────────────────────────────
// 예전엔 아홉 개 잠금이 전부 같은 황동 자물쇠였다. 이제 잠금마다 생김새가 다르다.
//   - 감방 4개: 철창 색과 짝이 맞는 네 가지(어느 방 자물쇠인지 눈으로 구분된다)
//   - 별관 3개: 그 방 퍼즐 방식이 자물쇠 모양에 드러난다
//     (작업장=문자 휠 / 의무실=숫자 다이얼 — 낙서 힌트와 같은 성격.
//      세탁실은 프리팹을 안 쓰고 배관 밸브 패널을 직접 그린다)
//   - 정문=크고 번듯한 황동 콤비네이션(함정답게 그럴듯하다) / 배수관=녹슨 콤비네이션
const LOCK_ASSET: Record<string, string> = {
  "lock-A": "lockCellA",
  "lock-B": "lockCellB",
  "lock-C": "lockCellC",
  "lock-D": "lockCellD",
  // (lock-laundry는 색 순서판 프리팹을 쓰지 않는다 — 퍼즐이 배관 밸브로 바뀌면서
  //  아래 Interactable에서 ValveManifold로 직접 그린다. quiz-laundry도 마찬가지로 건조대.)
  "lock-med": "lockNumber",
  // 식당 문 요일 코드 · 냉장고 칼로리 코드 — 숫자 다이얼 자물쇠 프리팹 재사용.
  "lock-cafe": "lockNumber",
  "lock-fridge": "lockNumber",
  // 작업장 문 볼트-너트 잠금 — 답이 숫자(너트 번호)라 숫자 다이얼 프리팹을 재사용한다.
  "lock-work": "lockNumber",
  // (quiz-work는 자물쇠가 아니라 작업도구함 모양 — 아래 Interactable에서 Toolbox로 직접 그린다.)
  "gate-lock": "lockGate",
  "escape-pipe": "lockDrain",
};

// ── 프리팹 대신 절차적 자물쇠를 쓰는 잠금 ───────────────────────────
// 감방 자물쇠 넷은 OBJ 프리팹(콘솔 상자+문자 휠) 대신 직접 그린 자물쇠(Padlock)를 쓴다.
// 사용자가 다섯 번에 걸쳐 "원본과 다르게 보인다"고 지적한 대상이 이 넷이고,
// "맨 처음(=프리팹이 로드되기 전 폴백)만 정상적인 자물쇠"라고 확인해 줬다 —
// 즉 자물쇠로 읽히는 쪽은 절차적 Padlock이다. 심사 때 화면에 보이는 게 우선이라 그쪽을 쓴다.
//
// 별관 진입 자물쇠(식당·의무실·작업장)도 같은 이유로 뒤따라 옮겼다. 이 셋은 원래
// **넷 다 같은 `lockNumber` 프리팹**을 공유해 서로 구분되지도 않았으므로, 절차적 자물쇠로
// 바꿔도 잃는 정보가 없다. 냉장고(`lock-fridge`)는 식당 **안**에 있고 같은 프리팹을 쓰던
// 물건이라 함께 옮겼다 — 혼자 남으면 같은 방에서 저것만 달라 보인다.
//
// ⚠️ 되돌리려면 이 집합에서 빼면 된다(프리팹 경로는 그대로 살아 있다).
//    정문(`gate-lock`)·배수관(`escape-pipe`)은 **프리팹 유지** — 크고 번듯한 콤비네이션과
//    녹슨 콤비네이션이라는 생김새 자체가 "여기가 최종 관문"이라는 신호 노릇을 한다.
const PROCEDURAL_LOCKS = new Set([
  "lock-A",
  "lock-B",
  "lock-C",
  "lock-D",
  "lock-cafe",
  "lock-fridge",
  "lock-med",
  "lock-work",
]);

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
      const dup = (m: THREE.Material) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        // 원본이 스스로 빛나던 재질인지 여기서 기억해 둔다(아래 하이라이트가 건너뛴다).
        c.userData.selfLit = !!c.emissive && (c.emissive.r > 0 || c.emissive.g > 0 || c.emissive.b > 0);
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(dup)
        : dup(mesh.material);
    });
    return o;
  }, [template]);

  // 근접·해결 하이라이트를 발광으로 얹는다(색은 프리팹 그대로 둔다 — 통째로 초록칠하면
  // 변형이 무의미해진다).
  //
  // ⚠️ **원본이 스스로 빛나던 재질은 건드리지 않는다.** 예전엔 프리팹의 재질을 가리지 않고
  //    전부 덮어썼는데, 자물쇠 키트 31개 재질 중 원본이 빛내는 건 8개뿐이다 —
  //    콘솔 화면 4개(#0a2a15) + 색 버튼 4개(제 색). 그 여덟을 호박색으로 덮어 버리니
  //    되살려 둔 화면 초록·버튼 발광이 런타임에 그대로 지워졌고(그래서 재질 복원 커밋이
  //    화면에 나타나지 않았다), 나머지 23개까지 통째로 빛나 원본과 다른 물건이 됐다.
  //    어둠 속 유도용 은은한 발광은 원본이 안 빛내던 재질에만 얹으면 그대로 성립한다.
  useEffect(() => {
    if (!obj) return;
    const color = new THREE.Color(emissive);
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of list as THREE.MeshStandardMaterial[]) {
        if (!m.emissive || m.userData.selfLit) continue;
        m.emissive.copy(color);
        m.emissiveIntensity = glow;
      }
    });
  }, [obj, emissive, glow]);

  if (!obj) return null;
  return <primitive object={obj} />;
}

export default function Interactable({ data }: { data: InteractableData }) {
  // ⚠️ `s.nearId`를 그대로 구독하면 근접 대상이 바뀔 때마다 **오브젝트 전부(24개)가** 리렌더된다
  //    — 각자 프리팹·발광 트리를 다시 만든다. 오브젝트 옆을 지날 때마다 프레임이 튀던 원인이다.
  //    불리언으로 좁히면 실제로 값이 바뀐 둘(떠난 것·닿은 것)만 리렌더된다.
  const near = useInteraction((s) => s.nearId === data.id);
  const solved = useInteraction((s) => s.solved[data.id] ?? false);

  const isLock = data.type === "lockbox";
  // 프리팹 자물쇠가 바라볼 방향. 데이터에 yaw가 있으면 그걸 쓰고, 없으면 벽을 등지도록
  // 자동 계산한다(collision.wallAwayYaw). 위치는 모듈 상수라 한 번만 계산된다.
  const lockYaw = useMemo(
    () => data.yaw ?? wallAwayYaw(data.position[0], data.position[2]),
    [data.yaw, data.position],
  );
  // 자물쇠: 잠김=황동색, 해결=초록. 힌트(note): 종이색.
  const color = solved ? "#22c55e" : isLock ? "#b8860b" : "#e5e7eb";
  const promptH = isLock ? 1.5 : 1.0;
  // 발광: 해결되면 끈다. 미해결이면 은은히(어둠 속 유도), 근접하면 강하게.
  const glow = solved ? 0 : near ? 0.6 : IDLE_I;
  const emissive = solved ? "#000000" : near ? NEAR_EMISSIVE : IDLE_EMISSIVE;

  return (
    <group position={data.position}>
      {isLock ? (
        data.id === "quiz-work" ? (
          // 작업도구함(자물쇠 대신 도구함 모양). 해결되면 초록 발광.
          <Toolbox
            emissive={solved ? "#22c55e" : emissive}
            glow={solved ? 0.4 : Math.max(glow, 0.22)}
          />
        ) : data.id === "lock-laundry" ? (
          // 세탁실 배관 밸브 패널(자물쇠 대신 배관 모양).
          <ValveManifold
            emissive={solved ? "#22c55e" : emissive}
            glow={solved ? 0.4 : Math.max(glow, 0.22)}
          />
        ) : data.id === "quiz-med" ? (
          // 격리 구역 기록판(병동에서 읽는 물건).
          <ChartBoard
            emissive={solved ? "#22c55e" : emissive}
            glow={solved ? 0.4 : Math.max(glow, 0.22)}
          />
        ) : data.id === "quiz-laundry" ? (
          // 건조대(세탁물이 널린 걸이). 라벨을 대조하는 곳.
          <DryingRack
            emissive={solved ? "#22c55e" : emissive}
            glow={solved ? 0.4 : Math.max(glow, 0.22)}
          />
        ) : PROCEDURAL_LOCKS.has(data.id) ? (
          // 감방 자물쇠 — 프리팹을 쓰지 않고 직접 그린 자물쇠로 간다(위 PROCEDURAL_LOCKS 참고).
          // 회전도 필요 없다. 앞뒤가 거의 같아 어느 방향을 봐도 자물쇠로 읽힌다.
          <Padlock color={color} emissive={emissive} glow={glow} />
        ) : (
          // 프리팹이 로드될 때까지는 절차적 자물쇠로 버틴다(맵 전체를 되돌리지 않게 자체 Suspense).
          // 해결되면 초록으로 은은히 빛난다 — 프리팹은 몸통 색을 못 바꾸니 발광으로 알린다.
          //
          // ⚠️ 회전이 필요하다. 프리팹은 앞면(게임기 화면·문자 휠·숫자 다이얼·판독창)이 로컬
          //    +Z를 보는데, 여기서 위치만 주면 **모든 자물쇠가 월드 +Z 한 방향**을 봐서 벽
          //    방향이 다른 자물쇠는 뒷면이 플레이어를 향한다(밋밋한 상자만 보인다).
          //    예전 절차적 자물쇠는 앞뒤가 거의 같아 티가 안 났고, 프리팹으로 바꾼 뒤 드러났다.
          <group rotation={[0, lockYaw, 0]}>
            <Suspense fallback={<Padlock color={color} emissive={emissive} glow={glow} />}>
              <LockProp
                id={data.id}
                emissive={solved ? "#22c55e" : NEAR_EMISSIVE}
                glow={solved ? PREFAB_SOLVED_I : near ? PREFAB_NEAR_I : PREFAB_IDLE_I}
              />
            </Suspense>
          </group>
        )
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

"use client";
// 힌트 오브젝트(note/doc/gate-note)의 물체별 3D 비주얼.
//
// 예전엔 모든 쪽지가 똑같은 납작한 종이 박스였다 — 배식표든 모래 글씨든 감시탑 각인이든
// 전부 같은 모양이라 정체성이 뭉개졌다. 여기서 id별로 성격에 맞는 메시로 분화한다.
//   - 종이류(안내문·지시서·라벨): 세워 둔 종이/카드. 감옥 밤이 어두워
//     찾기 힘드니 발광(emissive/glow)을 읽는 면에 얹는다(자물쇠와 같은 유도 방식).
//   - 환경물(각인 금속판·배식판·긁힌 벽·모래 글씨·감시탑 돌기둥): 바닥에 붙이거나 세운다.
//
// 좌표 계약(서버 Interactables.java와 맞춰야 하는 것)은 interactables.ts에 그대로 두고,
// 여기선 "id → 어떻게 보일지"만 든다(symbols.ts가 UI 자원을 분리한 것과 같은 방침).
import type { JSX } from "react";

// 힌트 오브젝트가 놓인 group의 로컬 원점은 지면 위 0.6m다(interactables position y=0.6).
// 바닥에 깔아야 하는 환경물은 이만큼 내려 지면에 붙인다.
const GROUND_Y = -0.6;

export type NoteKind =
  | "notice" // 벽에 핀으로 꽂은 안내문
  | "clipboard" // 클립보드에 끼운 지시서
  | "label" // 약장용 작은 라벨 카드
  | "plate" // 각인된 금속판
  | "tray" // 뒷면에 낙서된 배식판
  | "scratch" // 긁힌 자국이 남은 벽 조각
  | "sand" // 바닥 모래에 그은 글씨
  | "stone" // 감시탑 돌기둥의 각인
  | "poster"; // 벽에 세로로 붙인 게시물(배식 순서표·식단표)

// id → 비주얼 종류. 매핑 없으면 기본 안내문.
const NOTE_KIND: Record<string, NoteKind> = {
  // (note-laundry1·note-med1은 2026-08-05 제거 — 화장실에 있던 규칙 전용 쪽지였다.
  //  "notice"·"label" 비주얼은 다른 쪽지가 쓸 수 있게 남겨 둔다.)
  "note-cafe-order": "poster", // 배식 순서표(벽에 세로로)
  "note-cafe-menu": "poster", // 오늘의 식단표(벽에 세로로)
  "note-cafe-tray": "tray", // 배식대 위 식판(금속 식판 비주얼)
  "note-laundry-plan": "poster", // 오늘 세탁 일정(세탁실 남벽에 세로로)
  "note-pipe-map": "poster", // 배관 노선도(세탁실 문 옆 복도 벽)
  "gate-note1": "stone", // 서쪽 감시탑 각인
  "gate-note2": "stone", // 동쪽 감시탑 각인
};

export function noteKind(id: string): NoteKind {
  return NOTE_KIND[id] ?? "notice";
}

interface VisualProps {
  emissive: string; // 근접/평상시 발광색
  glow: number; // 발광 세기(어둠 속 유도)
}

// 읽는 면(종이·라벨 표면)에 얹는 은은한 발광 재질 값 공통.
function readMat(color: string, emissive: string, glow: number) {
  return { color, emissive, emissiveIntensity: glow };
}

// ── 종이류 ────────────────────────────────────────────────────────
// 벽에 핀으로 꽂은 안내문: 살짝 기운 종이 + 위쪽 붉은 핀.
function Notice({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group rotation={[-0.15, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.02, 0.7]} />
        <meshStandardMaterial
          {...readMat("#efe7d3", emissive, glow)}
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>
      {/* 위쪽 압정 */}
      <mesh position={[0, 0.04, 0.3]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#dc2626" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

// 클립보드에 끼운 작업 지시서: 짙은 판 + 종이 + 위쪽 금속 클립.
function Clipboard({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group rotation={[-0.2, 0, 0]}>
      {/* 판 */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.03, 0.8]} />
        <meshStandardMaterial color="#3a3f47" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* 종이 */}
      <mesh position={[0, 0.026, -0.02]} receiveShadow>
        <boxGeometry args={[0.46, 0.02, 0.66]} />
        <meshStandardMaterial
          {...readMat("#f2ede0", emissive, glow)}
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>
      {/* 클립 */}
      <mesh position={[0, 0.05, 0.34]}>
        <boxGeometry args={[0.18, 0.05, 0.07]} />
        <meshStandardMaterial color="#c7ccd4" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 약장 라벨: 작고 흰 임상용 카드 + 위쪽 청록 띠.
function Label({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group rotation={[-0.12, 0, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.02, 0.52]} />
        <meshStandardMaterial
          {...readMat("#f8fafc", emissive, glow)}
          metalness={0.05}
          roughness={0.8}
        />
      </mesh>
      {/* 위쪽 청록 띠(의무실 색) */}
      <mesh position={[0, 0.012, 0.2]}>
        <boxGeometry args={[0.44, 0.021, 0.1]} />
        <meshStandardMaterial color="#14b8a6" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ── 환경물 ────────────────────────────────────────────────────────
// 공구함 각인: 세워 둔 금속판 + 파인 홈(글자 자국).
function Plate({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.44, 0.05]} />
        <meshStandardMaterial
          color="#9aa2ad"
          metalness={0.9}
          roughness={0.4}
          emissive={emissive}
          emissiveIntensity={glow * 0.4}
        />
      </mesh>
      {/* 각인 홈 4획(T _ _ L 느낌의 파인 자국) */}
      {[-0.18, -0.06, 0.06, 0.18].map((x) => (
        <mesh key={x} position={[x, 0, 0.026]}>
          <boxGeometry args={[0.07, 0.24, 0.02]} />
          <meshStandardMaterial color="#2a2e35" metalness={0.6} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// 배식 식판: 칸막이(밥칸·국칸·반찬칸 3)가 있는 금속 식판. 배식대 상판 위에 얹혀(바닥 오프셋 없음),
// 식탁 쪽(-x)에서 잘 보이게 반찬칸을 앞줄에 둔다. 칸마다 음식 색·높이를 다르게 표현한다.
// (interactables 위치 y = 배식대 상판 높이. 여기선 그 원점에 그대로 올린다 — GROUND_Y 안 쓴다.)
function Tray({ emissive, glow }: VisualProps): JSX.Element {
  const metal = {
    color: "#c2c8d0",
    metalness: 0.8,
    roughness: 0.4,
    emissive,
    emissiveIntensity: glow * 0.4,
  };
  const DX = 0.3; // 깊이(식탁↔조리실 방향)
  const DZ = 0.64; // 폭(배식대 길이 방향)
  const RIM = 0.05; // 테두리·칸막이 높이
  const TH = 0.04; // 바닥판 두께
  return (
    <group>
      {/* 바닥판 */}
      <mesh castShadow receiveShadow position={[0, TH / 2, 0]}>
        <boxGeometry args={[DX, TH, DZ]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      {/* 테두리 4면 + 가운데 칸막이(앞 반찬줄 / 뒤 밥·국 구분) */}
      {[
        [DX / 2 - 0.01, RIM, DZ] as const,
        [-DX / 2 + 0.01, RIM, DZ] as const,
      ].map((s, i) => (
        <mesh key={`rx${i}`} position={[i === 0 ? DX / 2 - 0.01 : -DX / 2 + 0.01, TH + RIM / 2, 0]}>
          <boxGeometry args={[0.02, RIM, DZ]} />
          <meshStandardMaterial {...metal} />
        </mesh>
      ))}
      {[DZ / 2 - 0.01, -DZ / 2 + 0.01, 0].map((z, i) => (
        <mesh key={`rz${i}`} position={[0, TH + RIM / 2, z]}>
          <boxGeometry args={[DX, RIM, 0.02]} />
          <meshStandardMaterial {...metal} />
        </mesh>
      ))}
      <mesh position={[0, TH + RIM / 2, 0]}>
        <boxGeometry args={[0.02, RIM, DZ]} />
        <meshStandardMaterial {...metal} />
      </mesh>

      {/* 밥칸(뒤 +x): 봉긋한 흰밥(제일 높다) */}
      <mesh position={[0.075, TH + 0.055, -0.17]}>
        <boxGeometry args={[0.11, 0.11, 0.26]} />
        <meshStandardMaterial color="#f5f0e4" roughness={0.9} />
      </mesh>
      {/* 국칸(뒤 +x): 둥근 그릇 + 국물(낮다) */}
      <mesh position={[0.075, TH + 0.03, 0.19]}>
        <cylinderGeometry args={[0.11, 0.09, 0.06, 20]} />
        <meshStandardMaterial {...metal} />
      </mesh>
      <mesh position={[0.075, TH + 0.058, 0.19]}>
        <cylinderGeometry args={[0.095, 0.09, 0.02, 20]} />
        <meshStandardMaterial color="#7d4a22" roughness={0.7} />
      </mesh>
      {/* 반찬칸 3(앞 -x, 식탁에서 잘 보이는 쪽): 색·높이 제각각(김치·나물·계란) */}
      {[
        { z: -0.19, c: "#c0392b", h: 0.06 },
        { z: 0.0, c: "#6f8f3a", h: 0.04 },
        { z: 0.19, c: "#e6b93f", h: 0.05 },
      ].map((s, i) => (
        <mesh key={`side${i}`} position={[-0.075, TH + s.h / 2, s.z]}>
          <boxGeometry args={[0.11, s.h, 0.17]} />
          <meshStandardMaterial color={s.c} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// 복도 벽의 긁힌 흔적: 세운 콘크리트 조각에 밝은 사선 긁힘 몇 줄.
function Scratch({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group position={[0, -0.05, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.52, 0.07]} />
        <meshStandardMaterial
          color="#7b7f86"
          roughness={0.95}
          emissive={emissive}
          emissiveIntensity={glow * 0.5}
        />
      </mesh>
      {/* 사선 긁힘 */}
      {[
        { x: -0.14, r: 0.5 },
        { x: 0.02, r: 0.35 },
        { x: 0.16, r: 0.6 },
      ].map((s) => (
        <mesh key={s.x} position={[s.x, 0, 0.037]} rotation={[0, 0, s.r]}>
          <boxGeometry args={[0.02, 0.4, 0.012]} />
          <meshStandardMaterial
            color="#d2d6db"
            roughness={0.6}
            emissive={emissive}
            emissiveIntensity={glow * 0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

// 담벼락 밑 모래 글씨: 바닥에 깐 모래 판 + 파인 글씨 홈. 눕는다(수평).
function Sand({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group position={[0, GROUND_Y + 0.015, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[0.92, 0.03, 0.72]} />
        <meshStandardMaterial
          color="#c2a878"
          roughness={1}
          emissive={emissive}
          emissiveIntensity={glow * 0.45}
        />
      </mesh>
      {/* 손가락으로 그은 홈 */}
      {[
        { x: -0.2, z: 0, r: 0.3 },
        { x: 0.05, z: -0.1, r: -0.4 },
        { x: 0.24, z: 0.12, r: 0.2 },
      ].map((g) => (
        <mesh key={`${g.x}-${g.z}`} position={[g.x, 0.016, g.z]} rotation={[0, g.r, 0]}>
          <boxGeometry args={[0.28, 0.008, 0.03]} />
          <meshStandardMaterial color="#8a734f" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// 감시탑 돌기둥의 각인: 세운 화강암 블록 + 앞면에 파인 각인 자리.
function Stone({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group position={[0, GROUND_Y + 0.4, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.8, 0.5]} />
        <meshStandardMaterial
          color="#6a6f77"
          roughness={0.95}
          metalness={0.05}
          emissive={emissive}
          emissiveIntensity={glow * 0.4}
        />
      </mesh>
      {/* 각인 자리(앞면 파임) */}
      <mesh position={[0, 0.05, 0.26]}>
        <boxGeometry args={[0.34, 0.34, 0.03]} />
        <meshStandardMaterial
          color="#3c4046"
          roughness={0.9}
          emissive={emissive}
          emissiveIntensity={glow * 0.6}
        />
      </mesh>
    </group>
  );
}

// 벽에 세로로 붙인 게시물: 벽면과 나란한 세운 종이 + 위쪽 압정 두 개.
// (interactables position 기준 그룹 원점이 벽 앞이라, 여기선 세로 판만 세운다 — 눕히지 않는다.)
function Poster({ emissive, glow }: VisualProps): JSX.Element {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.84, 0.03]} />
        <meshStandardMaterial
          {...readMat("#efe7d3", emissive, glow)}
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>
      {/* 위쪽 압정 두 개 */}
      {[-0.2, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.36, 0.02]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#dc2626" metalness={0.3} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const BUILDERS: Record<string, (p: VisualProps) => JSX.Element> = {
  notice: Notice,
  clipboard: Clipboard,
  label: Label,
  plate: Plate,
  tray: Tray,
  scratch: Scratch,
  sand: Sand,
  stone: Stone,
  poster: Poster,
};

/** id에 맞는 힌트 물체 비주얼. 발광(emissive/glow)은 어둠 속 유도용으로 이어받는다. */
export default function NoteVisual({
  id,
  emissive,
  glow,
}: {
  id: string;
  emissive: string;
  glow: number;
}): JSX.Element {
  const Builder = BUILDERS[noteKind(id)] ?? Notice;
  return <Builder emissive={emissive} glow={glow} />;
}

"use client";
// OBJ 소품 키트(원본 + tier1~3)를 맵에 배치. 방별 세트·감시탑·조명탑은 절차적 소품을 대신하고
// (Map.tsx에서 해당 절차적 데코 제거), 간수 NPC·벽부착물·잡소품·탈출소품은 신규로 얹는다.
//   ⚠️ 대량 배치라 위치·회전·스케일은 1차 근사값 — 화면 보고 튜닝 필요.
import { useMemo } from "react";
import { usePrisonAssets, AssetProp } from "./prisonAssets";
import { CELLS, DOOR_META, TOWERS, getBuilding, cellFurniture, CELL_FURN_SIZE, FLOOR2_Y } from "./prisonLayout";
import type { Building } from "./prisonLayout";
import CellCalendar from "./CellCalendar";
import { Bed, WallTV, Desk, Stool, Partition, Toilet, Sink } from "./CellFurniture";
import { cafeteriaPlan } from "./cafeteriaPlan";
import { useGameStore } from "@/store/gameStore";

// 방 중심(prisonLayout BUILDINGS와 일치). 식당은 절차적 배치(Map.CafeteriaDecor)라 OBJ 세트를 안 쓴다.
// (작업장은 통짜 세트를 빼고 개별 소품으로 배치해 방 중심 상수를 안 쓴다.)
const LAUNDRY: [number, number] = [30, 24];
const INFIRMARY: [number, number] = [30, 10];

// 작업장 작업대 6개: 3열 × 2행(윗줄 1·2·3 / 아랫줄 4·5·6).
const WORKBENCHES: [number, number][] = [
  [9.5, 11.5], [14, 11.5], [18.5, 11.5],
  [9.5, 7.5], [14, 7.5], [18.5, 7.5],
];
// 작업대 위 자잘한 공구 — 벤치마다 개수를 다르게 둔다(2·0·1·1·2·0: 어떤 건 둘, 어떤 건 하나, 어떤 건 없음).
// bench=작업대 인덱스, dx/dz=상판 위 오프셋(겹침 방지), ry=바닥 회전. 바이스는 세우고 망치는 눕힌다.
const WORKBENCH_TOOLS: { bench: number; tool: "vise" | "hammer"; dx: number; dz: number; ry: number }[] = [
  { bench: 0, tool: "vise", dx: -0.4, dz: 0.15, ry: 0.4 },
  { bench: 0, tool: "hammer", dx: 0.35, dz: -0.2, ry: 1.2 },
  { bench: 3, tool: "vise", dx: 0.05, dz: -0.05, ry: 0.9 },
  { bench: 4, tool: "hammer", dx: -0.3, dz: 0.15, ry: 0.2 },
  { bench: 4, tool: "vise", dx: 0.4, dz: -0.2, ry: 1.7 },
  // 벤치 1·5는 비워 두고, 벤치 2("3번")엔 작업도구함 퍼즐(quiz-work, interactables.ts)이 올라간다.
];
const WB_TOP = 0.9; // 작업대 상판 높이(추정 — 화면 보고 조정)

// CCTV(절차적 SecurityCam) 배치 — 정문 위 + 건물 내부·외부 곳곳. rotY는 카메라 정면(+z)이 감시 구역을 향하는 값
// (벽은 정면 반대쪽 = 로컬 -z 쪽에 온다). 시각 전용이라 충돌·서버와 무관.
const SECURITY_CAMS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [0, 4.8, -29.5], rotY: 0 }, // 정문 위 상인방(연병장 내려다봄)
  // ── 건물 내부 ──
  { pos: [-35, 4.0, 19.7], rotY: Math.PI }, // 수감동 복도(북벽에서 남향)
  { pos: [37.7, 4.0, 17], rotY: -Math.PI / 2 }, // 별관 복도(동벽에서 서향)
  { pos: [4, 4.0, 14.4], rotY: 0 }, // 단지 출입구 안쪽(링크 남벽에서 북향)
  { pos: [9, 4.0, 27.7], rotY: Math.PI }, // 식당(북벽)
  { pos: [10, 4.0, 6.3], rotY: 0 }, // 작업장(남벽)
  { pos: [34, 4.0, 6.3], rotY: 0 }, // 의무실(남벽)
  { pos: [34, 4.0, 27.7], rotY: Math.PI }, // 세탁실(북벽)
  // ── 건물 외부(연병장 담장) ──
  { pos: [-41.6, 4.2, -22], rotY: Math.PI / 2 }, // 서벽에서 동향
  { pos: [41.6, 4.2, -12], rotY: -Math.PI / 2 }, // 동벽에서 서향
  { pos: [-22, 4.2, -29.6], rotY: 0 }, // 남벽(정문 서편)에서 북향
  { pos: [22, 4.2, -29.6], rotY: 0 }, // 남벽(정문 동편)에서 북향
];

// 절차적 CCTV(벽 브래킷 + 아래로 기울인 몸통 + 렌즈 + 녹화 LED). 로컬 +z가 정면, 몸통은 이미 아래를 향한다.
function SecurityCam({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 벽 브래킷 판(로컬 -z, 벽 쪽) */}
      <mesh position={[0, 0, -0.12]} castShadow>
        <boxGeometry args={[0.28, 0.28, 0.06]} />
        <meshStandardMaterial color="#3a3f45" roughness={0.6} metalness={0.4} flatShading />
      </mesh>
      {/* 브래킷 팔 */}
      <mesh position={[0, -0.02, 0.03]} castShadow>
        <boxGeometry args={[0.05, 0.05, 0.32]} />
        <meshStandardMaterial color="#4c5158" roughness={0.55} metalness={0.4} flatShading />
      </mesh>
      {/* 카메라 몸통(아래로 0.55rad 기울임) */}
      <group position={[0, -0.05, 0.22]} rotation={[0.55, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.18, 0.16, 0.42]} />
          <meshStandardMaterial color="#d7dade" roughness={0.5} metalness={0.2} flatShading />
        </mesh>
        {/* 렌즈 경통(앞쪽 +z) */}
        <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
          <meshStandardMaterial color="#111318" roughness={0.3} metalness={0.5} flatShading />
        </mesh>
        {/* 렌즈 유리(은은한 발광) */}
        <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
          <meshStandardMaterial color="#1b3a5a" emissive="#16324f" emissiveIntensity={0.4} roughness={0.2} />
        </mesh>
        {/* 붉은 녹화 LED */}
        <mesh position={[0.06, 0.09, 0.12]}>
          <sphereGeometry args={[0.016, 8, 8]} />
          <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// 감방 내부 한 층. 배치 좌표는 prisonLayout.cellFurniture(단일 소스)를 따르고, y로 층을 얹는다.
// 1·2층에 그대로 복제되어 두 층 공간이 통일된다.
function CellInterior({
  b,
  y,
  a,
  day,
}: {
  b: Building;
  y: number;
  a: ReturnType<typeof usePrisonAssets>;
  day: number;
}) {
  const f = cellFurniture(b);
  return (
    <group>
      {/* 왼쪽(서벽) 세로 침대 — 발치는 뒷벽, 머리는 문쪽. 길이는 충돌 박스(≈방 깊이 3/4)와 맞춘다 */}
      <Bed position={[f.bed.cx, y, f.bed.cz]} rotationY={f.bed.rotY} length={CELL_FURN_SIZE.bed.hz * 2} width={CELL_FURN_SIZE.bed.hx * 2} />
      {/* 침대 발치 뒷벽에 벽걸이 TV */}
      <WallTV position={[f.tv.cx, y + 1.6, f.tv.cz]} rotationY={f.tv.rotY} />
      {/* 뒷벽 가운데: 책상(벽 보고 앉음, 큼직하게)+스툴, 위에 달력, 바로 옆에 관물대 */}
      <Desk position={[f.desk.cx, y, f.desk.cz]} rotationY={f.desk.rotY} width={CELL_FURN_SIZE.desk.hx * 2} depth={CELL_FURN_SIZE.desk.hz * 2} />
      <Stool position={[f.stool.cx, y, f.stool.cz]} rotationY={f.faceIn} />
      <CellCalendar day={day} position={[f.calendar.cx, y + 1.62, f.calendar.cz]} rotationY={f.calendar.rotY} />
      {/* 관물대: 세로로 키운다(폭·깊이 1.2, 높이 1.8). 바닥 원점 기준이라 위로 늘어난다. */}
      <group position={[f.locker.cx, y, f.locker.cz]} rotation={[0, f.locker.rotY, 0]} scale={[1.2, 1.8, 1.2]}>
        <AssetProp template={a.locker} position={[0, 0, 0]} />
      </group>
      {/* 오른쪽(동벽) 세로 가벽 안쪽에 변기 + 세면대(절차적 제작, 동벽에 붙여 세움) */}
      <Partition position={[f.partition.cx, y, f.partition.cz]} rotationY={f.partition.rotY} length={f.partition.hz * 2} />
      <Toilet position={[f.toilet.cx, y, f.toilet.cz]} rotationY={f.toilet.rotY} />
      <Sink position={[f.sink.cx, y, f.sink.cz]} rotationY={f.sink.rotY} />
      {/* 낙서(동벽 문쪽). 채광창(파란 하늘창+십자 창틀)은 요청으로 제거. */}
      <AssetProp template={a.wallGraffiti} position={[f.graffiti.cx, y, f.graffiti.cz]} rotationY={f.graffiti.rotY} />
    </group>
  );
}

export default function PrisonProps() {
  const a = usePrisonAssets();
  const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);
  // 오늘 요일(감방 달력용). 방 시드로 정해져 나레이션·식당 배식 순서표와 같은 값이다.
  const roomId = useGameStore((s) => s.roomId);
  const today = useMemo(() => cafeteriaPlan(roomId).today, [roomId]);

  return (
    <group>
      {/* 감방 내부(1·2층 통일): 침대·TV·책상·달력·관물대·가벽+변기·창·낙서.
          배치는 prisonLayout.cellFurniture 단일 소스, 두 층에 같은 세트를 복제한다.
          달력은 스폰 감방에서 오늘 요일을 읽어 식당 문(daycode)에 쓴다 — 네 감방 모두에 건다. */}
      {CELLS.map((c) => {
        const b = getBuilding(c.id)!;
        return (
          <group key={c.id}>
            <CellInterior b={b} y={0} a={a} day={today} />
            <CellInterior b={b} y={FLOOR2_Y} a={a} day={today} />
          </group>
        );
      })}

      {/* 방별 채우기(작업장·세탁실·의무실·식당). 전부 시각 전용이라 서버 충돌과 무관 —
          걸어서 통과되므로 되도록 벽에 붙이고 동선 한가운데는 비운다. */}
      {/* 작업장(6..22 × 6..14, 문 N=door-work): 공구 보관판 2(서벽) · 작업대 6(일정 간격) ·
          사다리(동벽 기대기) · 쓰레기통 2(작업대 사이). 나머지 구조물은 뺐다.
          전부 시각 전용(걸어서 통과) — prisonLayout/Collision의 작업장 충돌 박스도 함께 비웠다. */}
      {/* 공구 부착 보관판 2개: 서쪽 벽(x=6)에 나란히, 방 안(+x)을 향해. 벽 높이(y≈1.2)로 띄운다. */}
      <AssetProp template={a.wsPegboard} position={[6.4, 1.2, 8.5]} rotationY={Math.PI / 2} />
      <AssetProp template={a.wsPegboard} position={[6.4, 1.2, 11.5]} rotationY={Math.PI / 2} />
      {/* 작업대 6개: 3열 × 2행. 윗줄(북,z11.5)=1·2·3, 아랫줄(남,z7.5)=4·5·6.
          가운데 x14 열은 두 줄을 벌려 그 사이로 문(z14)→퀴즈(quiz-work z9.5) 동선을 남긴다. */}
      {WORKBENCHES.map(([x, z], i) => (
        <AssetProp key={`workbench-${i}`} template={a.workbench} position={[x, 0, z]} />
      ))}
      {/* 작업대 위 자잘한 공구(벤치별 개수 제각각). 바이스는 세우고, 망치는 상판에 눕힌다. */}
      {WORKBENCH_TOOLS.map((t, i) => {
        const [bx, bz] = WORKBENCHES[t.bench];
        if (t.tool === "hammer") {
          // 망치 눕히기: 바깥 group=상판 위 방향(ry), 안쪽 group=옆으로 90° 눕힘.
          return (
            <group key={`wbtool-${i}`} position={[bx + t.dx, WB_TOP + 0.05, bz + t.dz]} rotation={[0, t.ry, 0]}>
              <group rotation={[Math.PI / 2, 0, 0]}>
                <AssetProp template={a.wsHammer} position={[0, 0, 0]} />
              </group>
            </group>
          );
        }
        return (
          <AssetProp
            key={`wbtool-${i}`}
            template={a.wsVise}
            position={[bx + t.dx, WB_TOP, bz + t.dz]}
            rotationY={t.ry}
          />
        );
      })}
      {/* 사다리: 동쪽 벽(x≈21.4)에 기울여 기대기. 바깥 group=벽 쪽(+x)으로 기울임, 안쪽 group=벽 향해 회전. */}
      <group position={[21.4, 0, 10]} rotation={[0, 0, -0.18]}>
        <group rotation={[0, -Math.PI / 2, 0]}>
          <AssetProp template={a.ladder3} position={[0, 0, 0]} />
        </group>
      </group>
      {/* 쓰레기통 2개: 1·2 사이(윗줄) / 5·6 사이(아랫줄) */}
      <AssetProp template={a.trash} position={[11.75, 0, 11.5]} />
      <AssetProp template={a.trash} position={[16.25, 0, 7.5]} />
      {/* 세탁실(22..38 × 20..28, 문 S) */}
      <AssetProp template={a.jumpsuitCabinet} position={[25, 0, 27.5]} rotationY={Math.PI} />
      <AssetProp template={a.laundryBasket} position={[35.8, 0, 21.4]} />
      {/* 의무실(22..38 × 6..14, 문 N) */}
      <AssetProp template={a.ivStand} position={[23.8, 0, 8.4]} />
      <AssetProp template={a.curtainPartition} position={[26.4, 0, 9.6]} />
      {/* 식당은 Map.CafeteriaDecor가 절차적으로 채운다(냉장고·긴 배식대·식탁 6). OBJ 세트·캔틴 식탁은 뺐다. */}
      {/* 연결 복도 남벽(출입구 x=0은 비운다) */}
      <AssetProp template={a.fountain} position={[-4, 0, 14.4]} />
      {/* 연병장은 코너 벤치 + 중앙 농구 골대(Map.ParadeDecor)만 남기고 비운다(요청).
          철망·조명탑·운동기구·초소·드럼·팔레트·자루·배수구·밧줄·연병장 EXIT 표지 제거. */}

      {/* 감방 번호판: 문 옆 벽(복도 쪽), 높이 1.6 */}
      {DOOR_META.filter((d) => d.id.startsWith("cell-")).map((d) => {
        const [ax, az] = d.at;
        const s = d.edge === "S";
        return (
          <AssetProp
            key={d.id}
            template={a.cellPlate}
            position={[ax + 1.4, 1.6, az + (s ? -0.3 : 0.3)]}
            rotationY={s ? Math.PI : 0}
          />
        );
      })}

      {/* CCTV: 정문 위 + 건물 내부·외부 곳곳(같은 SecurityCam 형태). 모두 아래를 내려다본다. */}
      {SECURITY_CAMS.map((c, i) => (
        <SecurityCam key={i} position={c.pos} rotationY={c.rotY} />
      ))}

      {/* 방 세트(절차적 데코 대체). 식당은 제외 — Map.CafeteriaDecor가 대신 그린다.
          작업장은 통짜 세트(a.workshop)를 뺐다 — 중앙에 뭉쳐 떠 보였다. 위에서 개별 소품으로 재배치. */}
      <AssetProp template={a.laundry} position={[LAUNDRY[0], 0, LAUNDRY[1]]} />
      <AssetProp template={a.infirmary} position={[INFIRMARY[0], 0, INFIRMARY[1]]} />

      {/* 감시탑 4기(모서리, 안쪽을 향해). 세로로 크게 높여(Y 1.7배) 담장 위로 우뚝 서 감시하는 느낌을 준다.
          바닥이 원점이라 다리는 땅에 붙은 채 위로 자란다. XZ는 그대로라 다리 충돌 박스와 어긋나지 않는다. */}
      {TOWERS.map((t, i) => (
        <group key={i} position={[t[0], 0, t[1]]} rotation={[0, faceCenter(t[0], t[1]), 0]} scale={[1, 1.7, 1]}>
          <AssetProp template={a.watchtower} position={[0, 0, 0]} />
        </group>
      ))}

      {/* 연병장 기물(조명탑·역기벤치·철봉·초소)은 요청으로 제거 — 마당을 비운다. */}

      {/* ⚠️ 장식용 간수 NPC 2명(연병장 [-14,0,-24] · 복도 [0,0,17])을 2026-07-29에 뺐다.
          순찰 간수(PatrolGuards)와 **같은 모델**이라 화면에서 구분이 안 되는데, 이쪽은
          안 움직이고 시야 부채꼴도 없고 적발 판정과도 무관했다. 특히 복도 쪽은 순찰
          경로(중앙 복도 z=17)와 정확히 겹쳐, 플레이어가 "저 간수는 왜 안 움직이지"라고
          판정을 오해하기 딱 좋았다.
          이제 **간수가 보이면 곧 순찰 중**이라는 규칙이 화면에서 그대로 읽힌다.
          (a.guard 프리팹 자체는 PatrolGuards가 계속 쓰므로 DEFS에 그대로 둔다.) */}

      {/* 벽 부착물 */}
      <AssetProp template={a.clock} position={[-22, 2.4, 19.7]} rotationY={Math.PI} />
      <AssetProp template={a.clock} position={[22, 2.4, 19.7]} rotationY={Math.PI} />
      {/* 연병장 정문 EXIT 표지는 제거(요청). 실내 출입구 표지만 남긴다. */}
      <AssetProp template={a.exitSign} position={[0, 2.7, 14.2]} />
      <AssetProp template={a.extinguisher} position={[-6.2, 0, 15]} rotationY={Math.PI / 2} />
      <AssetProp template={a.extinguisher} position={[6.2, 0, 15]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.extinguisher} position={[36.5, 0, 15]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.locker} position={[-37, 0, 16]} rotationY={Math.PI / 2} />
      <AssetProp template={a.locker} position={[-37, 0, 18]} rotationY={Math.PI / 2} />

      {/* 잡소품 (식당 안 쓰레기통은 뺐다 — 식당은 정리된 배치. 작업장 쓰레기통은 위 작업장 블록으로 옮겼다.) */}
      {/* 연병장 잡소품(드럼 2·팔레트·자루)은 요청으로 제거. */}
      <AssetProp template={a.bucketMop} position={[2, 0, 22]} />
      <AssetProp template={a.ladder3} position={[36, 0, 16.5]} rotationY={-Math.PI / 2} />

      {/* 환풍구: 입구(화장실 남벽) 왼편 벽 — 예전엔 문 위 정중앙(x=0)이었다. */}
      <AssetProp template={a.vent} position={[-4.5, 2.5, 19.8]} rotationY={Math.PI} />
      {/* 연병장 배수구·밧줄은 요청으로 제거. */}
    </group>
  );
}

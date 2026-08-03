"use client";
// OBJ 소품 키트(원본 + tier1~3)를 맵에 배치. 방별 세트·감시탑·조명탑은 절차적 소품을 대신하고
// (Map.tsx에서 해당 절차적 데코 제거), 간수 NPC·벽부착물·잡소품·탈출소품은 신규로 얹는다.
//   ⚠️ 대량 배치라 위치·회전·스케일은 1차 근사값 — 화면 보고 튜닝 필요.
import { useMemo } from "react";
import { usePrisonAssets, AssetProp } from "./prisonAssets";
import { CELLS, DOOR_META, TOWERS, getBuilding } from "./prisonLayout";
import CellCalendar from "./CellCalendar";
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

// CCTV: (위치, 목표)
const CAMERAS: { pos: [number, number, number]; target: [number, number] }[] = [
  { pos: [-36, 0, 15], target: [-22, 17] },
  { pos: [36, 0, 15], target: [22, 17] },
  // 식당·작업장 CCTV는 제거(요청). 아래는 세탁실·의무실.
  { pos: [36.5, 0, 27], target: [30, 24] },
  { pos: [36.5, 0, 7], target: [30, 10] },
  { pos: [-38, 0, -27], target: [0, -12] },
  { pos: [38, 0, -27], target: [0, -12] },
];

export default function PrisonProps() {
  const a = usePrisonAssets();
  const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);
  // 오늘 요일(감방 달력용). 방 시드로 정해져 나레이션·식당 배식 순서표와 같은 값이다.
  const roomId = useGameStore((s) => s.roomId);
  const today = useMemo(() => cafeteriaPlan(roomId).today, [roomId]);

  return (
    <group>
      {/* 감방별 이층 침대 + 세면변기 + 번호판 */}
      {CELLS.map((c) => {
        const b = getBuilding(c.id)!;
        const z = (b.rect.z0 + b.rect.z1) / 2;
        const wx = b.rect.x0 + 1.4;
        const doorS = b.openings?.[0]?.edge === "S";
        const tx = b.rect.x1 - 1.3;
        const tz = doorS ? b.rect.z1 - 1.3 : b.rect.z0 + 1.3;
        return (
          <group key={c.id}>
            <AssetProp template={a.bunk} position={[wx, 0, z]} />
            <AssetProp template={a.lavatory} position={[tx, 0, tz]} />
          </group>
        );
      })}

      {/* 감방 안 채우기(방 채우기 세트): 뒷벽에 창·선반·거울, 옆벽에 낙서.
          뒷벽 x 배치는 이미 자리 잡은 것들을 피한다 —
          x0+1.4 이층침대(옆벽), x0+8(=중앙) 표식 낙인(Map.tsx), x1-1.3 세면변기. */}
      {CELLS.map((c) => {
        const b = getBuilding(c.id)!;
        const doorS = b.openings?.[0]?.edge === "S";
        const backZ = doorS ? b.rect.z1 - 0.28 : b.rect.z0 + 0.28; // 뒷벽 안쪽 면
        const faceIn = doorS ? Math.PI : 0; // 뒷벽 물건이 방 안을 보게
        const frontZ = doorS ? b.rect.z0 + 2.6 : b.rect.z1 - 2.6; // 문 쪽
        const x0 = b.rect.x0;
        return (
          <group key={`fill-${c.id}`}>
            <AssetProp template={a.smallWindow} position={[x0 + 4, 0, backZ]} rotationY={faceIn} />
            {/* 오늘 요일 달력(뒷벽, 창과 중앙 표식 낙인[x0+8] 사이). 스폰 감방에서 요일을 읽어
                식당 문(daycode)에 쓴다 — 어느 감방에 스폰되든 보이게 네 감방 모두에 건다. */}
            <CellCalendar day={today} position={[x0 + 6, 1.65, backZ]} rotationY={faceIn} />
            <AssetProp template={a.cellShelf} position={[x0 + 11, 0, backZ]} rotationY={faceIn} />
            <AssetProp template={a.mirrorTowel} position={[x0 + 13.2, 0, backZ]} rotationY={faceIn} />
            {/* 낙서는 동쪽 벽(문 쪽) — 서쪽 벽엔 이층침대가 붙어 있다 */}
            <AssetProp template={a.wallGraffiti} position={[b.rect.x1 - 0.28, 0, frontZ]} rotationY={-Math.PI / 2} />
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
      {/* 연병장: 정문 앞을 좁히는 철망 두 짝 */}
      <AssetProp template={a.razorFence} position={[-6.5, 0, -26]} />
      <AssetProp template={a.razorFence} position={[6.5, 0, -26]} />

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

      {/* CCTV */}
      {CAMERAS.map((cam, i) => (
        <AssetProp key={i} template={a.camera} position={cam.pos} rotationY={faceCenter(cam.pos[0] - cam.target[0], cam.pos[2] - cam.target[1])} />
      ))}

      {/* 방 세트(절차적 데코 대체). 식당은 제외 — Map.CafeteriaDecor가 대신 그린다.
          작업장은 통짜 세트(a.workshop)를 뺐다 — 중앙에 뭉쳐 떠 보였다. 위에서 개별 소품으로 재배치. */}
      <AssetProp template={a.laundry} position={[LAUNDRY[0], 0, LAUNDRY[1]]} />
      <AssetProp template={a.infirmary} position={[INFIRMARY[0], 0, INFIRMARY[1]]} />

      {/* 감시탑 4기(모서리, 안쪽을 향해) */}
      {TOWERS.map((t, i) => (
        <AssetProp key={i} template={a.watchtower} position={[t[0], 0, t[1]]} rotationY={faceCenter(t[0], t[1])} />
      ))}

      {/* 연병장 기물 */}
      <AssetProp template={a.floodTower} position={[-38, 0, -25]} rotationY={Math.PI / 2} />
      <AssetProp template={a.floodTower} position={[38, 0, -25]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.floodTower} position={[0, 0, -28]} />
      <AssetProp template={a.weightBench} position={[-16, 0, -22]} />
      <AssetProp template={a.pullup} position={[-8, 0, -22]} />
      <AssetProp template={a.guardBooth} position={[14, 0, -24]} rotationY={Math.PI} />

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
      <AssetProp template={a.exitSign} position={[0, 3.1, -28]} />
      <AssetProp template={a.exitSign} position={[0, 2.7, 14.2]} />
      <AssetProp template={a.extinguisher} position={[-6.2, 0, 15]} rotationY={Math.PI / 2} />
      <AssetProp template={a.extinguisher} position={[6.2, 0, 15]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.extinguisher} position={[36.5, 0, 15]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.locker} position={[-37, 0, 16]} rotationY={Math.PI / 2} />
      <AssetProp template={a.locker} position={[-37, 0, 18]} rotationY={Math.PI / 2} />

      {/* 잡소품 (식당 안 쓰레기통은 뺐다 — 식당은 정리된 배치. 작업장 쓰레기통은 위 작업장 블록으로 옮겼다.) */}
      <AssetProp template={a.drum} position={[-30, 0, -9]} />
      <AssetProp template={a.drum} position={[-27, 0, -9]} />
      <AssetProp template={a.pallet} position={[-24, 0, -6]} />
      <AssetProp template={a.sack} position={[-24, 0.4, -6]} />
      <AssetProp template={a.bucketMop} position={[2, 0, 22]} />
      <AssetProp template={a.ladder3} position={[36, 0, 16.5]} rotationY={-Math.PI / 2} />

      {/* 탈출 관련 소품 */}
      <AssetProp template={a.drain} position={[-18, 0.02, -14]} />
      {/* 환풍구: 입구(화장실 남벽) 왼편 벽 — 예전엔 문 위 정중앙(x=0)이었다. */}
      <AssetProp template={a.vent} position={[-4.5, 2.5, 19.8]} rotationY={Math.PI} />
      <AssetProp template={a.rope} position={[4, 0, -27]} />
    </group>
  );
}

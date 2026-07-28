"use client";
// OBJ 소품 키트(원본 + tier1~3)를 맵에 배치. 방별 세트·감시탑·조명탑은 절차적 소품을 대신하고
// (Map.tsx에서 해당 절차적 데코 제거), 간수 NPC·벽부착물·잡소품·탈출소품은 신규로 얹는다.
//   ⚠️ 대량 배치라 위치·회전·스케일은 1차 근사값 — 화면 보고 튜닝 필요.
import { usePrisonAssets, AssetProp } from "./prisonAssets";
import { CELLS, DOOR_META, TOWERS, getBuilding } from "./prisonLayout";

// 방 중심(prisonLayout BUILDINGS와 일치)
const CAFETERIA: [number, number] = [14, 24];
const WORKSHOP: [number, number] = [14, 10];
const LAUNDRY: [number, number] = [30, 24];
const INFIRMARY: [number, number] = [30, 10];

// CCTV: (위치, 목표)
const CAMERAS: { pos: [number, number, number]; target: [number, number] }[] = [
  { pos: [-36, 0, 15], target: [-22, 17] },
  { pos: [36, 0, 15], target: [22, 17] },
  { pos: [20.5, 0, 27], target: [14, 24] },
  { pos: [7.5, 0, 7], target: [14, 10] },
  { pos: [36.5, 0, 27], target: [30, 24] },
  { pos: [36.5, 0, 7], target: [30, 10] },
  { pos: [-38, 0, -27], target: [0, -12] },
  { pos: [38, 0, -27], target: [0, -12] },
];

export default function PrisonProps() {
  const a = usePrisonAssets();
  const faceCenter = (x: number, z: number) => Math.atan2(-x, -z);

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
            <AssetProp template={a.cellShelf} position={[x0 + 11, 0, backZ]} rotationY={faceIn} />
            <AssetProp template={a.mirrorTowel} position={[x0 + 13.2, 0, backZ]} rotationY={faceIn} />
            {/* 낙서는 동쪽 벽(문 쪽) — 서쪽 벽엔 이층침대가 붙어 있다 */}
            <AssetProp template={a.wallGraffiti} position={[b.rect.x1 - 0.28, 0, frontZ]} rotationY={-Math.PI / 2} />
          </group>
        );
      })}

      {/* 방별 채우기(작업장·세탁실·의무실·식당). 전부 시각 전용이라 서버 충돌과 무관 —
          걸어서 통과되므로 되도록 벽에 붙이고 동선 한가운데는 비운다. */}
      {/* 작업장(6..22 × 6..14, 문 N) */}
      <AssetProp template={a.toolRack} position={[10, 0, 6.4]} />
      <AssetProp template={a.partsBins} position={[21.4, 0, 8.5]} rotationY={-Math.PI / 2} />
      {/* 세탁실(22..38 × 20..28, 문 S) */}
      <AssetProp template={a.jumpsuitCabinet} position={[25, 0, 27.5]} rotationY={Math.PI} />
      <AssetProp template={a.laundryBasket} position={[35.8, 0, 21.4]} />
      {/* 의무실(22..38 × 6..14, 문 N) */}
      <AssetProp template={a.ivStand} position={[23.8, 0, 8.4]} />
      <AssetProp template={a.curtainPartition} position={[26.4, 0, 9.6]} />
      {/* 식당(6..22 × 20..28, 문 S) — 동편이 비어 있어 식탁 둘을 더 놓는다 */}
      <AssetProp template={a.canteenTableA} position={[19, 0, 22.6]} rotationY={Math.PI / 2} />
      <AssetProp template={a.canteenTableB} position={[19, 0, 25.4]} rotationY={Math.PI / 2} />
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

      {/* 방 세트(절차적 데코 대체) */}
      <AssetProp template={a.cafeteria} position={[CAFETERIA[0], 0, CAFETERIA[1]]} />
      <AssetProp template={a.workshop} position={[WORKSHOP[0], 0, WORKSHOP[1]]} />
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

      {/* 잡소품 */}
      <AssetProp template={a.trash} position={[20.5, 0, 26.5]} />
      <AssetProp template={a.trash} position={[8, 0, 8]} />
      <AssetProp template={a.drum} position={[-30, 0, -9]} />
      <AssetProp template={a.drum} position={[-27, 0, -9]} />
      <AssetProp template={a.pallet} position={[-24, 0, -6]} />
      <AssetProp template={a.sack} position={[-24, 0.4, -6]} />
      <AssetProp template={a.bucketMop} position={[2, 0, 22]} />
      <AssetProp template={a.ladder3} position={[36, 0, 16.5]} rotationY={-Math.PI / 2} />
      <AssetProp template={a.keyDisplay} position={[8, 0, 26]} />

      {/* 탈출 관련 소품 */}
      <AssetProp template={a.drain} position={[-18, 0.02, -14]} />
      <AssetProp template={a.vent} position={[0, 2.5, 19.8]} rotationY={Math.PI} />
      <AssetProp template={a.rope} position={[4, 0, -27]} />
    </group>
  );
}

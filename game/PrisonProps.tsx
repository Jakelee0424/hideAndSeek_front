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

      {/* 간수 NPC(연병장·복도) */}
      <AssetProp template={a.guard} position={[-14, 0, -24]} rotationY={Math.PI} />
      <AssetProp template={a.guard} position={[0, 0, 17]} rotationY={Math.PI / 2} />

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

"use client";
// OBJ 소품 키트를 맵에 배치한다. 감방 침대·세면변기는 기존 절차적 박스를 대신하고(같은 자리,
// 충돌 OBSTACLES는 그대로), CCTV·열쇠 거치대는 신규로 얹는다. 감방 문은 애니메이션(BarDoor)을
// 유지하려 교체하지 않는다.
//   ⚠️ 각 프리팹의 회전/미세 위치는 화면을 봐야 맞는다 — 아래 값은 원본 방향 기준 초안이다.
import { usePrisonAssets, AssetProp } from "./prisonAssets";
import { CELLS, getBuilding } from "./prisonLayout";

// CCTV: (위치, 바라볼 목표). 회전은 렌즈 기본 방향(+z)이 목표를 향하게 계산한다.
const CAMERAS: { pos: [number, number, number]; target: [number, number] }[] = [
  { pos: [-36, 0, 15], target: [-22, 17] }, // 수감동 복도
  { pos: [36, 0, 15], target: [22, 17] }, // 별관 복도
  { pos: [20.5, 0, 27], target: [14, 24] }, // 식당
  { pos: [7.5, 0, 7], target: [14, 10] }, // 작업장
  { pos: [36.5, 0, 27], target: [30, 24] }, // 세탁실
  { pos: [36.5, 0, 7], target: [30, 10] }, // 의무실
  { pos: [-38, 0, -27], target: [0, -12] }, // 연병장 남서
  { pos: [38, 0, -27], target: [0, -12] }, // 연병장 남동
];

export default function PrisonProps() {
  const a = usePrisonAssets();

  return (
    <group>
      {/* 감방별 이층 침대 + 세면변기(절차적 박스 대체 — CellInterior에서 뺐다) */}
      {CELLS.map((c) => {
        const b = getBuilding(c.id)!;
        const z = (b.rect.z0 + b.rect.z1) / 2;
        const wx = b.rect.x0 + 1.4; // 서쪽 벽 앞(침대)
        const doorS = b.openings?.[0]?.edge === "S";
        const tx = b.rect.x1 - 1.3; // 동쪽 구석(세면변기)
        const tz = doorS ? b.rect.z1 - 1.3 : b.rect.z0 + 1.3; // 문 반대편 구석
        return (
          <group key={c.id}>
            <AssetProp template={a.bunk} position={[wx, 0, z]} />
            <AssetProp template={a.lavatory} position={[tx, 0, tz]} />
          </group>
        );
      })}

      {/* CCTV 카메라(신규): 복도·방·연병장. 렌즈(+z)가 목표를 향하게 회전. */}
      {CAMERAS.map((cam, i) => {
        const rotY = Math.atan2(cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[2]);
        return <AssetProp key={i} template={a.camera} position={cam.pos} rotationY={rotY} />;
      })}

      {/* 열쇠 거치대(장식): 식당 구석 */}
      <AssetProp template={a.key} position={[8, 0, 26]} />
    </group>
  );
}

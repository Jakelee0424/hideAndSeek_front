"use client";
// 사용자가 만든 프리즌 소품 키트(OBJ+MTL)를 로드해 이름별 프리팹으로 떼어 쓴다.
//   prison-escape-assets.obj = 감방문·이층침대·세면변기·CCTV·열쇠 5종이 x축을 따라 나열된 키트.
// OBJLoader가 각 오브젝트(o)를 개별 메시로 만들어 이름을 보존하므로, 이름 접두사로 묶어
// 프리팹 그룹을 만들고 각 프리팹을 "바닥 중심 = 원점"으로 옮겨 맵 좌표에 배치할 수 있게 한다.
//   ⚠️ 위치·회전·스케일은 화면을 봐야 맞는다(원본 방향/크기 기준으로 잡아둠).
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import * as THREE from "three";

const OBJ_URL = "/models/prison-escape-assets.obj";
const MTL_URL = "/models/prison-escape-assets.mtl";

export type AssetKind = "door" | "bunk" | "lavatory" | "camera" | "key";

function kindOf(name: string): AssetKind | null {
  if (name.startsWith("door_") || name === "lock_plate") return "door";
  if (
    name.startsWith("bed_") ||
    name.startsWith("mattress") ||
    name.startsWith("pillow") ||
    name.startsWith("ladder")
  )
    return "bunk";
  if (
    name === "unit_body" ||
    name.startsWith("sink") ||
    name.startsWith("faucet") ||
    name.startsWith("toilet")
  )
    return "lavatory";
  if (name.startsWith("cam_")) return "camera";
  if (name.startsWith("key")) return "key";
  return null;
}

/** 프리팹 템플릿(바닥 중심이 원점). AssetProp이 이걸 복제해 배치한다. */
export function usePrisonAssets(): Record<AssetKind, THREE.Group> {
  const materials = useLoader(MTLLoader, MTL_URL);
  const obj = useLoader(OBJLoader, OBJ_URL, (loader) => {
    materials.preload();
    (loader as OBJLoader).setMaterials(materials);
  });

  return useMemo(() => {
    const groups: Record<AssetKind, THREE.Group> = {
      door: new THREE.Group(),
      bunk: new THREE.Group(),
      lavatory: new THREE.Group(),
      camera: new THREE.Group(),
      key: new THREE.Group(),
    };
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const k = kindOf(o.name);
      if (!k) return;
      const m = mesh.clone();
      m.castShadow = true;
      m.receiveShadow = true;
      groups[k].add(m);
    });
    // 각 프리팹을 바닥 중심(원점)으로 이동: x/z는 bbox 중심, y는 최저점(바닥)이 0이 되게.
    (Object.keys(groups) as AssetKind[]).forEach((k) => {
      const g = groups[k];
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      const off = new THREE.Vector3(
        (box.min.x + box.max.x) / 2,
        box.min.y,
        (box.min.z + box.max.z) / 2,
      );
      g.children.forEach((c) => c.position.sub(off));
    });
    return groups;
  }, [obj]);
}

/** 프리팹 하나를 복제해 배치. 지오메트리·재질은 공유(정적 소품이라 안전). */
export function AssetProp({
  template,
  position,
  rotationY = 0,
  scale = 1,
}: {
  template: THREE.Group;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const obj = useMemo(() => template.clone(true), [template]);
  return <primitive object={obj} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

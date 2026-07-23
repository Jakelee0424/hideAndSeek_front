"use client";
// 사용자 제작 프리즌 소품(OBJ+MTL) 로드·분리. 여러 파일(원본 키트 + tier1~3)을 읽어, 오브젝트
// 이름 접두사로 프리팹을 떼어 낸다. MTL 재질(MeshPhong)은 씬과 톤을 맞추려 PBR(Standard)로
// 변환하고, 각 프리팹은 "바닥 중심 = 원점"으로 옮겨 맵 좌표에 바로 배치할 수 있게 한다.
//   ⚠️ 위치·회전·스케일은 화면을 봐야 맞는다(대량 배치라 1차는 근사값).
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import * as THREE from "three";

function useObj(url: string): THREE.Group {
  const mtl = useLoader(MTLLoader, url.replace(/\.obj$/, ".mtl"));
  return useLoader(OBJLoader, url, (loader) => {
    mtl.preload();
    (loader as OBJLoader).setMaterials(mtl);
  });
}

// 재질명 키워드 → PBR 파라미터. 이름 전수 열거 대신 키워드로 분류(파일마다 재질명이 다양).
function pbrFor(name: string): { roughness: number; metalness: number; emissive: boolean; glass: boolean } {
  const n = name.toLowerCase();
  const glass = /glass|iv_bag/.test(n);
  const emissive = /glow/.test(n);
  let roughness = 0.7;
  let metalness = 0.1;
  if (glass) {
    roughness = 0.1;
    metalness = 0;
  } else if (/steel|metal|brass|gold|chrome|buckle|badge|ring|screw|bar\b/.test(n)) {
    roughness = 0.4;
    metalness = 0.8;
  } else if (/wood/.test(n)) {
    roughness = 0.85;
    metalness = 0;
  } else if (/concrete/.test(n)) {
    roughness = 0.95;
    metalness = 0;
  } else if (/rubber|mattress|pillow|skin|uniform|cloth|sack|cap|towel|pad/.test(n)) {
    roughness = 0.9;
    metalness = 0;
  } else if (/porcelain|white/.test(n)) {
    roughness = 0.5;
    metalness = 0.05;
  }
  return { roughness, metalness, emissive, glass };
}

type Src = "kit" | "t1" | "t2" | "t3";
interface Def {
  key: string;
  src: Src;
  prefixes: string[];
}

// 프리팹 정의: 각 파일에서 이름 접두사로 묶는다(파일 안에서 접두사는 서로 겹치지 않게 배분).
const DEFS: Def[] = [
  // 원본 키트
  { key: "bunk", src: "kit", prefixes: ["bed_", "mattress", "pillow", "ladder"] },
  { key: "lavatory", src: "kit", prefixes: ["unit_body", "sink", "faucet", "toilet"] },
  { key: "camera", src: "kit", prefixes: ["cam_"] },
  { key: "keyDisplay", src: "kit", prefixes: ["key"] },
  // tier1
  { key: "watchtower", src: "t1", prefixes: ["tower_", "cabin_", "searchlight", "guard_post"] },
  { key: "cafeteria", src: "t1", prefixes: ["table_", "bench_", "counter_", "sneeze_guard", "food_tray", "food_well", "tray_stack", "cup"] },
  { key: "workshop", src: "t1", prefixes: ["workbench_", "pegboard", "vise_", "wrench", "hammer_", "tool_handle", "saw_", "screwdriver", "crate", "ladder_"] },
  { key: "clock", src: "t1", prefixes: ["clock_"] },
  { key: "exitSign", src: "t1", prefixes: ["exit_"] },
  { key: "extinguisher", src: "t1", prefixes: ["extinguisher_"] },
  { key: "locker", src: "t1", prefixes: ["wall_locker", "locker_", "wall_panel", "wall_skirt"] },
  { key: "cellPlate", src: "t1", prefixes: ["cell_number_plate", "plate_"] },
  // tier2
  { key: "laundry", src: "t2", prefixes: ["washer_", "folding_", "folded_towel", "cart_", "clothes_line", "line_post", "hanging_cloth", "laundry_pile", "rack_"] },
  { key: "infirmary", src: "t2", prefixes: ["bed_", "cabinet_", "medicine_bottle", "iv_", "wheelchair_", "wheel_spoke"] },
  { key: "weightBench", src: "t2", prefixes: ["barbell_", "bench_"] },
  { key: "pullup", src: "t2", prefixes: ["pullup_"] },
  { key: "floodTower", src: "t2", prefixes: ["light_tower_", "flood_lamp", "flood_glow"] },
  { key: "guardBooth", src: "t2", prefixes: ["booth_"] },
  // tier3
  { key: "guard", src: "t3", prefixes: ["guard_"] },
  { key: "trash", src: "t3", prefixes: ["trash_"] },
  { key: "drum", src: "t3", prefixes: ["drum_"] },
  { key: "pallet", src: "t3", prefixes: ["pallet_"] },
  { key: "sack", src: "t3", prefixes: ["sack_"] },
  { key: "bucketMop", src: "t3", prefixes: ["bucket_", "mop_"] },
  { key: "drain", src: "t3", prefixes: ["drain_"] },
  { key: "vent", src: "t3", prefixes: ["vent_"] },
  { key: "rope", src: "t3", prefixes: ["rope_"] },
  { key: "ladder3", src: "t3", prefixes: ["ladder_"] },
];

export type AssetKey = (typeof DEFS)[number]["key"];

export function usePrisonAssets(): Record<string, THREE.Group> {
  const kit = useObj("/models/prison-escape-assets.obj");
  const t1 = useObj("/models/prison-tier1.obj");
  const t2 = useObj("/models/prison-tier2.obj");
  const t3 = useObj("/models/prison-tier3.obj");

  return useMemo(() => {
    const srcs: Record<Src, THREE.Group> = { kit, t1, t2, t3 };
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    const toStd = (src: THREE.Material): THREE.MeshStandardMaterial => {
      const name = src.name || "default";
      const hit = cache.get(name);
      if (hit) return hit;
      const color = (src as THREE.MeshPhongMaterial).color?.clone() ?? new THREE.Color("#888888");
      const p = pbrFor(name);
      const std = new THREE.MeshStandardMaterial({ color, roughness: p.roughness, metalness: p.metalness });
      if (p.glass) {
        std.transparent = true;
        std.opacity = 0.5;
      }
      if (p.emissive) {
        std.emissive = color.clone();
        std.emissiveIntensity = 0.9;
      }
      cache.set(name, std);
      return std;
    };

    const out: Record<string, THREE.Group> = {};
    for (const def of DEFS) {
      const g = new THREE.Group();
      srcs[def.src].traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!def.prefixes.some((p) => o.name === p || o.name.startsWith(p))) return;
        const m = mesh.clone();
        m.material = Array.isArray(mesh.material) ? mesh.material.map(toStd) : toStd(mesh.material);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      });
      // 바닥 중심을 원점으로.
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      if (isFinite(box.min.x)) {
        const off = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
        g.children.forEach((c) => c.position.sub(off));
      }
      out[def.key] = g;
    }
    return out;
  }, [kit, t1, t2, t3]);
}

/** 프리팹 하나를 복제해 배치. 지오메트리·재질 공유(정적 소품). */
export function AssetProp({
  template,
  position,
  rotationY = 0,
  scale = 1,
}: {
  template?: THREE.Group;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const obj = useMemo(() => template?.clone(true) ?? null, [template]);
  if (!obj) return null;
  return <primitive object={obj} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

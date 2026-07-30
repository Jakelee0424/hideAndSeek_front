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
import { assetTexture } from "./assetTextures";

function useObj(url: string): THREE.Group {
  const mtl = useLoader(MTLLoader, url.replace(/\.obj$/, ".mtl"));
  return useLoader(OBJLoader, url, (loader) => {
    mtl.preload();
    (loader as OBJLoader).setMaterials(mtl);
  });
}

/**
 * 원본 에셋의 재질값 표(아티팩트 html + prison-kit.js에서 추출한 실제 값 65개).
 *
 * MTL은 metalness·emissive를 싣지 못한다 — 익스포터(three-d-stage)가 Kd/Ks/Ns/d만 쓴다.
 * 대신 **재질 이름은 그대로 남으므로** 이름으로 원본 값을 되찾는다.
 *
 * ⚠️ 이걸 이름 키워드로 "추측"하면 안 된다. 씬에 환경맵이 없어서 metalness가 높으면 반사할
 *    게 없어 **검게 죽는다** — 원본이 금속을 0~0.4로 낮게 잡은 이유다. 추측 시절엔
 *    /steel|brass|gold/에 0.8을 줘서 침대 난간(steelDark, 원본 0.35)이 새까맣게 나왔다.
 *
 * roughness는 여기 없다 — MTL의 Ns에 원본이 그대로 들어 있다(Ns = (1-roughness)*200,
 * 실측: steel r0.45 → Ns 110 / gold r0.5 → Ns 100). toStd가 역산한다.
 * 투명도도 여기 없다 — MTL의 d가 원본 opacity를 그대로 싣는다.
 */
const ASSET_MAT: Record<
  string,
  { metalness: number; emissive?: string; emissiveIntensity?: number }
> = {
  basin_hollow: { metalness: 0.35 },
  basket: { metalness: 0 },
  black: { metalness: 0.3 },
  blue: { metalness: 0 },
  brass: { metalness: 0.4 },
  cab_inner: { metalness: 0.2 },
  cap: { metalness: 0.1 },
  chainlink_mesh: { metalness: 0.4 },
  concrete: { metalness: 0 },
  concreteD: { metalness: 0 },
  console_screen: { metalness: 0, emissive: "#0a2a15", emissiveIntensity: 0.5 },
  curtain: { metalness: 0 },
  curtain_hem: { metalness: 0 },
  curtain_mesh: { metalness: 0 },
  cyan: { metalness: 0, emissive: "#22b6da", emissiveIntensity: 0.9 },
  darkGlass: { metalness: 0.4 },
  drip_chamber: { metalness: 0 },
  flood_glow: { metalness: 0, emissive: "#ffe487", emissiveIntensity: 1 },
  food_greens: { metalness: 0 },
  food_mash: { metalness: 0 },
  food_stew: { metalness: 0 },
  frame_void: { metalness: 0.2 },
  glass: { metalness: 0.25 },
  gold: { metalness: 0.3 },
  graffiti_decal: { metalness: 0 },
  green: { metalness: 0.1 },
  greenGlow: { metalness: 0, emissive: "#39d05f", emissiveIntensity: 0.8 },
  heat_lamp: { metalness: 0.1, emissive: "#e07a1e", emissiveIntensity: 0.85 },
  iv_bag: { metalness: 0 },
  iv_fluid: { metalness: 0 },
  iv_tube: { metalness: 0 },
  jumpsuit: { metalness: 0 },
  ledRed: { metalness: 0, emissive: "#ff2a2a", emissiveIntensity: 0.6 },
  letter_wheel_face: { metalness: 0.3 },
  mattress: { metalness: 0 },
  mirror: { metalness: 0.85 },
  mirror_smudge: { metalness: 0.3 },
  number_dial_face: { metalness: 0.3 },
  orange: { metalness: 0.1 },
  pillow: { metalness: 0 },
  porcelain: { metalness: 0 },
  puddle: { metalness: 0.2 },
  red: { metalness: 0.1 },
  redGlow: { metalness: 0, emissive: "#ff2a2a", emissiveIntensity: 0.7 },
  rubber: { metalness: 0.1 },
  rust: { metalness: 0.2 },
  rustSteel: { metalness: 0.3 },
  searchlight_glow: { metalness: 0, emissive: "#ffe487", emissiveIntensity: 1 },
  skin: { metalness: 0 },
  sky_beyond: { metalness: 0, emissive: "#4a6b88", emissiveIntensity: 0.25 },
  soap: { metalness: 0 },
  spill: { metalness: 0 },
  steel: { metalness: 0.4 },
  steelD: { metalness: 0.4 },
  steelDark: { metalness: 0.35 },
  suit_split: { metalness: 0 },
  towel: { metalness: 0 },
  uniform: { metalness: 0.05 },
  uniformD: { metalness: 0.05 },
  warning_sign_face: { metalness: 0 },
  wheel_window: { metalness: 0.4 },
  white: { metalness: 0.15 },
  wire: { metalness: 0.5 },
  wood: { metalness: 0 },
  woodD: { metalness: 0 },
  yellow: { metalness: 0.1 },
};

/** 익스포터가 이름 충돌을 피하려 붙인 꼬리(`uniform_1`, `flood_glow_0`)를 떼고 원본 이름을 얻는다. */
function baseName(name: string): string {
  return name.replace(/_\d+$/, "");
}

// 팔레트에 없는 파일별 커스텀 재질용 폴백. 키워드로 대략 분류한다.
function pbrFor(name: string): { roughness: number; metalness: number; emissive: boolean; glass: boolean } {
  const n = name.toLowerCase();
  const glass = /glass|iv_bag|window/.test(n);
  // MTL은 emissive를 싣지 못한다 — 이름으로 되살린다.
  // 파일별 재질 기준: flood_glow·searchlight_glow·eye_glow / console_screen / heat_lamp / ledRed.
  const emissive = /glow|_screen|lamp|^led/.test(n);
  let roughness = 0.7;
  let metalness = 0.1;
  if (glass) {
    roughness = 0.1;
    metalness = 0;
  } else if (/steel|metal|brass|gold|chrome|buckle|badge|ring|screw|bar\b/.test(n)) {
    // ⚠️ 0.8을 주면 안 된다. 환경맵이 없어 반사할 게 없으므로 금속일수록 검게 죽는다.
    //    원본 에셋의 금속 상한(0.4)에 맞춘다 — 표에 없는 재질도 최소한 원본 범위 안에 든다.
    roughness = 0.4;
    metalness = 0.4;
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

type Src = "kit" | "t1" | "t2" | "t3" | "rooms" | "locks" | "guardObj";
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
  // 예전 workshop 통짜 세트(중앙에 뭉쳐 떠 보였다)를 부품별로 뗀다 — 개별 배치한다.
  //   workbench = 작업대(6개) / wsPegboard = 공구 부착 보관판(공구 달린 벽판, 서벽 2개)
  //   wsVise·wsHammer = 작업대 위에 올릴 자잘한 공구. (crate·ladder_는 안 쓴다 — 사다리는 t3.ladder3.)
  { key: "workbench", src: "t1", prefixes: ["workbench_"] },
  { key: "wsPegboard", src: "t1", prefixes: ["pegboard", "wrench", "saw_", "screwdriver"] },
  { key: "wsVise", src: "t1", prefixes: ["vise_"] },
  { key: "wsHammer", src: "t1", prefixes: ["hammer_", "tool_handle"] },
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
  // 간수는 전용 파일(prison-guard-robot)로 갈아 끼웠다. 파일 안에 이 인물 하나뿐이라
  // 접두사 ""로 전부 가져온다. tier3의 guard_* 메시는 이제 안 쓴다(파일에는 남아 있다).
  { key: "guard", src: "guardObj", prefixes: [""] },
  { key: "trash", src: "t3", prefixes: ["trash_"] },
  { key: "drum", src: "t3", prefixes: ["drum_"] },
  { key: "pallet", src: "t3", prefixes: ["pallet_"] },
  { key: "sack", src: "t3", prefixes: ["sack_"] },
  { key: "bucketMop", src: "t3", prefixes: ["bucket_", "mop_"] },
  { key: "drain", src: "t3", prefixes: ["drain_"] },
  { key: "vent", src: "t3", prefixes: ["vent_"] },
  { key: "rope", src: "t3", prefixes: ["rope_"] },
  { key: "ladder3", src: "t3", prefixes: ["ladder_"] },
  // 방 채우기 세트(rooms)·자물쇠 변형(locks)은 익스포트 때 이름을 `그룹__부품`으로 박아 뒀다.
  // → 접두사는 반드시 `__`까지 쓴다(`drain_pipe_`는 `drain_pipe_flange_`까지 먹는다).
  { key: "toolRack", src: "rooms", prefixes: ["tool_rack__"] },
  { key: "partsBins", src: "rooms", prefixes: ["parts_bins__"] },
  { key: "jumpsuitCabinet", src: "rooms", prefixes: ["jumpsuit_cabinet__"] },
  { key: "cellShelf", src: "rooms", prefixes: ["cell_shelf__"] },
  { key: "wallGraffiti", src: "rooms", prefixes: ["wall_graffiti__"] },
  { key: "smallWindow", src: "rooms", prefixes: ["small_window__"] },
  { key: "mirrorTowel", src: "rooms", prefixes: ["mirror_towel_rail__"] },
  { key: "canteenTableA", src: "rooms", prefixes: ["canteen_table_1__"] },
  { key: "canteenTableB", src: "rooms", prefixes: ["canteen_table_2__"] },
  { key: "fountain", src: "rooms", prefixes: ["drinking_fountain__"] },
  { key: "razorFence", src: "rooms", prefixes: ["razor_fence__"] },
  { key: "ivStand", src: "rooms", prefixes: ["iv_stand__"] },
  { key: "curtainPartition", src: "rooms", prefixes: ["curtain_partition__"] },
  { key: "laundryBasket", src: "rooms", prefixes: ["laundry_basket__"] },
  // ⚠️ rooms의 serving_line·tray_stack은 일부러 뺐다 — tier1 cafeteria 프리팹이 이미
  //    배식대(counter_)와 식판 더미(tray_stack)를 들고 있어 그대로 놓으면 겹친다.
  // 자물쇠 9종: 게임의 잠금과 1:1 (감방 4 + 별관 색/문자/숫자 3 + 정문 + 배수관)
  { key: "lockCellA", src: "locks", prefixes: ["cell_lock_1__"] },
  { key: "lockCellB", src: "locks", prefixes: ["cell_lock_2__"] },
  { key: "lockCellC", src: "locks", prefixes: ["cell_lock_3__"] },
  { key: "lockCellD", src: "locks", prefixes: ["cell_lock_4__"] },
  { key: "lockColor", src: "locks", prefixes: ["annex_lock_color__"] },
  { key: "lockLetter", src: "locks", prefixes: ["annex_lock_letter__"] },
  { key: "lockNumber", src: "locks", prefixes: ["annex_lock_number__"] },
  { key: "lockGate", src: "locks", prefixes: ["front_gate_lock__"] },
  { key: "lockDrain", src: "locks", prefixes: ["drain_lock__"] },
];

export type AssetKey = (typeof DEFS)[number]["key"];


// 2026-07-28까지 여기에 SKIP_UNTEXTURED가 있어 chainlink_panel·graffiti_decal·mirror_smudge를
// **통째로 빼고** 있었다. OBJ/MTL이 텍스처를 못 실어 무늬 없는 판때기로 남느니 없는 게 낫다는
// 판단이었다. 이제 그 텍스처를 런타임 캔버스로 다시 그리므로(assetTextures.ts) 뺄 이유가
// 없어져 제외 목록 자체를 지웠다 — 감방 벽 낙서·거울 얼룩·연병장 철망이 원본대로 돌아왔다.
//   ⚠️ 어떤 면이 다시 백지로 보이면 여기가 아니라 assetTextures의 TEXTURES를 볼 것.
//      그 표에 없는 map 의존 재질이 새로 들어온 것이다.

/**
 * 아티팩트 미리보기용 **배경 벽 조각**.
 *
 * 원본(prison-rooms.html)은 소품 하나를 허공에 띄워 보여 주는 도구라, 벽에 다는 물건마다
 * 콘크리트 판을 하나씩 데리고 있다 — `box(1.4, 1.6, 0.1, M.concrete, 'shelf_wall')` 같은 것.
 * 우리 감옥엔 진짜 벽이 있으므로 이 판은 **뒷벽에 덧댄 콘크리트 패치**가 된다:
 *   - 맵 벽은 텍스처가 있고 이 판은 민무늬 단색(#c3c8ce)이라 색이 달라 사각 자국으로 보인다
 *   - 배치 기준이 "뒷벽 안쪽 면"(z±0.28)이라 판이 벽에 반쯤 박힌다 → 겹치는 면에서 z-fighting
 *   - 두께가 제각각(0.10 / 0.12 / 0.24m)이라 벽면이 울퉁불퉁한 누더기가 된다
 * 감방 뒷벽에만 이런 판이 넷(선반·거울·창·낙서) 겹쳐 있었다.
 *
 * ⚠️ parts_bins의 `bin_back_wall`은 여기 넣지 않는다 — 그건 통 자체의 뒷판이라 물건의 일부다.
 */
const BACKDROP_WALL = /__(shelf_wall|mt_wall|window_wall|graffiti_wall)$/;

// 프리팹 분해는 소스 6개(메시 1500+)를 전수 순회하는 무거운 작업이다. useLoader 캐시 덕에
// 소스 그룹은 앱 전체에 하나뿐이므로, 그걸 키로 한 번만 만들고 컴포넌트끼리 공유한다
// (자물쇠마다 이 훅을 부르는데, 캐시가 없으면 자물쇠 수만큼 되풀이된다).
const prefabCache = new WeakMap<THREE.Group, Record<string, THREE.Group>>();

export function usePrisonAssets(): Record<string, THREE.Group> {
  const kit = useObj("/models/prison-escape-assets.obj");
  const t1 = useObj("/models/prison-tier1.obj");
  const t2 = useObj("/models/prison-tier2.obj");
  const t3 = useObj("/models/prison-tier3.obj");
  const rooms = useObj("/models/prison-rooms.obj");
  const locks = useObj("/models/prison-locks.obj");
  const guardObj = useObj("/models/prison-guard-robot.obj");

  return useMemo(() => {
    const cached = prefabCache.get(kit);
    if (cached) return cached;
    const srcs: Record<Src, THREE.Group> = { kit, t1, t2, t3, rooms, locks, guardObj };
    const cache = new Map<string, THREE.MeshStandardMaterial>();
    const toStd = (src: THREE.Material): THREE.MeshStandardMaterial => {
      const name = src.name || "default";
      const hit = cache.get(name);
      if (hit) return hit;
      const phong = src as THREE.MeshPhongMaterial;
      // ⚠️ 색공간 이중 변환 보정 — 안 하면 원본보다 훨씬 어둡고 탁하게 나온다.
      //    에셋을 만든 익스포터(three-d-stage)는 THREE.Color 내부값을 Kd에 그대로 쓴다. 그 값은
      //    **선형**이다(실측: steel #aeb6bf → Kd 0.4233 0.4678 0.5210 = 선형값 그대로).
      //    그런데 MTLLoader는 Kd를 sRGB로 보고 다시 선형으로 변환한다
      //    (MTLLoader.js `ColorManagement.colorSpaceToWorking(..., SRGBColorSpace)`).
      //    → steel이 0.4233에서 0.1497로, 64% 어두워진 채 로드된다.
      //    한 번 더 선형→sRGB를 걸어 그 변환을 정확히 되돌린다.
      const color =
        phong.color?.clone().convertLinearToSRGB() ?? new THREE.Color("#888888");
      const p = pbrFor(name);
      const kit = ASSET_MAT[baseName(name)];
      // roughness는 MTL Ns에 원본이 그대로 있다(Ns = (1-roughness)*200). 이름으로 추측하지 말 것.
      const ns = (phong as { shininess?: number }).shininess;
      const roughness =
        typeof ns === "number" ? THREE.MathUtils.clamp(1 - ns / 200, 0, 1) : p.roughness;
      const std = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness: kit ? kit.metalness : p.metalness,
        // 원본 키트는 모든 재질이 flatShading이다(prison-kit.js의 makeKit). 안 켜면 저폴리
        // 각이 뭉개져 흐물흐물해 보인다 — 원본과 다르게 보이던 또 하나의 원인.
        flatShading: true,
      });
      // MTL의 d(투명도)를 살린다. 새 재질을 만들면서 흘리면 유리·커튼·수액백이 불투명해진다.
      const opacity = typeof phong.opacity === "number" ? phong.opacity : 1;
      if (p.glass || opacity < 1) {
        std.transparent = true;
        std.opacity = p.glass ? Math.min(opacity, 0.5) : opacity;
      }
      // 발광: 팔레트에 원본 색·세기가 있으면 그대로, 없으면 이름 판정으로 본색을 얹는다.
      if (kit?.emissive) {
        std.emissive = new THREE.Color(kit.emissive);
        std.emissiveIntensity = kit.emissiveIntensity ?? 0.8;
      } else if (p.emissive) {
        std.emissive = color.clone();
        std.emissiveIntensity = 0.9;
      }
      // OBJ/MTL이 못 실은 캔버스 텍스처를 다시 붙인다(assetTextures.ts에서 런타임에 그린다).
      // ⚠️ 이 재질들은 color가 흰색이고 **생김새 전부가 맵에 있다** — 맵이 없으면 백지가 된다.
      //    transparent도 MTL이 못 싣는 값이라 여기서 함께 되살린다.
      const restored = assetTexture(baseName(name));
      if (restored) {
        std.map = restored.map;
        if (restored.transparent) std.transparent = true;
        if (restored.doubleSide) std.side = THREE.DoubleSide;
      }
      cache.set(name, std);
      return std;
    };

    const out: Record<string, THREE.Group> = {};
    for (const def of DEFS) {
      const g = new THREE.Group();
      const backdrops: THREE.Object3D[] = [];
      srcs[def.src].traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (!def.prefixes.some((p) => o.name === p || o.name.startsWith(p))) return;
        const m = mesh.clone();
        m.material = Array.isArray(mesh.material) ? mesh.material.map(toStd) : toStd(mesh.material);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        if (BACKDROP_WALL.test(o.name)) backdrops.push(m);
      });
      // 바닥 중심을 원점으로.
      // ⚠️ 배경 벽을 **빼기 전에** 잰다. 빼고 재면 남은 부품의 최저점이 바닥으로 내려앉아
      //    선반·거울이 벽 높이가 아니라 방바닥에 주저앉는다(선반은 원본에서 1.5m 높이다).
      //    벽이 있어야 원래 높이를 알 수 있으므로, 재고 → 옮기고 → 그다음에 뺀다.
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g);
      if (isFinite(box.min.x)) {
        const off = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
        g.children.forEach((c) => c.position.sub(off));
      }
      for (const b of backdrops) g.remove(b);
      out[def.key] = g;
    }
    prefabCache.set(kit, out);
    return out;
  }, [kit, t1, t2, t3, rooms, locks, guardObj]);
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

// 아티팩트(prison-*.html)의 절차적 3D 빌더를 Node에서 그대로 돌려 OBJ+MTL로 굽는다.
// 페이지를 브라우저로 열어 "Download OBJ + MTL"을 누르는 것과 같은 결과를 내는 게 목표라,
// three-d-stage.js의 _nameParts()/_exportObj() 로직을 그대로 옮겼다(기존 public/models/* 와 동일 포맷).
//
// 빌더는 CanvasTexture로 무늬를 굽는데, OBJ/MTL은 텍스처를 싣지 않으므로(기존 tier1~3도 마찬가지)
// 캔버스는 no-op 스텁으로 충분하다 — 지오메트리와 재질 색만 나오면 된다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

//   사용법: node tools/asset-export/gen.mjs prison-rooms prison-locks
//   아티팩트 html이 놓인 폴더는 ASSET_SRC로 바꾼다(기본 ~/Downloads). prison-kit.js는
//   확장자가 .js면 이 프로젝트에선 CommonJS로 잡히므로 .mjs 사본을 여기 함께 둔다.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.ASSET_SRC ?? join(process.env.USERPROFILE ?? process.env.HOME ?? ".", "Downloads");
const OUT = join(HERE, "..", "..", "public", "models");

// HTML의 <script type="module"> 본문만 떼어 낸다. prison-kit.js import는 프렐류드가 대신 준다.
function extractModule(html) {
  const start = html.indexOf('<script type="module">');
  if (start < 0) throw new Error("module script를 찾지 못함");
  const bodyStart = html.indexOf(">", start) + 1;
  const end = html.indexOf("</script>", bodyStart);
  return html
    .slice(bodyStart, end)
    .split("\n")
    .filter((l) => !/^\s*import\s+\{\s*makeKit\s*\}/.test(l))
    .join("\n");
}

const PRELUDE = `
import * as THREE_NS from "three";
import { makeKit } from "./prison-kit.mjs";
const __ctx = new Proxy({}, {
  get(_, p) {
    if (p === "canvas") return __mkCanvas();
    if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern")
      return () => ({ addColorStop() {} });
    if (p === "measureText") return () => ({ width: 8 });
    if (p === "getImageData")
      return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 });
    return () => {};
  },
  set() { return true; },
});
function __mkCanvas() { return { width: 1, height: 1, style: {}, getContext: () => __ctx, toDataURL: () => "" }; }
globalThis.document = {
  createElement: () => __mkCanvas(),
  createElementNS: () => __mkCanvas(),
  querySelector: () => ({
    ready: Promise.resolve({ THREE: THREE_NS }),
    setObject(o) { globalThis.__captured = o; },
  }),
};
globalThis.window = globalThis;
`;

// OBJ는 계층을 버리고 `o <이름>` 평면 목록만 남긴다. 프리팹을 이름 접두사로 떼어 내야 하는데
// (prisonAssets.tsx의 DEFS) 부품 이름이 그룹명을 안 물고 있어서 —`colorboard_plate`가
// 어느 자물쇠 것인지 알 수 없다— 최상위 그룹명을 `그룹__부품`으로 미리 박아 준다.
function prefixByTopGroup(root) {
  for (const child of root.children) {
    const group = child.name;
    if (!group) continue;
    child.traverse((o) => {
      if (o.isMesh) o.name = `${group}__${o.name || "part"}`;
    });
  }
}

// three-d-stage.js _nameParts() 이식: o/usemtl 줄에 쓸 이름을 유일하게 채우고 재질 목록을 돌려준다.
function nameParts(object) {
  const mats = [];
  const seen = new Set();
  let meshI = 0;
  let matI = 0;
  object.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.name) o.name = "part_" + meshI;
    meshI += 1;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m || mats.includes(m)) continue;
      if (!m.name) {
        m.name = "mat_" + matI;
        matI += 1;
      }
      while (seen.has(m.name)) {
        m.name = m.name + "_" + matI;
        matI += 1;
      }
      seen.add(m.name);
      mats.push(m);
    }
  });
  return mats;
}

// OBJExporter는 좌표를 17자리 부동소수 그대로 쏟아 낸다(`0.600000011920929`).
// 런타임에 OBJLoader가 통째로 파싱하는 텍스트라 용량이 곧 로딩 시간이다 —
// 위치·법선은 소수 4자리(0.1mm), UV는 5자리로 줄인다. 눈에 보이는 차이는 없다.
function shrink(obj) {
  const round = (s, n) => {
    const v = Number(s);
    return Number.isFinite(v) ? String(Number(v.toFixed(n))) : s;
  };
  return obj
    .split("\n")
    .map((line) => {
      const digits = line.startsWith("vt ") ? 5 : line.startsWith("v ") || line.startsWith("vn ") ? 4 : 0;
      if (!digits) return line;
      const [tag, ...nums] = line.split(" ");
      return tag + " " + nums.map((s) => round(s, digits)).join(" ");
    })
    .join("\n");
}

// three-d-stage.js _exportObj() 이식.
function exportObjMtl(object, base) {
  prefixByTopGroup(object);
  const mats = nameParts(object);
  const obj = "mtllib " + base + ".mtl\n" + shrink(new OBJExporter().parse(object));
  let mtl = "# Exported by three-d-stage\n";
  for (const m of mats) {
    const c = m.color || { r: 0.8, g: 0.8, b: 0.8 };
    const rough = typeof m.roughness === "number" ? m.roughness : 0.5;
    const opacity = typeof m.opacity === "number" ? m.opacity : 1;
    mtl += "newmtl " + m.name + "\n";
    mtl += "Kd " + c.r.toFixed(4) + " " + c.g.toFixed(4) + " " + c.b.toFixed(4) + "\n";
    mtl += "Ks 0.2000 0.2000 0.2000\n";
    mtl += "Ns " + Math.round((1 - rough) * 200) + "\n";
    mtl += "d " + opacity.toFixed(4) + "\n\n";
  }
  return { obj, mtl };
}

const targets = process.argv.slice(2);
if (!targets.length) throw new Error("사용법: node gen.mjs <html-basename> ...");

mkdirSync(OUT, { recursive: true });
for (const name of targets) {
  const html = readFileSync(join(SRC, name + ".html"), "utf8");
  const runPath = join(HERE, `run-${name}.mjs`);
  writeFileSync(runPath, PRELUDE + "\n" + extractModule(html), "utf8");

  globalThis.__captured = null;
  await import(pathToFileURL(runPath).href);
  const root = globalThis.__captured;
  if (!root) throw new Error(`${name}: stage.setObject(root)가 호출되지 않음`);

  let meshes = 0;
  root.traverse((o) => {
    if (o.isMesh) meshes += 1;
  });
  const { obj, mtl } = exportObjMtl(root, name);
  writeFileSync(join(OUT, name + ".obj"), obj, "utf8");
  writeFileSync(join(OUT, name + ".mtl"), mtl, "utf8");
  const mats = (mtl.match(/^newmtl /gm) || []).length;
  console.log(
    `${name}: root="${root.name}" meshes=${meshes} materials=${mats} obj=${(obj.length / 1024).toFixed(0)}KB`,
  );
}

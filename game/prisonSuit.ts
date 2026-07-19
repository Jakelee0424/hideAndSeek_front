// 캐릭터에 죄수복 줄무늬를 입힌다.
//
// ⚠️ 이 GLB(RobotExpressive)에는 **UV 좌표가 없다**(attrs가 NORMAL/POSITION뿐).
//    원래 색만 칠해진 모델이라 그렇다. 그래서 텍스처(map)를 씌우면 UV가 없어 한 점만
//    샘플링돼 단색으로 나온다. 대신 셰이더에서 정점 높이로 줄무늬를 계산한다.
//
// 좌표는 **스키닝 전 로컬 좌표**를 쓴다. 그래야 줄무늬가 옷처럼 몸에 붙어 같이 움직인다.
// 월드 좌표를 쓰면 캐릭터가 걸을 때 줄무늬 사이로 몸이 통과하는 것처럼 보인다.
//
// 세로줄은 **면이 향한 방향에 따라 기준 축을 골라** 나눈다(박스 투영).
//   - 앞뒤를 보는 면(법선이 z축) → x 좌표로 자른다
//   - 좌우를 보는 면(법선이 x축) → z 좌표로 자른다
// 이러면 어느 면에서 봐도 세로줄이다.
//
// 처음엔 세로축 기준 각도(atan)로 감았는데 **가운데로 몰려 부챗살처럼** 보였다. 각도로
// 나누면 경계가 "세로축을 품은 평면"이라, 원통이면 세로줄이지만 이 모델처럼 납작한 몸통에서는
// 중심에서 방사형으로 퍼진다. 단순히 x 좌표만 쓰는 것도 안 된다 — 옆면이 통째로 한 색이 된다.
import * as THREE from "three";

/**
 * 줄 촘촘함. 줄 하나의 폭 = 1/(2×이 값), 모델 단위 기준.
 * 4.0이면 폭 0.125로 몸통에 대략 6~8줄이 들어간다.
 */
const STRIPE_FREQ = 4.0;

const LIGHT = new THREE.Color("#d8d4c8"); // 바랜 흰색
const DARK = new THREE.Color("#23262e"); // 짙은 회청색

/** 줄무늬를 넣지 않을 부위. 머리·손은 맨살로 둬야 옷으로 읽힌다. */
const BARE = /^(Head|Hand)/;

let striped: THREE.Material | null = null;

/** 원본 Main 재질을 복제해 줄무늬 셰이더를 심는다. 인스턴스가 몇이든 하나만 만든다. */
function stripedMaterial(base: THREE.Material): THREE.Material {
  if (striped) return striped;

  const m = (base as THREE.MeshStandardMaterial).clone();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec2 vSuitXZ;\nvarying vec3 vSuitN;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vSuitXZ = position.xz;\n  vSuitN = normal;",
      );
    // diffuseColor(알베도) 단계에서 갈아끼운다. 조명 계산 전이라 음영이 자연스럽게 얹힌다.
    // gl_FragColor를 직접 건드리면 조명이 무시되고, WebGL2에서 변수명도 달라 깨지기 쉽다.
    shader.fragmentShader =
      "varying vec2 vSuitXZ;\nvarying vec3 vSuitN;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // 옆면(법선이 x쪽)은 z로, 앞뒤면은 x로 자른다 → 어느 면에서도 세로줄
        float suitAxis = abs(vSuitN.x) > abs(vSuitN.z) ? vSuitXZ.y : vSuitXZ.x;
        float suitBand = step(0.5, fract(suitAxis * ${STRIPE_FREQ.toFixed(1)}));
        diffuseColor.rgb = mix(
          vec3(${LIGHT.r.toFixed(3)}, ${LIGHT.g.toFixed(3)}, ${LIGHT.b.toFixed(3)}),
          vec3(${DARK.r.toFixed(3)}, ${DARK.g.toFixed(3)}, ${DARK.b.toFixed(3)}),
          suitBand);`,
      );
  };
  // 이게 없으면 three가 원본 Main과 같은 셰이더 프로그램을 재사용해 패치가 반영되지 않는다
  // (기본 캐시 키는 onBeforeCompile을 보지 않는다).
  m.customProgramCacheKey = () => "prison-suit";
  m.needsUpdate = true;

  striped = m;
  return m;
}

/**
 * 모델 트리를 훑어 몸통·팔·다리의 Main 재질을 줄무늬 재질로 바꾼다.
 * 머리·손과 Grey/Black 재질(발·눈)은 그대로 둔다.
 */
export function applyPrisonSuit(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;

    const mat = mesh.material as THREE.Material;
    if (mat.name !== "Main" || BARE.test(mesh.name)) return;

    mesh.material = stripedMaterial(mat);
  });
}

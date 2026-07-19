// 캐릭터에 죄수복 줄무늬를 입힌다.
//
// ⚠️ 이 GLB(RobotExpressive)에는 **UV 좌표가 없다**(attrs가 NORMAL/POSITION뿐).
//    원래 색만 칠해진 모델이라 그렇다. 그래서 텍스처(map)를 씌우면 UV가 없어 한 점만
//    샘플링돼 단색으로 나온다. 대신 셰이더에서 정점 높이로 줄무늬를 계산한다.
//
// 좌표는 **스키닝 전 로컬 좌표**를 쓴다. 그래야 줄무늬가 옷처럼 몸에 붙어 같이 움직인다.
// 월드 좌표를 쓰면 캐릭터가 걸을 때 줄무늬 사이로 몸이 통과하는 것처럼 보인다.
//
// 세로줄은 부위의 세로축을 중심으로 한 **각도**로 나눈다. x 좌표로 자르면 정면에서만 줄로
// 보이고 옆에서는 한 색으로 뭉개진다. 각도로 하면 원통을 감싸듯 돌아가 어느 방향에서 봐도
// 세로줄이고, 팔·다리는 각자의 로컬 축을 기준으로 감기므로 부위마다 자연스럽게 맞는다.
import * as THREE from "three";

/**
 * 부위를 한 바퀴 도는 동안 들어가는 줄 수(흰+검 한 쌍이 1). 정수여야 한다 —
 * atan은 ±π에서 끊기는데, 정수면 그 이음매가 줄 경계와 맞아 티가 안 난다.
 */
const STRIPE_COUNT = 8;

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
      "varying vec2 vSuitXZ;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vSuitXZ = position.xz;",
      );
    // diffuseColor(알베도) 단계에서 갈아끼운다. 조명 계산 전이라 음영이 자연스럽게 얹힌다.
    // gl_FragColor를 직접 건드리면 조명이 무시되고, WebGL2에서 변수명도 달라 깨지기 쉽다.
    shader.fragmentShader =
      "varying vec2 vSuitXZ;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float suitAngle = atan(vSuitXZ.y, vSuitXZ.x);          // -π..π
        float suitBand = step(0.5, fract(suitAngle * ${(STRIPE_COUNT / (2 * Math.PI)).toFixed(5)}));
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

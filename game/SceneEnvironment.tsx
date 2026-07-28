"use client";
// 환경맵(IBL). 화면에 아무것도 그리지 않고 scene.environment만 채운다.
//
// 왜 필요한가 — **금속은 반사할 것이 있어야 금속으로 보인다.** MeshStandardMaterial에서
// metalness가 높은 재질은 확산광(diffuse)을 거의 안 쓰고 주변을 비춘 반사로 색을 만드는데,
// 비출 환경이 없으면 그 자리가 그냥 검다. 지금까지 이 씬엔 환경맵이 없었고, 그래서
//   - 감방 창살(metalness 0.6)의 방 구분색(주황·노랑·초록·보라)이 거의 검게 죽었고
//   - 소품 금속(steel 0.4 · brass 0.4 · mirror 0.85)도 같은 이유로 탁했다
// 침대가 검게 나오던 문제를 예전엔 metalness를 낮춰 피했는데(prisonAssets의 경고 참고),
// 그건 증상 쪽을 깎은 것이고 원인은 이쪽이다. 이제 원본 metalness 그대로 제대로 보인다.
//
// ⚠️ 외부에서 HDR을 받지 않는다. drei의 <Environment preset>은 원격 CDN에서 HDR을 가져오는데,
//    발표 자리에서 네트워크에 의존하고 싶지 않다. three에 같이 들어 있는 RoomEnvironment를
//    PMREM으로 구워 쓴다 — 파일 추가 0, 오프라인에서 동작.
//
// ⚠️ 밝기는 environmentIntensity로 눌러 둔다. 1.0이면 한밤중 교도소가 스튜디오처럼 환해져
//    애써 잡은 밤 톤이 날아간다. 반사만 얹고 분위기는 건드리지 않는 선을 쓴다.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function SceneEnvironment({ intensity = 0.35 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);

    scene.environment = target.texture;
    scene.environmentIntensity = intensity;

    // 구운 뒤엔 원본 씬도 생성기도 들고 있을 이유가 없다(텍스처만 남기면 된다).
    room.dispose();
    pmrem.dispose();

    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene, intensity]);

  return null;
}

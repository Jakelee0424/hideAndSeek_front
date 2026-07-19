// 내 캐릭터의 현재 위치. LocalPlayer가 프레임마다 써 넣고, 근접 판정이 필요한 쪽이 읽는다.
//
// zustand로 두지 않는 이유: 매 프레임 바뀌는 값이라 스토어에 넣으면 구독자가 초당 60번
// 리렌더된다. 3D 트랜스폼을 스토어 밖에 두는 worldState와 같은 이유다.
export const localPos = { x: 0, y: 0, z: 0 };

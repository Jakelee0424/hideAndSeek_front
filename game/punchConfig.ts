// 펀치/넉백 상수.
//
// ⚠️ KNOCKBACK_SPEED / KNOCKBACK_TAU 는 백엔드 Room.java의 KNOCKBACK_* 와 이중 관리다.
//    맞은 사람 <b>본인</b>은 서버 스냅샷을 기다리지 않고 자기 예측 위치에 같은 넉백을 재현한다
//    (LocalPlayer). 서버와 이 두 값이 어긋나면 맞은 사람 화면만 서버와 벌어진다(러버밴딩).
//    제3자는 서버가 밀어낸 위치를 스냅샷 보간으로 볼 뿐이라 영향이 없다.
export const KNOCKBACK_SPEED = 5.0; // 넉백 초기 속도(m/s). 약하게 — 총 밀림 ≈ SPEED*TAU ≈ 0.6m
export const KNOCKBACK_TAU = 0.12; // 감쇠 시간상수(s). v *= exp(-dt/TAU)

// 아래 둘은 프론트 단독(연출·입력 억제용). 서버가 최종 판정을 하므로 값이 서버와 달라도
// 안전하다 — 다만 서버 쿨다운(600ms)보다 짧게 두면 무시될 펀치를 헛 보내게 된다.
export const PUNCH_COOLDOWN_MS = 600; // 클릭 연타 억제(서버 쿨다운과 맞춤)
export const PUNCH_ANIM_MS = 700; // 펀치 모션을 이 시간 동안 재생(RobotExpressive Punch 길이 근사)

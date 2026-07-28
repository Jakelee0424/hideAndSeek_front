// 배경음악(BGM). 효과음(sfx.ts)이 Web Audio 합성인 것과 달리 여기는 실제 음원 파일을 튼다 —
// 분위기를 만드는 곡은 합성으로 흉내 낼 수 있는 것이 아니라서.
//
// 트랙은 둘뿐이고 단계에 따라 갈린다:
//   main   — 로비부터 색출까지 한 판 내내 깔린다(대사·효과음이 위에 얹히므로 낮게)
//   ending — 결말 화면(ENDED). 한 판의 마지막 화면이라 앞의 곡을 밀어내고 전면에 선다
//
// ⚠️ 브라우저는 사용자 조작 전 재생을 막는다(autoplay 정책). play()가 거부되면 조용히
//    넘기고 첫 클릭·키 입력에서 다시 시도한다 — 소리 때문에 게임이 막히면 안 된다.
//    첫 화면(로비)은 로드 직후 조작이 없으므로 사실상 항상 이 경로를 탄다.
//
// ⚠️ HTMLAudioElement를 쓴다(AudioContext 아님). 긴 파일을 통째로 디코드해 메모리에
//    올릴 이유가 없고, 스트리밍·루프를 엘리먼트가 알아서 한다.

export type BgmTrack = "main" | "ending";

const SRC: Record<BgmTrack, string> = {
  main: "/audio/bgm-main.mp3",
  ending: "/audio/bgm-ending.mp3",
};

/** 트랙별 기준 볼륨. 메인은 채팅·효과음에 묻히지 않을 만큼만 깔고, 엔딩은 앞에 세운다. */
const VOLUME: Record<BgmTrack, number> = { main: 0.25, ending: 0.45 };

const FADE_MS = 1400; // 트랙 전환은 반드시 겹쳐서 넘긴다(뚝 끊기면 연출이 깨진다)
const STEP_MS = 50;

const els = new Map<BgmTrack, HTMLAudioElement>();
const fades = new Map<BgmTrack, ReturnType<typeof setInterval>>();

let current: BgmTrack | null = null;
let muted = false;
/**
 * 사용자가 정한 음량(0~1). 트랙별 기준 볼륨에 **곱한다** — 이래야 메인과 엔딩의 균형
 * (0.25 : 0.45)을 유지한 채 전체만 오르내린다. 슬라이더를 절대값으로 쓰면 그 균형이 깨진다.
 */
let userVolume = 1;
/** 자동재생이 막혀 조작을 기다리는 중인가. 리스너를 겹쳐 걸지 않으려는 플래그. */
let waitingForGesture = false;

function element(track: BgmTrack): HTMLAudioElement {
  let a = els.get(track);
  if (!a) {
    a = new Audio(SRC[track]);
    a.loop = true; // 엔딩도 반복한다 — 결말 화면은 사람이 나갈 때까지 머문다
    a.preload = "auto";
    a.volume = 0;
    els.set(track, a);
  }
  return a;
}

function targetVolume(track: BgmTrack): number {
  return muted ? 0 : VOLUME[track] * userVolume;
}

/** 진행 중인 페이드를 멈춘다(볼륨은 그 자리에 둔다). */
function cancelFade(track: BgmTrack): void {
  const running = fades.get(track);
  if (running) {
    clearInterval(running);
    fades.delete(track);
  }
}

/** 볼륨을 target까지 서서히 옮긴다. 같은 트랙의 이전 페이드는 취소된다. */
function fadeTo(track: BgmTrack, target: number, done?: () => void): void {
  const a = element(track);
  cancelFade(track);

  const from = a.volume;
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    const v = from + (target - from) * (i / steps);
    a.volume = Math.min(1, Math.max(0, v));
    if (i >= steps) {
      clearInterval(id);
      fades.delete(track);
      done?.();
    }
  }, STEP_MS);
  fades.set(track, id);
}

/** 자동재생이 막혔을 때, 첫 조작에서 현재 트랙을 다시 시도한다. */
function retryOnGesture(): void {
  if (waitingForGesture || typeof window === "undefined") return;
  waitingForGesture = true;
  const wake = () => {
    // once:true를 둘 다 걸면 하나만 소모되고 다른 하나가 남는다 — 직접 걷어낸다.
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
    waitingForGesture = false;
    if (current) start(current);
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
}

/** 재생을 걸고, 성공하면 기준 볼륨까지 페이드 인. 거부되면 조작을 기다린다. */
function start(track: BgmTrack): void {
  const a = element(track);
  void a
    .play()
    .then(() => fadeTo(track, targetVolume(track)))
    .catch(retryOnGesture);
}

/**
 * 이 트랙으로 넘어간다. 이미 그 트랙이면 아무것도 하지 않는다
 * (단계가 여러 번 갱신돼도 곡이 처음부터 다시 시작하지 않게).
 */
export function playBgm(track: BgmTrack): void {
  if (typeof window === "undefined" || current === track) return;

  const prev = current;
  current = track;

  if (prev) {
    fadeTo(prev, 0, () => {
      const a = els.get(prev);
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    });
  }
  start(track);
}

/**
 * 음소거 전환. 재생 자체는 계속 둔다 — 멈췄다 다시 틀면 자동재생 정책에 또 걸릴 수 있고,
 * 곡의 위치도 잃는다. 볼륨만 0으로 내린다.
 */
export function setBgmMuted(next: boolean): void {
  muted = next;
  if (current) fadeTo(current, targetVolume(current));
}

/**
 * 사용자 음량(0~1). 트랙 기준 볼륨에 곱해진다.
 *
 * ⚠️ 페이드를 쓰지 않고 즉시 반영한다 — 슬라이더를 끄는 동안 1.4초짜리 페이드가 걸리면
 *    손을 못 따라와 뚝뚝 끊겨 들린다. 진행 중인 페이드가 있으면 그 자리에서 멈추고 값을 잡는다.
 */
export function setBgmVolume(next: number): void {
  userVolume = Math.min(1, Math.max(0, next));
  if (!current) return;
  cancelFade(current);
  element(current).volume = targetVolume(current);
}

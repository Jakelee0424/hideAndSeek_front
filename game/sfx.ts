// 효과음. 오디오 파일 없이 Web Audio로 합성한다.
//
// 파일을 쓰지 않는 이유: 외부 음원은 상업·발표 이용 가능 여부를 따져야 하고, 번들과 경로
// 관리도 따라온다. 신호음 몇 개 수준이면 합성으로 충분하고 라이선스 문제가 원천적으로 없다.
//
// ⚠️ 브라우저는 사용자 조작 전에는 오디오를 막는다(autoplay 정책). AudioContext는 첫 클릭·키
//    입력에서 깨우고, 그 전 호출은 조용히 무시한다 — 소리 하나 때문에 게임이 막히면 안 된다.

let ctx: AudioContext | null = null;
let armed = false;

/** 첫 사용자 조작에서 오디오를 깨운다. 여러 번 불러도 한 번만 건다. */
function arm(): void {
  if (armed || typeof window === "undefined") return;
  armed = true;
  const wake = () => {
    ctx ??= new AudioContext();
    void ctx.resume();
  };
  window.addEventListener("pointerdown", wake, { once: true });
  window.addEventListener("keydown", wake, { once: true });
}

/** 준비된 컨텍스트. 아직 조작 전이면 null(= 소리 없이 넘어간다). */
function ready(): AudioContext | null {
  arm();
  return ctx && ctx.state === "running" ? ctx : null;
}

/**
 * 감쇠하는 톤 하나.
 * @param at    시작 시각(컨텍스트 기준 오프셋 초)
 * @param freq  주파수(Hz). to를 주면 그쪽으로 미끄러진다
 */
function tone(
  c: AudioContext,
  {
    at = 0,
    freq,
    to,
    dur = 0.15,
    gain = 0.15,
    type = "square" as OscillatorType,
  }: {
    at?: number;
    freq: number;
    to?: number;
    dur?: number;
    gain?: number;
    type?: OscillatorType;
  },
): void {
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  // 딸깍 소리를 막으려면 0에서 올렸다가 0으로 내려야 한다(끊으면 팝 노이즈가 난다).
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** 짧은 잡음. 금속 마찰·타격에 쓴다. */
function noise(
  c: AudioContext,
  { at = 0, dur = 0.12, gain = 0.12, cutoff = 2000 } = {},
): void {
  const t = c.currentTime + at;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames); // 뒤로 갈수록 잦아든다
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  const amp = c.createGain();
  amp.gain.value = gain;
  src.connect(lp).connect(amp).connect(c.destination);
  src.start(t);
}

/** 자물쇠가 풀렸다 — 금속 걸쇠가 벗겨지는 짧은 두 번. */
export function sfxUnlock(): void {
  const c = ready();
  if (!c) return;
  noise(c, { dur: 0.06, gain: 0.18, cutoff: 3500 });
  tone(c, { freq: 320, to: 180, dur: 0.1, gain: 0.12 });
  noise(c, { at: 0.09, dur: 0.09, gain: 0.14, cutoff: 2200 });
  tone(c, { at: 0.09, freq: 180, to: 90, dur: 0.16, gain: 0.14, type: "triangle" });
}

/** 감방문이 열렸다 — 낮게 끌리는 삐걱임. */
export function sfxDoor(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 140, to: 70, dur: 0.55, gain: 0.1, type: "sawtooth" });
  noise(c, { dur: 0.5, gain: 0.06, cutoff: 900 });
}

/** 탈옥 성공 — 올라가는 3화음. */
export function sfxEscape(): void {
  const c = ready();
  if (!c) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(c, { at: i * 0.12, freq: f, dur: 0.3, gain: 0.13, type: "triangle" }),
  );
}

/** 미니게임 클리어 — 짧게 올라가는 두 음. 자물쇠 해제음(sfxUnlock)과 겹치지 않게 가볍게. */
export function sfxClear(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 660, dur: 0.1, gain: 0.12, type: "square" });
  tone(c, { at: 0.09, freq: 990, dur: 0.18, gain: 0.12, type: "square" });
}

/** 미니게임 실패 — 내려앉는 부저. */
export function sfxGameOver(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 220, to: 80, dur: 0.42, gain: 0.13, type: "sawtooth" });
}

/** 농구 골인 — 그물 스치는 짧은 쉭. */
export function sfxSwish(): void {
  const c = ready();
  if (!c) return;
  noise(c, { dur: 0.22, gain: 0.1, cutoff: 6000 });
  tone(c, { freq: 880, to: 1320, dur: 0.18, gain: 0.08, type: "sine" });
}

/** 공이 바닥에 튈 때 — 둔탁한 통. */
export function sfxThud(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 150, to: 60, dur: 0.14, gain: 0.11, type: "sine" });
  noise(c, { dur: 0.05, gain: 0.05, cutoff: 500 });
}

/** 재수감 — 두 음을 오가는 사이렌 두 바퀴. */
export function sfxSiren(): void {
  const c = ready();
  if (!c) return;
  for (let i = 0; i < 4; i++) {
    tone(c, {
      at: i * 0.45,
      freq: i % 2 === 0 ? 620 : 880,
      to: i % 2 === 0 ? 880 : 620,
      dur: 0.42,
      gain: 0.11,
      type: "sawtooth",
    });
  }
}

/** 자정의 종 — 낮게 오래 끌리는 타종 세 번. */
export function sfxBell(): void {
  const c = ready();
  if (!c) return;
  for (let i = 0; i < 3; i++) {
    const at = i * 1.15;
    tone(c, { at, freq: 196, dur: 1.6, gain: 0.15, type: "sine" });
    tone(c, { at, freq: 293.7, dur: 1.2, gain: 0.07, type: "sine" }); // 배음
    noise(c, { at, dur: 0.12, gain: 0.05, cutoff: 1400 }); // 때리는 순간
  }
}

/** 완전한 탈출 — 새벽이 밝아오는 느린 상승. */
export function sfxDawn(): void {
  const c = ready();
  if (!c) return;
  [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) =>
    tone(c, { at: i * 0.28, freq: f, dur: 1.1, gain: 0.1, type: "triangle" }),
  );
}

/** 펀치 — 짧게 스치는 바람 소리 + 낮은 툭(약한 타격감). */
export function sfxPunch(): void {
  const c = ready();
  if (!c) return;
  noise(c, { dur: 0.09, gain: 0.09, cutoff: 1400 }); // 휘두르는 바람
  tone(c, { freq: 200, to: 90, dur: 0.1, gain: 0.1, type: "sine" }); // 맞는 툭
}

/** AI 정체 공개 — 무겁게 내려꽂는 한 방. */
export function sfxReveal(): void {
  const c = ready();
  if (!c) return;
  tone(c, { freq: 440, to: 110, dur: 0.7, gain: 0.16, type: "sawtooth" });
  noise(c, { at: 0.02, dur: 0.3, gain: 0.1, cutoff: 700 });
}

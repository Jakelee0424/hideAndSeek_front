// 소리 설정(zustand). BGM 음소거·음량. 화면 두 곳(로비·게임 HUD)에서 같은 상태를 보여 주고
// 눌러야 해서 전역으로 둔다.
//
// ⚠️ 저장된 값을 모듈 로드 시점에 읽지 않는다. 서버에서 렌더할 땐 localStorage가 없어
//    항상 기본값이 되고, 클라가 다른 값으로 시작하면 하이드레이션 불일치가 난다.
//    복원은 마운트 뒤(restore)에만 한다.
import { create } from "zustand";
import { setBgmMuted, setBgmVolume } from "@/game/bgm";

const MUTED_KEY = "hs.bgm.muted";
const VOLUME_KEY = "hs.bgm.volume";

const DEFAULT_VOLUME = 1;

interface SoundStore {
  muted: boolean;
  /** 사용자 음량 배율 0~1. 트랙별 기준 볼륨에 곱해진다(game/bgm.ts). */
  volume: number;
  setMuted: (muted: boolean) => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  /** 저장된 설정 반영. useEffect 안에서만 부를 것. */
  restore: () => void;
}

function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 사생활 보호 모드 등에서 막힐 수 있다. 이번 판만 적용되고 끝이면 충분하다.
  }
}

export const useSoundStore = create<SoundStore>((set, get) => ({
  muted: false,
  volume: DEFAULT_VOLUME,

  setMuted: (muted) => {
    set({ muted });
    setBgmMuted(muted);
    save(MUTED_KEY, muted ? "1" : "0");
  },

  toggle: () => get().setMuted(!get().muted),

  setVolume: (raw) => {
    const volume = Math.min(1, Math.max(0, raw));
    set({ volume });
    setBgmVolume(volume);
    save(VOLUME_KEY, String(volume));

    // 음소거 상태에서 음량을 올리면 소리를 원한다는 뜻이다 — 같이 풀어 준다.
    // (안 풀면 슬라이더를 끝까지 올려도 조용해서 고장으로 보인다.)
    if (volume > 0 && get().muted) get().setMuted(false);
  },

  restore: () => {
    let muted = false;
    let volume = DEFAULT_VOLUME;
    try {
      muted = localStorage.getItem(MUTED_KEY) === "1";
      const saved = Number(localStorage.getItem(VOLUME_KEY));
      // 저장된 적이 없으면 NaN이다 — 그때는 기본값을 쓴다.
      if (Number.isFinite(saved)) volume = Math.min(1, Math.max(0, saved));
    } catch {
      return;
    }
    set({ muted, volume });
    setBgmVolume(volume);
    setBgmMuted(muted);
  },
}));

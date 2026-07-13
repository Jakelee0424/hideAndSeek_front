// 프레임마다 바뀌는 원격 플레이어의 "목표 트랜스폼"을 담는 가변 버퍼(싱글턴).
// React state가 아니라 여기에 둔다 → 스냅샷 수신(20Hz)마다 리렌더가 발생하지 않음.
// 플레이어 컴포넌트는 useFrame에서 이 버퍼를 읽어 보간(lerp/slerp)한다.
import type { PlayerState, WorldSnapshot } from "./types";

interface Entry {
  target: PlayerState;
}

const entries = new Map<string, Entry>();

export const worldState = {
  /** 서버 스냅샷을 목표값으로 반영. 사라진 플레이어는 제거. */
  apply(snap: WorldSnapshot): void {
    const seen = new Set<string>();
    for (const p of snap.players) {
      seen.add(p.id);
      const e = entries.get(p.id);
      if (e) e.target = p;
      else entries.set(p.id, { target: p });
    }
    for (const id of [...entries.keys()]) {
      if (!seen.has(id)) entries.delete(id);
    }
  },

  get(id: string): Entry | undefined {
    return entries.get(id);
  },

  clear(): void {
    entries.clear();
  },
};

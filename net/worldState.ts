// 원격 플레이어 스냅샷 보간 버퍼(싱글턴).
//   서버 스냅샷(20Hz)을 "수신 시각"과 함께 플레이어별 버퍼에 쌓고,
//   렌더 시점을 INTERP_DELAY_MS 만큼 과거로 잡아 그 시점을 감싸는
//   두 스냅샷 사이를 선형 보간해 재생한다(Gabriel Gambetta 스냅샷 보간).
//   → 최신 목표를 매 프레임 쫓는 "추격형 lerp"와 달리 상시 지연/러버밴딩이 없다.
//   React state가 아니라 여기에 둔다 → 스냅샷 수신마다 리렌더가 발생하지 않음.
//   시계 동기화 불필요: apply/sample 모두 같은 performance.now() 타임베이스를 쓴다.
import type { WorldSnapshot } from "./types";

/** 렌더를 과거로 미루는 양(ms). 스냅샷 간격(50ms)의 약 2배 → 지터·1프레임 유실에 견딤. */
export const INTERP_DELAY_MS = 100;
/** 버퍼 보관 상한(ms). 이보다 오래된 샘플은 버린다(항상 최소 2개는 유지). */
const MAX_BUFFER_MS = 1000;

interface Sample {
  t: number; // 수신 시각(performance.now())
  x: number;
  z: number;
  rot: number;
  y: number; // 지면 위 높이(점프). 착지 상태면 0
}

export interface Transform {
  x: number;
  z: number;
  rotationY: number;
  /** 지면 위 높이(m). 그대로 position.y에 넣으면 된다. */
  y: number;
}

const buffers = new Map<string, Sample[]>();

export const worldState = {
  /** 서버 스냅샷의 tick 상태를 수신 시각과 함께 버퍼에 반영. 사라진 플레이어 버퍼는 제거. */
  apply(snap: WorldSnapshot): void {
    const t = performance.now();
    const seen = new Set<string>();
    for (const p of snap.states) {
      seen.add(p.id);
      let buf = buffers.get(p.id);
      if (!buf) {
        buf = [];
        buffers.set(p.id, buf);
      }
      // y는 점프 도입 전 스냅샷/옛 서버엔 없다 → 없으면 착지(0)로 본다.
      buf.push({ t, x: p.x, z: p.z, rot: p.rot, y: p.y ?? 0 });
      // 오래된 샘플 정리(최소 2개는 남겨 보간/고정에 쓸 수 있게).
      const cutoff = t - MAX_BUFFER_MS;
      while (buf.length > 2 && buf[0].t < cutoff) buf.shift();
    }
    for (const id of [...buffers.keys()]) {
      if (!seen.has(id)) buffers.delete(id);
    }
  },

  /**
   * renderTime(과거 시점)의 보간 트랜스폼. 버퍼가 없으면 null.
   *   - renderTime이 가장 오래된 샘플보다 과거 → 첫 샘플로 고정
   *   - renderTime이 최신 샘플보다 미래(유실/지연) → 최신 샘플로 고정(외삽 안 함)
   *   - 그 사이 → 감싸는 두 샘플 선형 보간
   */
  sample(id: string, renderTime: number): Transform | null {
    const buf = buffers.get(id);
    if (!buf || buf.length === 0) return null;

    const first = buf[0];
    if (renderTime <= first.t) {
      return { x: first.x, z: first.z, rotationY: first.rot, y: first.y };
    }
    const last = buf[buf.length - 1];
    if (renderTime >= last.t) {
      return { x: last.x, z: last.z, rotationY: last.rot, y: last.y };
    }
    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i];
      const b = buf[i + 1];
      if (renderTime >= a.t && renderTime <= b.t) {
        const span = b.t - a.t;
        const alpha = span > 0 ? (renderTime - a.t) / span : 0;
        return {
          x: a.x + (b.x - a.x) * alpha,
          z: a.z + (b.z - a.z) * alpha,
          rotationY: lerpAngle(a.rot, b.rot, alpha),
          y: a.y + (b.y - a.y) * alpha,
        };
      }
    }
    return { x: last.x, z: last.z, rotationY: last.rot, y: last.y };
  },

  clear(): void {
    buffers.clear();
  },
};

/** 최단 경로 각도 보간(래핑 처리). */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

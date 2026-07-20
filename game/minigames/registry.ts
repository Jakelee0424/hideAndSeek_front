// 미니게임 등록소.
//
// 게임을 추가하려면 파일을 하나 만들고 아래 POOL에 def를 넣으면 끝이다. 자물쇠는 "미니게임"
// 이라고만 선언하고 어떤 게임인지는 모르므로, 풀이 커지면 그중 임의의 몇 개가 뽑힌다.
//
// 배정은 방 코드로 시드를 고정한다 — 같은 방 사람들은 같은 감방에서 같은 게임을 본다.
// (안 그러면 "나는 테트리스였는데?" 같은 대화가 어긋난다. 새 방에 들어가면 다시 섞인다.)
import { breakoutDef } from "./breakout";
import { flappyDef } from "./flappy";
import { rhythmDef } from "./rhythm";
import { shooterDef } from "./shooter";
import { snakeDef } from "./snake";
import { tetrisDef } from "./tetris";
import { whackDef } from "./whack";
import type { MinigameDef } from "./types";

// 감방은 넷, 게임은 이보다 많다 → 방마다 그중 넷이 뽑힌다.
export const POOL: MinigameDef[] = [
  tetrisDef,
  shooterDef,
  snakeDef,
  breakoutDef,
  flappyDef,
  rhythmDef,
  whackDef,
];

/** 문자열 → 32bit 정수(FNV-1a). 시드를 재현 가능한 난수로 바꾸는 데만 쓴다. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 시드를 받아 0~1을 내놓는 선형합동 난수. Math.random과 달리 같은 시드면 같은 수열이다. */
function rng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// seed → (자물쇠 id → 게임). 같은 방에서 매번 다시 섞지 않도록 캐시한다.
const cache = new Map<string, Record<string, MinigameDef>>();

/**
 * 자물쇠들에 게임을 하나씩 나눠 준다.
 * 풀을 섞은 뒤 순서대로 집으므로, 게임 수가 자물쇠 수 이상이면 서로 겹치지 않는다.
 * 풀이 더 적으면 한 바퀴 돌아 다시 쓴다(겹쳐도 게임이 성립은 한다).
 */
export function assignMinigames(
  seed: string,
  lockIds: readonly string[],
): Record<string, MinigameDef> {
  const key = `${seed}|${lockIds.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rand = rng(hash(key));
  const shuffled = [...POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const out: Record<string, MinigameDef> = {};
  lockIds.forEach((id, i) => {
    out[id] = shuffled[i % shuffled.length];
  });
  cache.set(key, out);
  return out;
}

// 전역 세션/룸 상태(zustand). 3D 트랜스폼은 여기에 두지 않는다(worldState 참고).
// playerIds는 입/퇴장 시에만 바뀌므로, 이 값으로 원격 플레이어 리스트만 리렌더된다.
import { create } from "zustand";
import type {
  ConnStatus,
  GamePhase,
  RosterEntry,
  VoteEntry,
} from "@/net/types";

interface GameStore {
  status: ConnStatus;
  roomId: string;
  myId: string | null;
  myNick: string;
  ready: boolean;
  playerIds: string[];
  nicks: Record<string, string>;
  /** AI 봇인 플레이어 id 집합. 방장 선출처럼 사람만 대상이어야 하는 판단에 쓴다. */
  bots: Record<string, boolean>;
  /** 현재 진행 단계. 서버는 전환 시에만 보내주므로 여기 눌러둔다. */
  phase: GamePhase | null;
  /** 현재 단계가 끝나는 시각(Date.now 기준). 카운트다운은 이 값으로 로컬 계산한다. */
  phaseEndsAt: number | null;
  /** 현재 단계가 시작된 시각(Date.now 기준). 전환 배너를 얼마나 띄울지 계산하는 데 쓴다. */
  phaseStartedAt: number | null;
  /** 소음 게이지(0~100). 걸을 땐 0, 달리면 오른다. LocalPlayer가 프레임 루프에서 갱신한다. */
  noise: number;
  /** 로스터에 실려온 순서 = 입장 순서(서버가 보장). 방장은 이 중 첫 번째. */
  rosterOrder: string[];
  /** AI 지목 현황(투표자 id → 지목 대상 id). */
  votes: Record<string, string>;
  /** 진짜 AI의 id. 결말(ENDED) 전까지 서버가 알려주지 않으므로 null이다. */
  aiId: string | null;

  setStatus: (s: ConnStatus) => void;
  setReady: (v: boolean) => void;
  /** 서버가 단계를 실어 보낼 때만 호출. 남은 시간을 로컬 종료 시각으로 환산해 둔다. */
  setPhase: (phase: GamePhase, remainMs: number) => void;
  /** 방 입장 시 초기화 + 본인을 목록에 시드(서버 스냅샷 오기 전까지 표시). */
  reset: (roomId: string, myId: string, nick: string) => void;
  clear: () => void;
  /** tick 상태의 플레이어 id 목록을 반영(입·퇴장 감지). 목록이 실제로 바뀔 때만 갱신. */
  syncPlayers: (ids: string[]) => void;
  /** 로스터(닉네임)를 병합. 서버가 로스터를 실어 보낼 때만 호출된다. */
  applyRoster: (roster: RosterEntry[]) => void;
  /** 소음 게이지 갱신. 실제 값이 바뀔 때만 set 해서 매 프레임 리렌더를 피한다. */
  setNoise: (v: number) => void;
  /** 서버가 실어 보낸 투표 현황을 반영. 바뀔 때만 갱신. */
  applyVotes: (votes: VoteEntry[]) => void;
  /** 결말에 공개되는 진짜 AI id. */
  setAiId: (id: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  status: "idle",
  roomId: "lobby",
  myId: null,
  myNick: "",
  ready: false,
  playerIds: [],
  nicks: {},
  bots: {},
  phase: null,
  phaseEndsAt: null,
  phaseStartedAt: null,
  noise: 0,
  rosterOrder: [],
  votes: {},
  aiId: null,

  setStatus: (status) => set({ status }),
  setReady: (ready) => set({ ready }),

  setPhase: (phase, remainMs) => {
    if (get().phase === phase) return; // 입장 시 재전송 등 같은 단계면 무시(리렌더 방지)
    const now = Date.now();
    set({ phase, phaseEndsAt: now + remainMs, phaseStartedAt: now });
  },

  reset: (roomId, myId, nick) =>
    set({
      roomId,
      myId,
      myNick: nick,
      ready: false,
      status: "connecting",
      playerIds: [myId],
      nicks: { [myId]: nick },
      bots: {},
      phase: null,
      phaseEndsAt: null,
      phaseStartedAt: null,
      noise: 0,
      rosterOrder: [myId],
      votes: {},
      aiId: null,
    }),

  clear: () =>
    set({
      status: "idle",
      playerIds: [],
      nicks: {},
      bots: {},
      ready: false,
      phase: null,
      phaseEndsAt: null,
      phaseStartedAt: null,
      noise: 0,
      rosterOrder: [],
      votes: {},
      aiId: null,
    }),

  syncPlayers: (ids) => {
    const prev = get().playerIds;
    const same =
      prev.length === ids.length && prev.every((id, i) => id === ids[i]);
    if (same) return; // 리렌더 방지
    set({ playerIds: ids });
  },

  applyRoster: (roster) => {
    const { nicks, bots } = get();
    const nextNicks = { ...nicks };
    const nextBots = { ...bots };
    let changed = false;
    for (const r of roster) {
      if (nextNicks[r.id] !== r.nick) {
        nextNicks[r.id] = r.nick;
        changed = true;
      }
      if (nextBots[r.id] !== r.bot) {
        nextBots[r.id] = r.bot;
        changed = true;
      }
    }
    // 로스터가 실려온 순서가 곧 입장 순서다(서버가 그렇게 담아 보낸다).
    const order = roster.map((r) => r.id);
    const sameOrder =
      get().rosterOrder.length === order.length &&
      get().rosterOrder.every((id, i) => id === order[i]);
    if (changed || !sameOrder) {
      set({
        nicks: nextNicks,
        bots: nextBots,
        ...(sameOrder ? {} : { rosterOrder: order }),
      });
    }
  },

  applyVotes: (entries) => {
    const next: Record<string, string> = {};
    for (const v of entries) next[v.voterId] = v.targetId;
    const cur = get().votes;
    const curKeys = Object.keys(cur);
    const same =
      curKeys.length === entries.length &&
      curKeys.every((k) => cur[k] === next[k]);
    if (same) return; // 리렌더 방지
    set({ votes: next });
  },

  setAiId: (id) => {
    if (get().aiId === id) return;
    set({ aiId: id });
  },

  setNoise: (v) => {
    if (get().noise === v) return; // 같은 값이면 리렌더 안 함
    set({ noise: v });
  },
}));

// 짧은 안내 토스트 한 줄. 지금은 "그건 다른 사람이 먼저 풀었다" 하나지만, 같은 성격의
// 알림(협동 중 남의 행동 때문에 내 화면이 바뀌는 경우)이 더 생기면 여기에 얹는다.
//
// zustand인 이유: net/의 punches·reimprison 버스는 매 프레임 폴링해 쓰는 연출용이라
// 리렌더가 나면 안 되지만, 이건 화면에 글자를 띄우는 것이라 리렌더가 목적이다.
import { create } from "zustand";

interface NoticeStore {
  text: string | null;
  /** 같은 문구가 연달아 떠도 등장 애니메이션이 다시 돌게 하는 일련번호. */
  seq: number;
  show: (text: string) => void;
  clear: () => void;
}

export const useNotice = create<NoticeStore>((set) => ({
  text: null,
  seq: 0,
  show: (text) => set((s) => ({ text, seq: s.seq + 1 })),
  clear: () => set({ text: null }),
}));

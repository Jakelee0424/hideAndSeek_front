// 표식 발견 말풍선(3D 앵커) 상태. 표식 퀴즈가 풀리는 순간 net/session이 show()를 부르고,
// 게임 씬의 StampCallouts가 그 퀴즈 아이템(작업도구함·냉장고 잠금장치…) 머리 위에
// 몇 초간 깜빡이는 말풍선을 띄운 뒤 expire()로 지운다.
//
// zustand인 이유: 말풍선은 리렌더가 목적인 UI다(noticeStore와 같은 성격).
import { create } from "zustand";

interface StampNoticeStore {
  /** 지금 떠 있는 말풍선: 표식 퀴즈 id → 띄운 시각(Date.now). */
  active: Record<string, number>;
  show: (quizId: string) => void;
  expire: (quizId: string) => void;
}

export const useStampNotice = create<StampNoticeStore>((set) => ({
  active: {},
  show: (quizId) =>
    set((s) => ({ active: { ...s.active, [quizId]: Date.now() } })),
  expire: (quizId) =>
    set((s) => {
      if (!(quizId in s.active)) return s;
      const next = { ...s.active };
      delete next[quizId];
      return { active: next };
    }),
}));

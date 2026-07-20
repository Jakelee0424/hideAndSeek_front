// 엔딩 정의 — 한 판의 결말은 두 축의 조합으로 갈린다.
//
//   탈출했는가(배수관 철문을 열었는가) × AI를 지목해 냈는가(최다 득표 = 진짜 AI인가)
//
//        │ AI 지목 성공        │ AI 지목 실패
//   ─────┼────────────────────┼──────────────────
//   탈출 O│ ① 완전한 탈출       │ ② 재수감
//   탈출 X│ ③ 절반의 진실       │ ④ 최악의 밤
//
// 문구는 기획에서 받은 내레이션을 그대로 쓴다. 손대지 말 것 — 톤이 이 게임의 마무리다.

export type EndingKey = "perfect" | "recaptured" | "partial" | "worst";

export interface Ending {
  key: EndingKey;
  /** 큰 제목. */
  title: string;
  /** 제목 위 작은 영문 라벨. */
  kicker: string;
  /** 한 줄씩 차례로 떠오르는 내레이션. */
  lines: string[];
  /** 제목·강조에 쓰는 색(tailwind 클래스). */
  accent: string;
}

const ENDINGS: Record<EndingKey, Ending> = {
  perfect: {
    key: "perfect",
    kicker: "TRUE ESCAPE",
    title: "완전한 탈출",
    accent: "text-amber-300",
    lines: [
      "배수관 너머로 바깥세상이 보였다.",
      "차가운 새벽 공기가 얼굴에 닿는 순간, 당신들은 비로소 서로의 진짜 얼굴을 마주한다.",
      "가면을 쓴 자는 이제 없다. 당신들은, 정말로 함께 해냈다.",
    ],
  },
  recaptured: {
    key: "recaptured",
    kicker: "RECAPTURED",
    title: "재수감",
    accent: "text-rose-400",
    lines: [
      "문이 열렸다고 생각한 순간, 사이렌이 울린다.",
      "당신들은 결국 끝까지 비밀을 모른 채, 다시 끌려들어갔다.",
    ],
  },
  partial: {
    key: "partial",
    kicker: "HALF TRUTH",
    title: "절반의 진실",
    accent: "text-sky-300",
    lines: [
      "자정의 종이 울린다. 문은 끝내 열리지 않았다.",
      "다음의 기회가 있다면, 당신은 이번엔 탈출할 수 있을까?",
      "하지만 또다시 어떤 자가 숨어있을지. 아직 아무도 모른다.",
    ],
  },
  worst: {
    key: "worst",
    kicker: "WORST NIGHT",
    title: "최악의 밤",
    accent: "text-rose-500",
    lines: [
      "자정의 종이 울린다. 문도, 진실도 끝내 열리지 않았다.",
      "당신들은 이제 곧 추가 형량을 받고 이감될 죄수들에 불과하다.",
    ],
  },
};

/** 탈출·지목 성패로 결말을 고른다. */
export function resolveEnding(escaped: boolean, caught: boolean): Ending {
  if (escaped) return caught ? ENDINGS.perfect : ENDINGS.recaptured;
  return caught ? ENDINGS.partial : ENDINGS.worst;
}

"use client";
// 진행 방법 도움말(좌상단, 물음표 아이콘 / H). 처음 들어온 사람이 "이제 뭘 하지"에서 막히지
// 않게 하는 게 목적이다 — 이야기(StoryPanel)가 분위기를 준다면 이쪽은 순서를 준다.
//
// ⚠️ **정문 함정은 일부러 밝히지 않는다.** 정문을 열어 보는 것 자체가 설계된 경험이고(gate-lock
//    solve가 곧 함정 발동 신호다), 미리 알려 주면 그 반전이 통째로 사라진다. "장담할 수 없다"
//    까지만 적는다.
// ⚠️ 퍼즐의 답이나 푸는 요령은 적지 않는다 — 그건 각 오브젝트의 hint가 할 일이다.
// ⚠️ 규칙을 바꾸면 여기도 같이 볼 것(표식 4개·최종 탈출구·순찰 벌칙은 서버와 물려 있다).
import HudPanel from "./HudPanel";

export const HELP_ID = "help";

const STEPS: { title: string; body: string }[] = [
  {
    title: "감방을 나간다",
    body: "감방 자물쇠는 아케이드 게임이다. E로 붙잡고 한 판 이기면 그 방 문이 열린다.",
  },
  {
    title: "별관 방 넷을 연다",
    body: "복도의 방 자물쇠를 풀면 문이 열린다. 푸는 데 필요한 단서는 복도 게시물·화장실·연병장 쪽지에 흩어져 있다.",
  },
  {
    title: "방 안에서 표식을 얻는다",
    body: "식당·작업장·의무실·세탁실 안에 각각 문제가 하나씩 더 있다. 풀면 표식이 하나 나온다 — 넷을 다 모아야 한다.",
  },
  {
    title: "배수관으로 간다",
    body: "표식 넷이 모이면 동쪽 샛길 철창이 열린다. 그 너머 배수관 잠금장치가 진짜 마지막 문이다.",
  },
  {
    title: "자정 전에 나간다",
    body: "정문도 열리기는 한다. 다만 그게 나가는 길인지는 장담할 수 없다.",
  },
];

const RULES: string[] = [
  "간수가 복도를 돈다. 순찰 중 시야 안에서 움직이거나 무언가를 건드리면 들킨다 — 막아 주지 않으니 멈추는 건 각자 몫이고, 들키면 자정이 앞당겨진다.",
  "단서는 흩어져 있고 방은 나눠 열게 되어 있다. 감정표현(1~4)으로 서로 신호를 주고받아라.",
  "혼자 오래 갇혀 있으면 잠시 뒤 남이 대신 열어 줄 수 있게 풀린다. 창살 너머로 동료의 자물쇠를 풀어 줘라.",
  "자정이 오면 그때까지의 결과로 끝난다. 그리고 마지막에 한 번 더 — 함께 있던 이들 중 누가 사람이 아니었는지 지목한다.",
];

const KEYS: { k: string; d: string }[] = [
  { k: "W A S D", d: "이동" },
  { k: "R", d: "달리기" },
  { k: "Space", d: "점프" },
  { k: "E", d: "상호작용" },
  { k: "M", d: "지도" },
  { k: "B", d: "이야기" },
  { k: "H", d: "도움말" },
  { k: "1~4", d: "감정표현" },
  { k: "휠", d: "시점 거리" },
  { k: "Esc", d: "마우스 커서" },
];

export default function HelpPanel() {
  return (
    <HudPanel id={HELP_ID} hotkeyCode="KeyH" hotkeyLabel="H" title="진행 방법" icon={<HelpIcon />}>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 font-mono text-[11px] text-amber-200">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed">
              <span className="font-semibold text-slate-100">{s.title}</span>
              <span className="text-slate-400"> — {s.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-2 text-[11px] font-semibold text-slate-400">알아 둘 것</div>
        <ul className="flex flex-col gap-2">
          {RULES.map((r, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-400">
              <span className="text-slate-600">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="mb-2 text-[11px] font-semibold text-slate-400">조작</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
          {KEYS.map((k) => (
            <span key={k.k} className="inline-flex items-center gap-1.5">
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-slate-200">{k.k}</kbd>
              {k.d}
            </span>
          ))}
        </div>
      </div>
    </HudPanel>
  );
}

function HelpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" />
      <path d="M9.4 9.2a2.7 2.7 0 1 1 3.4 2.6c-.6.2-.9.7-.9 1.3v.6" />
      <path d="M12 17.1h.01" />
    </svg>
  );
}

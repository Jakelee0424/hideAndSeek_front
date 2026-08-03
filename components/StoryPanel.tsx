"use client";
// 도입 이야기를 **보고 싶은 사람만** 여는 패널(좌상단 죄수번호 칸 아래, 책 아이콘 / B).
//
// 예전엔 PLAY에 들어서면 60초짜리 자막이 자동으로 흘렀다(OnboardingOverlay). 읽고 싶지 않은
// 사람에게는 한 판의 첫 1분을 덮는 방해였고, 정작 읽고 싶은 사람은 한 번 흘려보내면 다시 볼
// 방법이 없었다. 이제 아무 때나 열고 닫는다.
//
// ⚠️ 서버 game.phases.intro(도입 여백)는 그대로 둔다. 자막이 사라져도 그 창은 여전히
//    "게임 시작 직후엔 순찰을 돌리지 않는다"는 유예로 쓰인다(순찰 창 = intro + LEAD ~ play - TAIL).
import { useMemo } from "react";
import { cafeteriaPlan, DAYS } from "@/game/cafeteriaPlan";
import { useGameStore } from "@/store/gameStore";
import HudPanel from "./HudPanel";

/** 상호작용 오브젝트가 아닌 예약 id. */
export const STORY_ID = "story";

interface Line {
  text: string;
  boldLen?: number; // 줄 앞 몇 글자를 볼드 강조
  final?: boolean; // 마지막 한 방(호박색)
}

// ⚠️ 텍스트는 정본 나레이션이다 — 손대지 말 것(엔딩이 "자정"·"가면을 쓴 자"라는 말을 여기에 기댄다).
// ⚠️ 탈출구의 생김새(정문/배수관)는 말하지 않는다 — 맵이 바뀌면 여기부터 어긋난다.
// day: 오늘 요일(식당 배식 순서표 퍼즐용). 방 시드로 정해져 방마다 다르다.
function buildLines(day: string): Line[] {
  return [
    { text: "소등. 복도의 불이 하나씩 꺼진다.", boldLen: 3 },
    { text: "자정까지 시간이 있다. 감방을 나가라 — 자물쇠엔 압수된 게임기가 박혀 있다." },
    { text: `오늘은 ${day}. 식당 배식 순서는 요일마다 다르다 — 문 앞 순서표에서 오늘 줄을 찾아라.` },
    { text: "별관 방마다 문제가 걸려 있다. 풀면 벽에 표식이 드러난다." },
    { text: "마지막 문은 거짓말쟁이들의 말로 잠겨 있다. 누가 참인지 가려, 표식을 제 자리에 놓아라." },
    { text: "밤사이 간수가 한두 번 복도를 돈다. 순찰이 도는 동안 움직이거나 무언가를 건드리면 들킨다." },
    { text: "막아 주지 않는다. 멈추는 건 네 몫이고, 들키면 자정이 그만큼 앞당겨진다." },
    { text: "그리고 — 오늘 밤 이 안에는, 사람이 아닌 것이 하나 섞여 있다.", final: true },
  ];
}

export default function StoryPanel() {
  const roomId = useGameStore((s) => s.roomId);
  // 오늘 요일은 방 시드로 정해진다 — 이야기와 식당 순서표(cafeteriaPlan)가 같은 값을 본다.
  const lines = useMemo(() => buildLines(DAYS[cafeteriaPlan(roomId).today]), [roomId]);

  return (
    <HudPanel id={STORY_ID} hotkeyCode="KeyB" hotkeyLabel="B" title="오늘 밤" icon={<BookIcon />}>
      <div className="flex flex-col gap-3">
        {lines.map((l, i) => (
          <p
            key={i}
            className={`text-sm leading-relaxed ${l.final ? "text-amber-200" : "text-slate-300"}`}
          >
            {l.boldLen ? (
              <>
                <span className="font-semibold text-slate-100">{l.text.slice(0, l.boldLen)}</span>
                {l.text.slice(l.boldLen)}
              </>
            ) : (
              l.text
            )}
          </p>
        ))}
      </div>
    </HudPanel>
  );
}

function BookIcon() {
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
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
    </svg>
  );
}

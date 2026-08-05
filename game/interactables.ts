// 맵에 배치된 상호작용 오브젝트 정의 + 근접/퍼즐 상태(zustand).
//
// 방탈출 구조: 감방(A~D)마다 "미션 자물쇠(lockbox)" 하나를 둔다. 감방 자물쇠는
// 아케이드 미니게임(테트리스·슈터·스네이크·벽돌깨기…)이고, 한 판을 깨면 그 방의
// 감방문(cell-X)이 열린다. 어느 방에 어느 게임이 걸리는지는 방 코드로 정해진다
// (minigameFor 참고) — 같은 방 사람들은 같은 배치를 본다.
//
// 감방을 나오면 별관 방(작업장·식당·의무실·세탁실)으로 간다. 각 방 안 퀴즈를 풀면 그 방
// 벽에 표식이 드러난다(Map.RoomStamps) — 예전 감방 벽 표식을 방 안 퀴즈 보상으로 옮긴 것.
//
// 최종 탈출구(배수관)는 "거짓말 탐정" 논리 퍼즐이다(liarPuzzle.ts): 화자들의 진술에서
// 누가 진실인지 가려 표식 4개를 진짜 자리에 배열한다. 문제·정답은 방 시드로 매판 랜덤.
//
// 문 열림은 solved에서 파생한다(openDoorsFromSolved). solvedIds는 서버가 매 tick
// 브로드캐스트하므로 협동 플레이에서 문이 모두에게 함께 열린다 — 별도 문 동기화 불필요.
import { create } from "zustand";
import { assignMinigames } from "./minigames/registry";
import type { MinigameDef } from "./minigames/types";
import { cellIdAt } from "./prisonLayout";

/** 색 순서 퍼즐에 쓰는 색 키. */
export type ColorKey = "red" | "yellow" | "green" | "blue";

/** 자물쇠 종류(방마다 다른 탈출 방법). */
export type Puzzle =
  | { kind: "dial"; code: string } // 숫자 다이얼(자리수 = code 길이)
  | { kind: "sequence"; palette: ColorKey[]; answer: ColorKey[] } // 색 버튼을 순서대로
  | { kind: "letters"; answer: string } // A~Z 문자 휠로 단어 맞추기(대문자)
  | { kind: "switches"; answer: boolean[] } // 레버 on(위)/off(아래) 패턴
  | { kind: "toolcode" } // 도구 이름→숫자 표에서 규칙을 찾아 답을 맞춘다. 표·답은 방 코드로 배정(toolCode.ts)
  | { kind: "hammer" } // 망치질 타이밍 — 게이지 초록 구간에서 Space로 내려친다. 4번 명중하면 자물쇠가 부서진다(반사신경 게임, 방 시드 무관)
  | { kind: "liar" } // 거짓말 탐정 — 표식 4개를 진짜 자리에 배열. 문제·답은 방 코드로 배정(liarPuzzle.ts)
  | { kind: "daycode" } // 식당 입장 — 요일별 배식 순서표에서 오늘 요일의 네 자리. 코드는 방 코드로 배정(cafeteriaPlan.ts)
  | { kind: "fridgecode" } // 식당 냉장고 — 반찬 4개 실제 칼로리 합. 코드는 방 코드로 배정(cafeteriaPlan.ts)
  | { kind: "valves" } // 세탁실 입장 — 배관 노선도를 읽어 밸브 4개를 이어지는 방향으로 돌린다(laundryPlan.ts)
  | { kind: "carelabel" } // 세탁실 건조대 — 오늘 세탁 일정과 관리 기호 4개가 모두 같은 옷 고르기(laundryPlan.ts)
  | { kind: "bloodtype" } // 의무실 입장 — 침대 넷의 혈액형을 단서로 복원해 네 자리(infirmaryPlan.ts)
  | { kind: "outbreak" } // 의무실 격리 구역 — 접촉 기록에서 최초 감염자 지목(infirmaryPlan.ts)
  | { kind: "minigame" }; // 아케이드 한 판. 어느 게임인지는 방 코드로 배정된다

export type InteractableType = "lockbox" | "note";

export interface Interactable {
  id: string;
  type: InteractableType;
  position: [number, number, number];
  label: string;
  /** 표시 문구. note면 힌트 본문, lockbox면 짧은 안내. */
  hint?: string;
  /** lockbox 전용: 자물쇠 퍼즐. */
  puzzle?: Puzzle;
  /** lockbox 전용: 풀면 열리는 감방문 id(예: "cell-A"). */
  opensDoor?: string;
  /** note 전용: 표 형태로 읽는 게시물(내용은 방 코드로 생성). 있으면 힌트 대신 표를 띄운다. */
  board?: "cafe-order" | "cafe-menu" | "cafe-tray" | "laundry-plan" | "pipe-map";
}

/** 상호작용 사거리(m, XZ 평면 기준) */
export const INTERACT_RANGE = 2.2;

// 감방 자물쇠 넷이 공유하는 안내문. 네 방이 같은 처지이므로 방마다 다르게 쓸 이유가 없고,
// 감방 안 쪽지를 전부 없앤 뒤로는 "나가서 뭘 해야 하는지"를 알려줄 곳이 여기뿐이다.
const CELL_LOCK_HINT =
  "간수가 압수한 게임기를 자물쇠에 박아 놨다. 한 판 이겨야 열린다. " +
  "문이 열리면 별관으로 나가라 — 방마다 놓인 퍼즐을 풀어야 그 방의 표식이 드러난다.";

// ── 방별 상호작용 오브젝트 ────────────────────────────────────────
// 좌표는 prisonLayout BUILDINGS(도면 배치) 기준. 수감동 감방(A~D) 안에는 자물쇠(미니게임) 하나뿐.
// 안에서 시작 → 한 판 이겨 가운데 복도로 나간다. 감방 쪽지는 없앴다(게임엔 답이 없어 읽을 게 없다).
// 별관 지원 방(작업장·의무실·세탁실)은 방 "밖" 복도의 고전 자물쇠로, 최종 탈옥문은 코드로 연다.
export const INTERACTABLES: Interactable[] = [
  {
    id: "lock-A",
    type: "lockbox",
    position: [-30, 0.6, 21],
    label: "1-1 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-A",
  },
  {
    id: "lock-B",
    type: "lockbox",
    position: [-14, 0.6, 21],
    label: "1-2 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-B",
  },
  {
    id: "lock-C",
    type: "lockbox",
    position: [-30, 0.6, 13],
    label: "1-3 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-C",
  },
  {
    id: "lock-D",
    type: "lockbox",
    position: [-14, 0.6, 13],
    label: "1-4 게임 자물쇠",
    hint: CELL_LOCK_HINT,
    puzzle: { kind: "minigame" },
    opensDoor: "cell-D",
  },

  // ── 별관 방(세탁실·의무실) 힌트 쪽지 4장 ─────────────────────────────────────
  //
  // 예전엔 쪽지가 전부 별관 복도 두 줄(z 15.6 / 18.4)에, 각자 제 자물쇠 4.5m 안에
  // 붙어 있었다. 문 앞에 서면 좌우로 다 보여 탐색도 채팅 공유도 일어나지 않았다.
  // 이제 네 구역(화장실·식당·연병장 동/서)으로 흩어 놓는다 —
  // 한 자물쇠의 두 장이 맵 반대편이라 혼자 돌아서는 못 모은다.
  //
  // 배치 규칙:
  //   - 잠긴 방(세탁실·의무실·감방) 안에는 두지 않는다. 그 방을 여는 열쇠가 그 방 안에 있으면 잠긴다.
  //   - 봇이 순회하는 것(서버 Interactables.java POI)은 BotNav 웨이포인트에서 닿는 자리로.
  //   ⚠️ 좌표는 서버 Interactables.java와 이중 관리 — 한쪽만 고치면 봇이 유령 지점으로 걸어간다.
  //
  // ── 세탁실 ①진입(복도 쪽): 배관 밸브 4개 + 벽에 걸린 노선도 ──
  // 노선도를 읽어, 각 밸브에서 관이 이어지는 방향으로 핸들을 돌린다(45°씩 8방향).
  // 노선도엔 답이 없다 — 갈림길마다 죽은 가지(폐수조·보일러·막힘)가 붙어 있어 급수 본관에서
  // 세탁조까지 관을 실제로 따라가야 한다. 문제는 방 코드로 매판 랜덤(laundryPlan.laundryPipes).
  //
  // ⚠️ 노선도는 **밸브와 따로 떨어진 벽 게시물**이다(2026-07-31 사용자 지시. 처음엔 밸브 창
  //    안에 같이 그렸다). 둘의 거리는 3.2m로 사거리(2.2m) 밖이라 한 자리에서 둘 다 열 수 없다
  //    — 도면을 외우거나 둘이 나눠 맡아야 한다. 더 멀리 두면 네 방향을 외우느라 왕복만 는다.
  // (규칙만 적힌 화장실 쪽지 note-laundry1은 2026-08-05 사용자 지시로 제거. 같은 말이 아래
  //  lock-laundry의 hint에 이미 있고, 설명하는 자물쇠에서 25m 넘게 떨어진 화장실에 있어
  //  "세탁 안내문인데 세탁기가 없는 방"이 됐다. 서버 봇 POI에서도 함께 뺐다.)
  { id: "note-pipe-map", type: "note", position: [27, 1.5, 19.6], label: "배관 노선도", board: "pipe-map" },
  {
    id: "lock-laundry",
    type: "lockbox",
    position: [30, 0.6, 18.4],
    label: "세탁실 배관 밸브",
    hint: "옆 벽에 배관 노선도가 걸려 있다. 노선도에서 ①~④ 밸브를 찾아, 그 자리에서 관이 이어지는 방향으로 핸들을 돌려라. 넷을 다 돌린 뒤 물을 흘려 봐야 안다.",
    puzzle: { kind: "valves" },
    opensDoor: "door-laundry",
  },

  // ── 세탁실 ②표식 해금(방 안): 오늘 세탁 일정 ↔ 옷 라벨 대조 ──
  // 벽의 일정표(note-laundry-plan)가 요구하는 관리 기호 4가지와 **모두** 일치하는 옷을
  // 건조대에서 찾는다. 가짜는 대개 기호 하나만 다르다. 풀면 세탁실 벽에 표식이 나타난다
  // (Map.RoomStamps). opensDoor가 없다 — 문이 아니라 표식을 여는 관문이다.
  { id: "note-laundry-plan", type: "note", position: [26.5, 1.5, 20.4], label: "오늘 세탁 일정", board: "laundry-plan" },
  {
    id: "quiz-laundry",
    type: "lockbox",
    position: [26, 0.6, 22.6], // 건조대(세탁실 서편, 문에서 들어와 왼쪽)
    label: "건조대",
    hint: "벽의 오늘 세탁 일정과 관리 기호가 네 가지 모두 일치하는 옷을 **전부** 골라라. 몇 벌인지는 적혀 있지 않다 — 라벨을 하나씩 다 확인하라.",
    puzzle: { kind: "carelabel" },
  },

  // ── 작업장 ①문 잠금(복도 쪽): 망치질로 자물쇠 부수기 ──
  // 식당과 같은 구조 — 문 잠금(밖)을 부수고 들어간 뒤, 방 안 퀴즈(quiz-work)로 표식을 해금한다.
  // 오른쪽 세로 게이지의 초록 구간에 화살표가 왔을 때 Space로 내려친다. 4번 명중하면 도어락이
  // 부서지며 문이 열린다. 반사신경 게임이라 방 시드와 무관하다(각자 제 손으로 부순다).
  // 서버 Room.LOCK_OPENS에도 매핑(봇·/door가 문만 여는 걸 막는다).
  {
    id: "lock-work",
    type: "lockbox",
    position: [14, 0.6, 15.6], // 작업장 문 앞(복도 쪽 — 문은 북벽 x14/z14)
    label: "작업장 문 잠금장치",
    hint: "게이지의 초록 구간에 화살표가 올 때 Space로 망치질하라. 네 번 명중하면 자물쇠가 부서진다.",
    puzzle: { kind: "hammer" },
    opensDoor: "door-work",
  },

  // ── 작업장 ②표식 해금(방 안): 도구 이름→숫자 표 ──
  // 문(lock-work)을 풀고 들어와야 닿는다. 풀면 이 방 벽에 표식이 나타난다(Map.RoomStamps).
  // opensDoor가 없다 — 문을 여는 게 아니라 표식을 드러내는 관문이다.
  // 표·답은 방 코드로 매판 랜덤이라 방마다 답이 다르다(toolCode.ts).
  // (작업장 쪽지 note-work1·2는 문 자물쇠와 함께 없어졌다 — 답이 방 안 표에 있다.)
  {
    id: "quiz-work",
    type: "lockbox",
    position: [18.5, 0.9, 11.5], // 3번 작업대 위(PrisonProps.WORKBENCHES 인덱스2 = [18.5,11.5], 상판 높이 0.9)
    label: "작업도구함",
    hint: "도구 이름과 숫자 사이엔 규칙이 있다. 규칙을 찾아 물음표의 수를 맞춰라.",
    puzzle: { kind: "toolcode" },
  },

  // ── 식당 ①입장: 문 좌측 벽 서류 2장 + 문 자물쇠(요일 코드) ──
  // 나레이션이 오늘 요일을 알려준다. 배식 순서표에서 오늘 요일 줄의 네 자리를 읽어 문을 연다.
  // 문은 감옥 창살이 아니라 진짜 식당 문(Map.CafeteriaDoor). 문 개구부는 남벽 x14(폭4).
  // 좌측(서쪽) 벽 x6~12 복도 쪽에 서류를 건다. 표 내용은 cafeteriaPlan.
  //   - 배식 순서표: ①입장 코드(요일→네 자리)
  //   - 오늘의 식단표: ②냉장고 계산의 힌트(오늘 반찬 4개의 기준량·기준칼로리 → 1g당 칼로리)
  { id: "note-cafe-order", type: "note", position: [10.5, 1.5, 19.6], label: "배식 순서표", board: "cafe-order" },
  { id: "note-cafe-menu", type: "note", position: [7.5, 1.5, 19.6], label: "오늘의 식단표", board: "cafe-menu" },
  {
    id: "lock-cafe",
    type: "lockbox",
    position: [14, 0.9, 19.3], // 식당 문 앞(복도 쪽)
    label: "식당 문 잠금장치",
    hint: "요일별 배식 순서표에서 오늘 요일 줄의 네 자리를 찾아 입력하라.",
    puzzle: { kind: "daycode" },
    opensDoor: "door-cafe",
  },

  // ── 식당 ②냉장고 코드(표식 획득): 배식대 식판(분리벽) + 조리실 안 냉장고. ──
  // 식당에 입장(daycode) → 배식대 위 식판을 읽고 → 조리실(동쪽 1/4, 북끝 출입구)로 들어가 냉장고를 푼다.
  // 식판을 열면 반찬 4 + 간식 1의 실제 담긴 양이 나온다. 식단표의 기준량·칼로리로 1g당 칼로리를
  // 구해 실제량에 곱하면 반찬별 실제 칼로리 — 그 합이 냉장고 코드다. 간식은 식단표에 없어 제외(함정).
  // 냉장고를 풀면 이 방 벽에 표식이 드러난다(Map.RoomStamps, opensDoor 없음).
  { id: "note-cafe-tray", type: "note", position: [17.8, 1.06, 23], label: "식판", board: "cafe-tray" }, // 배식대 상판 위, 식당 쪽 앞줄(y=상판 높이 1.05)
  {
    id: "lock-fridge",
    type: "lockbox",
    position: [20.5, 0.9, 25.9], // 조리실 안 냉장고 앞(북끝 출입구로 들어가 닿는다. Map.CafeteriaDecor 냉장고와 같은 자리)
    label: "냉장고 잠금장치",
    hint: "식단표로 반찬 1g당 칼로리를 구해 식판 실제량에 곱하고, 반찬 넷을 더하라. 간식은 뺀다.",
    puzzle: { kind: "fridgecode" },
  },

  // ── 의무실 ①진입(복도 쪽): 혈액형 판정 금고 ──
  // 병동 침대 여섯의 차트에서 혈액형 칸만 젖어 지워졌다(같은 형이 여럿일 수 있다).
  // 단서로 배치를 복원해 **여섯 칸을 그대로** 채운다(4^6 = 4096가지라 찍기로는 안 열린다).
  // 혈액 검사 키트는 두 침대 사이 "수혈 가능 여부"만 알려준다(횟수는 infirmaryPlan.BLOOD_CHARGES).
  // ⚠️ 난이도 손잡이는 infirmaryPlan.REVEALED_BEDS — 혈액형을 그대로 알려 주는 확정 단서 수다.
  // 배치·정답은 방 코드로 매판 랜덤(infirmaryPlan.bloodPlan). 옛 고정 코드 "451"은 폐기했다.
  // (규칙만 적힌 화장실 쪽지 note-med1은 2026-08-05 사용자 지시로 제거 — 같은 말이 아래
  //  lock-med의 hint에 있고, 정작 화장실엔 약장이 없어 라벨만 떠 있었다. 서버 POI도 동일.)
  {
    id: "lock-med",
    type: "lockbox",
    position: [30, 0.6, 15.6],
    label: "의무실 문 금고",
    hint: "차트의 단서로 침대 여섯의 혈액형을 복원해 그대로 채워 넣어라. 하나씩이라는 보장은 없다 — 같은 형이 여럿일 수 있다. 몇 자리는 차트에 형이 그대로 남아 있으니 거기서부터 짚어 나가라.",
    puzzle: { kind: "bloodtype" },
    opensDoor: "door-med",
  },

  // ── 의무실 ②표식 해금(방 안): 감염 경로 추적 ──
  // 어제의 접촉 기록(누가 몇 시에 누구와)과 증상 발현 셋으로, 감염을 병동에 처음 들여온
  // 사람을 지목한다. 감염은 접촉 즉시·발현은 6시간 뒤·발현 전에도 옮긴다는 규칙이라
  // **정답은 끝내 증상이 없는 사람**이다 — 발현 기록만 훑으면 절대 못 찾는다.
  // 틀리면 그 사람이 최초일 수 없는 이유를 돌려준다(찍기 대신 추리를 시킨다).
  // 인물 배역은 방 코드로 매판 섞인다(infirmaryPlan.outbreakPlan). opensDoor 없음 — 표식 관문.
  {
    id: "quiz-med",
    type: "lockbox",
    position: [34.5, 0.6, 11.2], // 병동 동편, 침대 열과 문 사이(약장 x36.8과 겹치지 않는 자리)
    label: "격리 구역 기록판",
    hint: "접촉 기록과 발현 시각으로 여섯 명이 각각 누구에게서 옮았는지 표를 채워라. 증상이 없다고 무고한 것은 아니다.",
    puzzle: { kind: "outbreak" },
  },

  // (해독 조각 문서 3곳(doc-cafe/hall/yard)은 없앴다 — 옛 "표식+수 셈법 코드" 시스템의 일부였고,
  //  표식의 진짜 자리를 그대로 적어 둬 새 배수관 거짓말 탐정 퍼즐의 정답을 통째로 흘렸다.)

  // ── 정문(함정): 닫힌 정문의 코드 자물쇠 + 감시탑 힌트 둘 ────────────────────────
  // 가장 눈에 띄는 출구라 다들 여기부터 노린다. 힌트를 모아 코드를 맞춰 정문을 여는 순간,
  // 바로 그게 함정이다 — 서버가 무작위 2명을 재수감한다. 진짜 출구는 세탁실 뒤 배수관.
  // (서버 Room.GATE_LOCK_ID = "gate-lock". solve가 곧 함정 발동 신호다.)
  { id: "gate-note1", type: "note", position: [-9, 0.6, -27], label: "서쪽 감시탑 각인", hint: "정문 코드 앞 두 자리 — 서쪽 감시탑 기둥에 '19'가 새겨져 있다." },
  { id: "gate-note2", type: "note", position: [9, 0.6, -27], label: "동쪽 감시탑 각인", hint: "정문 코드 뒤 두 자리 — 동쪽 감시탑 기둥에 '84'가 새겨져 있다." },
  {
    id: "gate-lock",
    type: "lockbox",
    position: [0, 0.6, -26], // 파란 정문 앞
    label: "정문 잠금장치",
    hint: "네 자리. 감시탑 두 곳에 새겨진 수를 모아라.",
    puzzle: { kind: "dial", code: "1984" },
    opensDoor: "gate-main", // 풀면 정문이 열린다 — 그 순간 함정이 발동한다(서버).
  },
  {
    id: "escape-pipe",
    type: "lockbox",
    position: [30, 0.6, 29], // 세탁실 뒤 북쪽 2m 순찰로(배수관 앞) — 진짜 최종 탈출구
    label: "배수관 잠금장치",
    hint: "거짓말 탐정 — 화자들의 말에서 누가 진실인지 가려, 표식 4개를 진짜 자리에 배열하라.",
    // 문제·정답은 방 시드로 매판 생성된다(liarPuzzle.ts). UI가 방 코드로 직접 만든다.
    puzzle: { kind: "liar" },
    // 풀면 북벽 배수관 해치(pipe-hatch)가 열린다 — 진짜 탈출 연출.
    // 서버 Room.LOCK_OPENS에도 같은 매핑이 있다(봇이 근접만으로 해치를 열지 못하게 막는 효과도 겸한다).
    // ⚠️ 정문(gate-main)은 더 이상 탈출구가 아니라 함정이다 — 코드가 없고, 통과하면 재수감된다.
    opensDoor: "pipe-hatch",
  },
];

/** 최종 탈출구(배수관) id. 이게 solved면 게임 클리어(진짜 탈출). */
export const ESCAPE_PIPE_ID = "escape-pipe";

/** id로 상호작용 오브젝트를 찾는다. 시드 의존 내용(퍼즐 문제)은 각 UI가 방 코드로 직접 만든다. */
export function findInteractable(id: string | null): Interactable | undefined {
  return id ? INTERACTABLES.find((it) => it.id === id) : undefined;
}

// 문을 여는 자물쇠 목록(모듈 로드 시 1회 계산).
const LOCKS = INTERACTABLES.filter(
  (it): it is Interactable & { opensDoor: string } =>
    it.type === "lockbox" && !!it.opensDoor,
);

// 감방 자물쇠 id → 그 자물쇠가 있는 감방 id("cell-A" → "A"). 감방 자물쇠에만 둔다 —
// 별관 문 자물쇠(door-*)는 방 밖에서 여는 것이라 이 제한 대상이 아니다.
const LOCK_CELL: Record<string, string> = Object.fromEntries(
  LOCKS.filter((l) => l.opensDoor.startsWith("cell-")).map((l) => [
    l.id,
    l.opensDoor.slice("cell-".length),
  ]),
);

/**
 * 지금 위치에서 이 오브젝트를 만질 수 있는가.
 *
 * 감방 자물쇠는 **그 감방 안에 있을 때만** 만질 수 있다. 사거리(2.2m)만 보면 문 밖에서
 * 창살 너머로 손이 닿아 남의 방을 밖에서 열어 주게 된다 — 각자 자기 방을 푼다는 전제가 깨진다.
 * 별관 문 자물쇠·탈옥문은 감방이 아니므로 제한이 없다(LOCK_CELL에 없어 undefined).
 *
 * 단, **협동 구제가 열리면**(assistOpen — 개인 탈출이 오래 걸려 서버가 개방) 이 제한이 풀려
 * 복도에서 창살 너머로 남의 감방 자물쇠를 대신 풀 수 있다. 손이 막혀 오래 갇힌 사람을
 * 방 전체가 도울 수 있게 하려는 것이다.
 */
export function canInteract(
  it: Interactable,
  x: number,
  z: number,
  assistOpen = false,
): boolean {
  const cell = LOCK_CELL[it.id];
  return cell === undefined || cell === cellIdAt(x, z) || assistOpen;
}

/** 이 자물쇠가 속한 감방 id("lock-B" → "B"). 감방 자물쇠가 아니면(별관·탈옥문) undefined. */
export function lockCellOf(id: string): string | undefined {
  return LOCK_CELL[id];
}

/** 미니게임이 걸린 자물쇠 id들(배치 순서 = 감방 A~D 순서). */
export const MINIGAME_LOCK_IDS: string[] = INTERACTABLES.filter(
  (it) => it.puzzle?.kind === "minigame",
).map((it) => it.id);

/**
 * 이 자물쇠에 걸린 미니게임. seed(방 코드)가 같으면 항상 같은 배치가 나온다 —
 * 같은 방 사람끼리 "3호실은 뱀이더라" 같은 말이 통해야 하기 때문이다.
 */
export function minigameFor(objectId: string, seed: string): MinigameDef | undefined {
  return assignMinigames(seed || "solo", MINIGAME_LOCK_IDS)[objectId];
}

// ── 배수관 샛길 철창(표식 게이트) ────────────────────────────────
// 배수관(최종 탈출구)으로 통하는 동쪽 샛길(건물 x38 ~ 외벽 x42)을 막는 철창. 별관 4방의 표식
// 퀴즈를 모두 풀면(=표식 4개 획득) 자동으로 열린다. 2026-07-31에 의무실(C)까지 들어와
// **네 개가 다 구현됐다** — 이제 별관 네 방을 모두 풀어야 배수관으로 가는 길이 열린다.
// ⚠️ 게이트 박스 좌표는 prisonLayout.DRAIN_GATE / 서버 Collision·Room과 맞춘다.
export const DRAIN_GATE_ID = "gate-drain";
export const STAMP_QUIZ_IDS = ["quiz-work", "lock-fridge", "quiz-med", "quiz-laundry"];
/** 표식 4개를 다 얻었는가(= 별관 4방 표식 퀴즈가 모두 solved). 그러면 배수관 샛길 철창이 열린다. */
export function isDrainGateOpen(solved: Record<string, boolean>): boolean {
  return STAMP_QUIZ_IDS.every((id) => !!solved[id]);
}

// 매 프레임 충돌 계산에서 쓰므로 객체를 재사용한다(프레임마다 new 방지).
const _openDoors: Record<string, boolean> = {};
/** solved 상태로부터 열린 문 맵을 만든다. 자물쇠가 풀린 방의 문 + 표식 4개면 배수관 철창이 열린다. */
export function openDoorsFromSolved(
  solved: Record<string, boolean>,
): Record<string, boolean> {
  for (const l of LOCKS) _openDoors[l.opensDoor] = !!solved[l.id];
  _openDoors[DRAIN_GATE_ID] = isDrainGateOpen(solved); // 표식 게이트(단일 자물쇠가 아니라 4개 합)
  return _openDoors;
}

// 감방문 id → 그 문을 여는 자물쇠 id (문 비주얼이 열림 여부를 판단하는 데 쓴다).
export const DOOR_TO_LOCK: Record<string, string> = Object.fromEntries(
  LOCKS.map((l) => [l.opensDoor, l.id]),
);
/** 감방문이 열려 있는가(= 그 문을 여는 자물쇠가 solved인가). */
export function isCellDoorOpen(
  doorId: string,
  solved: Record<string, boolean>,
): boolean {
  const lockId = DOOR_TO_LOCK[doorId];
  return lockId ? !!solved[lockId] : false;
}

interface InteractionStore {
  nearId: string | null; // 사거리 내 가장 가까운 오브젝트
  openId: string | null; // 현재 열려 있는 퍼즐/힌트
  solved: Record<string, boolean>;
  /** 서버가 확정한 "열린 문" 맵(매 tick 스냅샷 openDoors). 자유 토글 문(철창 게이트)의
   *  로컬 충돌·비주얼이 이걸 본다 — solved 파생 문과 달리 여닫이가 반복되기 때문. */
  serverDoors: Record<string, boolean>;

  setNear: (id: string | null) => void;
  open: (id: string) => void;
  close: () => void;
  /**
   * 새 방(= 새 판)에 들어갈 때 전부 비운다.
   *
   * ⚠️ 이걸 안 부르면 이전 판의 solved가 그대로 남는다. syncSolved는 합집합이라 서버가
   * 빈 목록을 보내도 아무것도 지우지 않고, 문은 전부 solved에서 파생되므로(감방문·별관문·
   * 배수관 게이트 + openDoorsFromSolved의 충돌까지) 새 판이 "다 열린 교도소"로 시작한다.
   * 새로고침하면 모듈 상태가 날아가 증상이 사라져 재현이 "새로고침 없이 재시작"으로만 잡혔다.
   */
  resetForNewRoom: () => void;
  markSolved: (id: string) => void;
  /** 재수감 함정: 특정 자물쇠를 다시 잠근다(감방문이 solved에서 파생 → 함께 닫힌다). */
  unmarkSolved: (id: string) => void;
  /** 서버 스냅샷의 solvedIds를 병합(협동). 실제로 늘어날 때만 갱신. */
  syncSolved: (ids: string[]) => void;
  /** 서버 스냅샷의 openDoors 목록으로 serverDoors를 교체(권위). 바뀔 때만 갱신. */
  setServerDoors: (ids: string[]) => void;
  /** E로 문을 눌렀을 때의 낙관적 즉시 반영(다음 스냅샷이 서버 값으로 확정한다). */
  setDoorOptimistic: (id: string, open: boolean) => void;
}

export const useInteraction = create<InteractionStore>((set, get) => ({
  nearId: null,
  openId: null,
  solved: {},
  serverDoors: {},

  setNear: (id) => {
    if (get().nearId !== id) set({ nearId: id }); // 변화 시에만 리렌더
  },
  open: (id) => set({ openId: id }),
  close: () => set({ openId: null }),
  resetForNewRoom: () =>
    set({ nearId: null, openId: null, solved: {}, serverDoors: {} }),
  markSolved: (id) =>
    set((s) => ({ solved: { ...s.solved, [id]: true }, openId: null })),

  unmarkSolved: (id) => {
    const cur = get().solved;
    if (!cur[id]) return;
    const next = { ...cur };
    delete next[id];
    set({ solved: next });
  },

  syncSolved: (ids) => {
    const cur = get().solved;
    const missing = ids.filter((id) => !cur[id]);
    if (missing.length === 0) return; // 변화 없으면 리렌더 안 함
    const next = { ...cur };
    for (const id of missing) next[id] = true;
    set({ solved: next });
  },

  setServerDoors: (ids) => {
    const cur = get().serverDoors;
    const want = new Set(ids);
    // 실제로 달라졌을 때만 새 객체로 교체(불필요한 리렌더 방지).
    const keys = new Set([...Object.keys(cur).filter((k) => cur[k]), ...ids]);
    let changed = false;
    for (const k of keys) {
      if (!!cur[k] !== want.has(k)) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    const next: Record<string, boolean> = {};
    for (const id of ids) next[id] = true;
    set({ serverDoors: next });
  },

  setDoorOptimistic: (id, open) => {
    const cur = get().serverDoors;
    if (!!cur[id] === open) return;
    set({ serverDoors: { ...cur, [id]: open } });
  },
}));

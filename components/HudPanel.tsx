"use client";
// HUD 좌상단의 작은 아이콘 버튼 + 모달 한 쌍. 이야기(책)와 도움말(물음표)이 같은 껍데기를 쓴다.
//
// ⚠️ 여는 통로는 useInteraction.openId다. 이동·시점 정지와 포인터락 해제가 전부 그 하나에
//    걸려 있어서(LocalPlayer·useMouseLook), 모달을 읽는 동안 캐릭터가 멋대로 움직이지 않는다.
//    Esc 닫기도 PuzzleOverlay의 핸들러가 대신 해 준다 — 그쪽은 모르는 id면 아무것도 그리지
//    않으므로(findInteractable → undefined → null) 서로 부딪히지 않는다.
//
// ⚠️ 단축키가 없으면 **사실상 못 연다**. 게임 중엔 포인터락이 걸려 커서가 없어 버튼을 클릭할
//    수 없다(미니맵 M과 같은 이유로 키를 함께 준다). 코드로 비교해야 한글 자판에서도 먹는다.
import { useInteraction } from "@/game/interactables";
import { useGameStore } from "@/store/gameStore";
import { useEffect, type ReactNode } from "react";

interface Props {
  /** 상호작용 오브젝트가 아닌 예약 id(근접이 아니라 버튼·키로만 열린다). */
  id: string;
  /** KeyboardEvent.code — "KeyB" 같은 물리 키 위치. */
  hotkeyCode: string;
  /** 화면에 보여줄 키 이름. */
  hotkeyLabel: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export default function HudPanel({ id, hotkeyCode, hotkeyLabel, title, icon, children }: Props) {
  const openId = useInteraction((s) => s.openId);
  const open = useInteraction((s) => s.open);
  const close = useInteraction((s) => s.close);

  // 탈옥(PLAY) 중에만 쓴다. 색출·결말 화면은 그 자체가 전면 모달이라, 그 위에 겹쳐 봐야
  // 가려서 안 보이거나 반대로 투표를 가린다.
  const playing = useGameStore((s) => s.phase) === "PLAY";

  const showing = openId === id;
  // 다른 퍼즐이 열려 있는 동안에는 버튼을 숨긴다 — 그 위에 겹쳐 봐야 누를 수도 없다.
  const hidden = !playing || (openId !== null && !showing);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== hotkeyCode) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (useGameStore.getState().phase !== "PLAY") return;
      const cur = useInteraction.getState().openId;
      if (cur === id) close();
      else if (cur === null) open(id); // 퍼즐이 열려 있으면 가로채지 않는다
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, hotkeyCode, open, close]);

  return (
    <>
      {!hidden && (
        <button
          onClick={() => (showing ? close() : open(id))}
          title={`${title} (${hotkeyLabel})`}
          aria-label={title}
          className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur transition ${
            showing
              ? "border-amber-300/60 bg-amber-500/20 text-amber-200"
              : "border-white/10 bg-black/40 text-slate-300 hover:bg-black/60 hover:text-slate-100"
          }`}
        >
          {icon}
        </button>
      )}

      {/* ⚠️ fixed다 — 버튼을 감싼 부모가 absolute로 자리를 잡고 있어서, absolute inset-0으로
          두면 모달이 그 작은 상자 안에 갇힌다. */}
      {showing && playing && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#12161f] p-6 text-slate-100 shadow-2xl">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="text-amber-300">{icon}</span>
                {title}
              </h2>
              <span className="shrink-0 text-xs text-slate-500">
                Esc · {hotkeyLabel}로 닫기
              </span>
            </div>

            {children}

            <button
              onClick={close}
              className="mt-6 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

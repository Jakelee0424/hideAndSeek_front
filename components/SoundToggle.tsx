"use client";
// BGM 조작: 음소거 버튼 + 음량 슬라이더. 자리는 부모가 className으로 정한다
// (로비와 게임 HUD의 여백이 달라서).
//
// 아이콘 클릭 = 음소거 토글을 그대로 뒀다. 발표 중에 소리를 급히 죽여야 할 때
// 슬라이더를 끄는 것보다 한 번 누르는 게 빠르다. 슬라이더는 그 옆에 상시 노출한다 —
// 눌러야 열리는 팝오버로 만들면 급할 때 한 동작이 더 든다.
import { useSoundStore } from "@/store/soundStore";

export default function SoundToggle({ className = "" }: { className?: string }) {
  const muted = useSoundStore((s) => s.muted);
  const volume = useSoundStore((s) => s.volume);
  const toggle = useSoundStore((s) => s.toggle);
  const setVolume = useSoundStore((s) => s.setVolume);

  const percent = Math.round(volume * 100);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 rounded-lg bg-black/40 px-2.5 py-2 backdrop-blur ${className}`}
    >
      <button
        onClick={toggle}
        title={muted ? "배경음 켜기" : "배경음 끄기"}
        aria-label={muted ? "배경음 켜기" : "배경음 끄기"}
        className="text-sm leading-none text-slate-300 transition hover:text-white"
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={muted ? 0 : percent}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        title={`배경음 음량 ${muted ? 0 : percent}%`}
        aria-label="배경음 음량"
        className="h-1 w-16 cursor-pointer accent-sky-400"
      />
    </div>
  );
}

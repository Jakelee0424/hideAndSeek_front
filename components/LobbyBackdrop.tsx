"use client";
// 로비 배경. 감방 벽에 뚫린 구멍으로 달아나는 죄수를 그린 일러스트 이미지
// (public/lobby-bg.png)를 화면 가득 깐다. 위에 jail-vignette(가장자리 어둡게)가
// 덮여 UI 가독성을 지킨다. next/image의 fill+priority로 첫 화면에서 바로 뜨고
// webp로 최적화되어 원본(약 1.9MB)보다 가볍게 내려간다.
import Image from "next/image";

export default function LobbyBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <Image
        src="/lobby-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* 이미지가 밝은 부분(달빛·구멍) 위에서도 글자가 읽히도록 살짝 눌러준다 */}
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}

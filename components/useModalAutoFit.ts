"use client";
// 모달이 세로로 길어 스크롤이 생길 상황이면, **세로 스크롤 대신** 내용을 여러 열로 나눠
// 모달을 좌우로 넓힌다("한번에 보이게"). 열 개수는 실제 콘텐츠 높이를 재서 정하고, 뷰포트
// 폭/높이를 넘지 않는 선까지만 넓힌다. 게임 내 모든 모달이 이 훅을 통해 스크롤 없이 펼쳐진다.
//
// 사용법: 셸에서 contentRef를 "열로 나눌 본문"에 걸고(헤더/닫기 버튼은 제외), contentStyle을
// 그 본문에, boxStyle을 모달 바깥 상자에 얹는다. 본문에는 자식이 열 경계에서 안 쪼개지게
// className "[&>*]:[break-inside:avoid]"를 함께 준다(퍼즐 한 덩어리가 두 열로 갈리지 않게).
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const GAP = 28; // 열 사이 간격(px)
const MAX_COLS = 4; // 아무리 길어도 여기까지만 — 그 이상은 폭이 감당 안 된다

interface Options {
  /** 1열 기준 본문(콘텐츠) 폭(px). 셸의 기본 max-width에서 좌우 패딩을 뺀 값. */
  baseWidth: number;
  /** 상자에서 본문이 아닌 부분(헤더·푸터·패딩·백드롭 여백)의 세로 예산(px). */
  reserve: number;
  /** 상자 좌우 패딩 합(px) — 넓힌 상자 폭을 계산할 때 더한다. */
  padX: number;
}

interface Fit {
  cols: number;
  contentRef: RefObject<HTMLDivElement | null>;
  contentStyle: CSSProperties;
  boxStyle: CSSProperties;
}

/**
 * @param deps 콘텐츠가 바뀔 때 다시 재도록 하는 의존성(모달 id·퍼즐 종류 등).
 */
export function useModalAutoFit({ baseWidth, reserve, padX }: Options, deps: unknown[] = []): Fit {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(1);

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    // 1열·기준 폭으로 강제해 자연 높이를 잰다(현재 넓혀진 상태의 영향을 받지 않게).
    const prevWidth = el.style.width;
    const prevCols = el.style.columnCount;
    el.style.width = `${baseWidth}px`;
    el.style.columnCount = "1";
    const singleH = el.scrollHeight;
    el.style.width = prevWidth;
    el.style.columnCount = prevCols;

    const availH = Math.max(200, window.innerHeight * 0.94 - reserve);
    let n = Math.max(1, Math.ceil(singleH / availH));
    // 좌우로 뷰포트를 넘지 않는 선까지만.
    const maxByWidth = Math.max(1, Math.floor((window.innerWidth * 0.94 + GAP) / (baseWidth + GAP)));
    n = Math.min(n, MAX_COLS, maxByWidth);
    setCols(n);
  }, [baseWidth, reserve]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // deps: 콘텐츠가 바뀌면 다시 잰다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  const contentStyle: CSSProperties = cols > 1 ? { columnCount: cols, columnGap: GAP } : {};
  const boxStyle: CSSProperties =
    cols > 1 ? { width: cols * baseWidth + (cols - 1) * GAP + padX, maxWidth: "94vw" } : {};

  return { cols, contentRef, contentStyle, boxStyle };
}

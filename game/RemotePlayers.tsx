"use client";
// 원격 플레이어 목록. playerIds(입/퇴장 시에만 변함)로만 리렌더된다.
import { useGameStore } from "@/store/gameStore";
import RemotePlayer from "./RemotePlayer";

export default function RemotePlayers() {
  const playerIds = useGameStore((s) => s.playerIds);
  const myId = useGameStore((s) => s.myId);
  const nicks = useGameStore((s) => s.nicks);

  return (
    <>
      {playerIds
        .filter((id) => id !== myId)
        .map((id) => (
          <RemotePlayer key={id} id={id} nick={nicks[id] ?? id} />
        ))}
    </>
  );
}

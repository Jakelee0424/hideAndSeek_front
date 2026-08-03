import GameClient from "@/components/GameClient";

// 새로고침으로 이 페이지에 바로 진입하면 zustand 스토어가 기본값으로 초기화된다
// (roomId="lobby"). URL의 방 코드를 넘겨 시드(요일 등)를 실제 방으로 복원한다.
export default async function PlayPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <GameClient roomId={decodeURIComponent(roomId)} />;
}

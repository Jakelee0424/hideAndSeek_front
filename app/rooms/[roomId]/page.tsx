import WaitingRoom from "@/components/WaitingRoom";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <WaitingRoom roomId={decodeURIComponent(roomId)} />;
}

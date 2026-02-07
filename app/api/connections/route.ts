import { NextResponse } from "next/server";
import { mockConnections } from "@/lib/mock-data";

export async function GET() {
  // TODO: Replace with actual VPN server connection query
  // Example: Query OpenVPN management interface for active connections
  // const connections = await getActiveConnections();

  return NextResponse.json(mockConnections);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("id");

  // TODO: Implement connection termination
  // Example: Send disconnect command to VPN server
  // await disconnectUser(connectionId);

  return NextResponse.json({
    success: true,
    message: `Connection ${connectionId} terminated`
  });
}

import { NextResponse } from "next/server";
import { mockConnections } from "@/lib/mock-data";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

  // TODO: Replace with actual VPN server connection query
  // Example: Query VPN management interface for active connections
  // const connections = await getActiveConnections();

  return NextResponse.json(mockConnections);
}

export async function DELETE(request: Request) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return authResult.error;
  }

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

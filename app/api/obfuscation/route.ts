import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const servers = await prisma.obfuscationServer.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(servers);
  } catch (error) {
    console.error('Failed to fetch obfuscation servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch obfuscation servers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, host, port, targetHost, targetPort, config } = body;

    // Validate required fields
    if (!name || !type || !host || !port) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['trusttunnel', 'udp2raw'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be trusttunnel or udp2raw' },
        { status: 400 }
      );
    }

    // Validate port number
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json(
        { error: 'Invalid port number' },
        { status: 400 }
      );
    }

    const server = await prisma.obfuscationServer.create({
      data: {
        name,
        type,
        host,
        port: portNum,
        targetHost: targetHost || null,
        targetPort: targetPort ? parseInt(targetPort) : null,
        config: config || null,
        isActive: true,
      },
    });

    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error('Failed to create obfuscation server:', error);
    return NextResponse.json(
      { error: 'Failed to create obfuscation server' },
      { status: 500 }
    );
  }
}

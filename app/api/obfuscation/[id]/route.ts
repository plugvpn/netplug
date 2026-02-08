import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const server = await prisma.obfuscationServer.findUnique({
      where: { id },
    });

    if (!server) {
      return NextResponse.json(
        { error: 'Obfuscation server not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(server);
  } catch (error) {
    console.error('Failed to fetch obfuscation server:', error);
    return NextResponse.json(
      { error: 'Failed to fetch obfuscation server' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, host, port, targetHost, targetPort, isActive, config } = body;

    // Validate type if provided
    if (type && !['trusttunnel', 'udp2raw'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be trusttunnel or udp2raw' },
        { status: 400 }
      );
    }

    // Validate port number if provided
    if (port) {
      const portNum = parseInt(port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        return NextResponse.json(
          { error: 'Invalid port number' },
          { status: 400 }
        );
      }
    }

    const server = await prisma.obfuscationServer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(host && { host }),
        ...(port && { port: parseInt(port) }),
        ...(targetHost !== undefined && { targetHost: targetHost || null }),
        ...(targetPort !== undefined && { targetPort: targetPort ? parseInt(targetPort) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(config !== undefined && { config }),
      },
    });

    return NextResponse.json(server);
  } catch (error) {
    console.error('Failed to update obfuscation server:', error);
    return NextResponse.json(
      { error: 'Failed to update obfuscation server' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.obfuscationServer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete obfuscation server:', error);
    return NextResponse.json(
      { error: 'Failed to delete obfuscation server' },
      { status: 500 }
    );
  }
}

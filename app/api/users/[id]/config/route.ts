import { NextResponse } from "next/server";
import { generateClientConfig } from "@/lib/wireguard/config-generator";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get user with server details
    const user = await prisma.vPNUser.findUnique({
      where: { id },
      include: { server: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let configText = '';
    let fileName = '';

    if (user.server.protocol === 'wireguard') {
      // Use the existing generator for WireGuard
      const config = await generateClientConfig(id);
      if (config) {
        configText = config;
      } else {
        configText = `# Error: Failed to generate WireGuard configuration
# Contact your administrator`;
      }
      fileName = `${user.username}.conf`;
    } else if (user.server.protocol === 'openvpn') {
      // Generate OpenVPN configuration template
      fileName = `${user.username}.ovpn`;
      configText = `client
dev tun
proto udp
remote ${user.server.host} ${user.server.port || '1194'}
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-CBC
auth SHA256
key-direction 1
verb 3

# User: ${user.username}
${user.commonName ? `# Common Name: ${user.commonName}` : ''}

# Note: OpenVPN configuration requires certificates and keys
# Contact your administrator for the complete configuration file
# including CA certificate, client certificate, private key, and TLS auth key`;
    } else {
      fileName = `${user.username}.conf`;
      configText = `# Unknown protocol: ${user.server.protocol}`;
    }

    return NextResponse.json({
      success: true,
      fileName,
      configText,
    });
  } catch (error) {
    console.error('Failed to generate config:', error);
    return NextResponse.json(
      { error: 'Failed to generate configuration' },
      { status: 500 }
    );
  }
}

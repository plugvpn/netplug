import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get SMTP settings (get the first/only record)
    const smtpConfig = await prisma.smtpConfig.findFirst() as any;

    if (!smtpConfig) {
      return NextResponse.json({ smtp: null });
    }

    return NextResponse.json({
      smtp: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: smtpConfig.password,
        encryption: smtpConfig.encryption,
        fromName: smtpConfig.fromName,
        fromEmail: smtpConfig.fromEmail,
        enabled: smtpConfig.enabled,
      },
    });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SMTP settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { host, port, username, password, encryption, fromName, fromEmail, enabled } = body;

    // Validate required fields
    if (!host || !port || !username || !password || !fromName || !fromEmail) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if SMTP config exists
    const existingConfig = await prisma.smtpConfig.findFirst();

    let smtpConfig;
    if (existingConfig) {
      // Update existing config
      smtpConfig = await prisma.smtpConfig.update({
        where: { id: existingConfig.id },
        data: {
          host,
          port: parseInt(String(port)),
          username,
          password,
          encryption,
          fromName,
          fromEmail,
          enabled: enabled || false,
        },
      });
    } else {
      // Create new config
      smtpConfig = await prisma.smtpConfig.create({
        data: {
          host,
          port: parseInt(String(port)),
          username,
          password,
          encryption,
          fromName,
          fromEmail,
          enabled: enabled || false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'SMTP settings saved successfully',
    });
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    return NextResponse.json(
      { error: 'Failed to save SMTP settings' },
      { status: 500 }
    );
  }
}

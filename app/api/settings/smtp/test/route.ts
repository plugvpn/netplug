import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get SMTP settings
    const smtpConfig = await prisma.smtpConfig.findFirst() as any;

    if (!smtpConfig) {
      return NextResponse.json(
        { error: 'SMTP not configured. Please configure SMTP settings first.' },
        { status: 400 }
      );
    }

    if (!smtpConfig.enabled) {
      return NextResponse.json(
        { error: 'SMTP is disabled. Please enable it first.' },
        { status: 400 }
      );
    }

    // Create transporter
    const transportOptions: any = {
      host: smtpConfig.host,
      port: smtpConfig.port,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    };

    // Add encryption settings
    if (smtpConfig.encryption === 'TLS') {
      transportOptions.secure = false;
      transportOptions.requireTLS = true;
    } else if (smtpConfig.encryption === 'SSL') {
      transportOptions.secure = true;
    } else {
      transportOptions.secure = false;
    }

    const transporter = nodemailer.createTransport(transportOptions);

    // Send test email
    const user = session.user as any;
    const recipientEmail = user.email || smtpConfig.username;

    await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
      to: recipientEmail,
      subject: 'Test Email from NetPlug Dashboard',
      text: 'This is a test email from your NetPlug Dashboard SMTP configuration.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Test Email from NetPlug Dashboard</h2>
          <p>This is a test email to verify your SMTP configuration is working correctly.</p>
          <p>If you received this email, your SMTP settings are configured properly!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Sent from NetPlug Dashboard<br>
            SMTP Host: ${smtpConfig.host}:${smtpConfig.port}<br>
            Encryption: ${smtpConfig.encryption}<br>
            From: ${smtpConfig.fromEmail}
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${recipientEmail}`,
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}

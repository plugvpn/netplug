import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a new OTP secret
    const totp = new OTPAuth.TOTP({
      issuer: 'NetPlug Dashboard',
      label: (session.user as any).username || session.user.name || 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;
    const uri = totp.toString();

    // Generate QR code
    const qrCode = await QRCode.toDataURL(uri);

    return NextResponse.json({
      success: true,
      secret,
      qrCode,
    });
  } catch (error) {
    console.error('Error setting up OTP:', error);
    return NextResponse.json(
      { error: 'Failed to setup OTP' },
      { status: 500 }
    );
  }
}

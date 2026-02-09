import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as OTPAuth from 'otpauth';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code, secret } = body;

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    if (!secret) {
      return NextResponse.json(
        { error: 'No OTP setup in progress. Please start setup again.' },
        { status: 400 }
      );
    }

    const tempSecret = secret;

    // Verify the code
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(tempSecret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Enable OTP for the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        otpEnabled: true,
        otpSecret: tempSecret,
      },
    }) as any;

    return NextResponse.json({
      success: true,
      message: 'OTP enabled successfully',
    });
  } catch (error) {
    console.error('Error enabling OTP:', error);
    return NextResponse.json(
      { error: 'Failed to enable OTP' },
      { status: 500 }
    );
  }
}

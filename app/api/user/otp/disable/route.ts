import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Disable OTP for the user
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        otpEnabled: false,
        otpSecret: null,
      },
    }) as any;

    return NextResponse.json({
      success: true,
      message: 'OTP disabled successfully',
    });
  } catch (error) {
    console.error('Error disabling OTP:', error);
    return NextResponse.json(
      { error: 'Failed to disable OTP' },
      { status: 500 }
    );
  }
}

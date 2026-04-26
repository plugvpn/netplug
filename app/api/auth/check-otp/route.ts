import { NextResponse } from 'next/server';
import { validateUserCredentials } from '@/lib/credentials-verify';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const checked = await validateUserCredentials(
      typeof username === 'string' ? username : '',
      typeof password === 'string' ? password : '',
    );

    if (!checked.ok) {
      const status = checked.error.includes('required') ? 400 : 401;
      return NextResponse.json({ error: checked.error }, { status });
    }

    const user = checked.user;

    // Return whether OTP is required
    return NextResponse.json({
      requiresOtp: user.otpEnabled || false,
    });
  } catch (error) {
    console.error('Error checking OTP requirement:', error);
    return NextResponse.json(
      { error: 'Failed to check OTP requirement' },
      { status: 500 }
    );
  }
}

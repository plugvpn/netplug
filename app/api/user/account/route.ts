import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, email } = body;

    // Validate displayName
    if (displayName !== undefined && displayName !== null && displayName.trim().length > 0 && displayName.trim().length < 3) {
      return NextResponse.json(
        { error: 'Display name must be at least 3 characters long' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: displayName !== undefined ? (displayName.trim() || null) : undefined,
        email: email || undefined,
      },
    }) as any;

    return NextResponse.json({
      success: true,
      user: {
        displayName: updatedUser.displayName,
        email: updatedUser.email,
      },
    });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

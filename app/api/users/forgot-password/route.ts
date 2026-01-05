// app/api/users/forgot-password/route.ts
import { NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/auth';

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Request password reset (generates token)
  const result = await requestPasswordReset(email);

  if (!result.success) {
    const status = result.error === 'No user found with that email' ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Send email using Resend
  const { resend } = require('@/lib/email/resend');
  const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${result.token}`;
  const { error: emailError } = await resend.emails.send({
    from: `BirdHaus <${process.env.RESEND_FROM_EMAIL}>`,
    to: [email],
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #e0e7ef; padding: 32px;">
          <h2 style="color: #2563eb; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="font-size: 16px; color: #222; margin-bottom: 24px;">Hello ${result.userName || ''},</p>
          <p style="font-size: 15px; color: #444; margin-bottom: 24px;">
            We received a request to reset your password. Click the button below to set a new password. This link will expire in <strong>30 minutes</strong>.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; font-weight: 600; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 16px; margin-bottom: 24px;">Reset Password</a>
          <p style="font-size: 13px; color: #888; margin-top: 32px;">If you did not request a password reset, you can safely ignore this email.</p>
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7ef;" />
          <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} BirdHaus. All rights reserved.</p>
        </div>
      </div>
    `
  });

  if (emailError) {
    return NextResponse.json({ error: 'Failed to send reset email.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

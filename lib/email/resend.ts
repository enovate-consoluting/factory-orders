// lib/email/resend.ts
import { Resend } from 'resend';

// Handle missing API key gracefully during build
export const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface EmailData {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<any>;
}
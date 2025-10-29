// lib/email/resend.ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailData {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<any>;  // Fixed: Added <any> type argument
}
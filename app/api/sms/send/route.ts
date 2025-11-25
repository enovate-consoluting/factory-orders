/**
 * SMS Send API - Multi-Provider Support
 * Supports: Textbelt, AWS SNS, Twilio
 * Switch via SMS_PROVIDER env variable or database config
 * POST /api/sms/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// ========================================
// PROVIDER: TEXTBELT (Recommended - Simple!)
// ========================================
async function sendViaTextbelt(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const apiKey = process.env.TEXTBELT_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'Textbelt API key not configured' };
    }

    // Clean phone number
    let cleanPhone = to.replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
        cleanPhone = '+' + cleanPhone;
      } else if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    const response = await fetch('https://textbelt.com/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
        key: apiKey,
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('[Textbelt] SMS sent:', { to: cleanPhone, textId: result.textId });
      return { success: true, messageId: result.textId };
    } else {
      console.error('[Textbelt] Error:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('[Textbelt] Error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// PROVIDER: AWS SNS
// ========================================
async function sendViaSNS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    // Clean phone number - ensure it has country code
    let cleanPhone = to.replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
        cleanPhone = '+' + cleanPhone;
      } else if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    const command = new PublishCommand({
      PhoneNumber: cleanPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });

    const result = await snsClient.send(command);
    console.log('[AWS SNS] SMS sent:', { to: cleanPhone, messageId: result.MessageId });
    
    return { success: true, messageId: result.MessageId };
  } catch (error: any) {
    console.error('[AWS SNS] Error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// PROVIDER: TWILIO
// ========================================
async function sendViaTwilio(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return { success: false, error: 'Twilio credentials not configured' };
    }

    // Clean phone number
    let cleanPhone = to.replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('1') && cleanPhone.length === 11) {
        cleanPhone = '+' + cleanPhone;
      } else if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      } else {
        cleanPhone = '+' + cleanPhone;
      }
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: cleanPhone,
        From: fromNumber,
        Body: message,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('[Twilio] SMS sent:', { to: cleanPhone, sid: result.sid });
      return { success: true, messageId: result.sid };
    } else {
      console.error('[Twilio] Error:', result);
      return { success: false, error: result.message || 'Twilio error' };
    }
  } catch (error: any) {
    console.error('[Twilio] Error:', error);
    return { success: false, error: error.message };
  }
}

// ========================================
// MAIN HANDLER
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing "to" or "message" field' },
        { status: 400 }
      );
    }

    // Get provider from env (default to textbelt - most reliable)
    // Options: 'textbelt', 'aws', 'twilio'
    const provider = (process.env.SMS_PROVIDER || 'textbelt').toLowerCase();
    
    console.log(`[SMS] Using provider: ${provider}`);

    let result;

    switch (provider) {
      case 'twilio':
        result = await sendViaTwilio(to, message);
        break;
      case 'aws':
      case 'sns':
        result = await sendViaSNS(to, message);
        break;
      case 'textbelt':
      default:
        result = await sendViaTextbelt(to, message);
        break;
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully',
        messageId: result.messageId,
        provider: provider,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error, provider: provider },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('[SMS] API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
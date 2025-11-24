// /app/api/sms/send/route.ts
// SMS Sending API using Twilio
// Created: November 2025

import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

export async function POST(request: NextRequest) {
  console.log('=== SMS Send API Called ===');
  
  try {
    // Check for Twilio credentials
    if (!accountSid || !authToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      return NextResponse.json(
        { 
          success: false, 
          error: 'SMS service not configured. Missing Twilio credentials.' 
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { 
      to,           // Phone number to send to (required)
      message,      // SMS message text (required)
      invoiceNumber,// Optional - for logging
      invoiceId,    // Optional - for logging
    } = body;

    console.log('SMS Request:', { 
      to, 
      messageLength: message?.length,
      invoiceNumber 
    });

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Format phone number (ensure it has country code)
    let formattedPhone = to.replace(/[^\d+]/g, ''); // Remove non-digits except +
    if (!formattedPhone.startsWith('+')) {
      // Assume US number if no country code
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }

    console.log('Formatted phone:', formattedPhone);

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Send SMS
    const smsResult = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    console.log('SMS sent successfully:', {
      sid: smsResult.sid,
      status: smsResult.status,
      to: smsResult.to,
    });

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully',
      data: {
        sid: smsResult.sid,
        status: smsResult.status,
        to: smsResult.to,
        dateSent: smsResult.dateCreated,
      }
    });

  } catch (error: any) {
    console.error('SMS Send Error:', error);

    // Handle specific Twilio errors
    if (error.code) {
      let errorMessage = 'Failed to send SMS';
      
      switch (error.code) {
        case 21211:
          errorMessage = 'Invalid phone number format';
          break;
        case 21214:
          errorMessage = 'Phone number is not a valid mobile number';
          break;
        case 21608:
          errorMessage = 'The phone number is unverified. Trial accounts can only send to verified numbers.';
          break;
        case 21610:
          errorMessage = 'This phone number has been blocked from receiving messages';
          break;
        case 21612:
          errorMessage = 'The phone number is not reachable';
          break;
        case 20003:
          errorMessage = 'Authentication failed. Check Twilio credentials.';
          break;
        default:
          errorMessage = error.message || 'Failed to send SMS';
      }

      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          code: error.code 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to send SMS' 
      },
      { status: 500 }
    );
  }
}
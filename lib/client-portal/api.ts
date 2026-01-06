/**
 * Client Portal API Integration
 * Handles syncing client data from Factory Orders to Client Portal
 * Replaces Scanacart integration
 * Last Modified: January 2025
 */

const CLIENT_PORTAL_API_URL = process.env.CLIENT_PORTAL_API_URL || '';
const FACTORY_SYNC_API_KEY = process.env.FACTORY_SYNC_API_KEY || '';

interface ClientPortalClientData {
  name: string;
  email: string;
  phone_number?: string;
  logo_url?: string | null;
}

interface ClientPortalResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Sync a client to the Client Portal system
 * Called when a client is created in Factory Orders
 * @param clientData - Client information (name, email, phone_number, logo_url)
 * @returns Promise with API response
 */
export async function syncClientToPortal(
  clientData: ClientPortalClientData
): Promise<ClientPortalResponse> {
  // Debug: Log env var status
  console.log('Portal Sync Debug:', {
    hasUrl: !!CLIENT_PORTAL_API_URL,
    urlValue: CLIENT_PORTAL_API_URL ? CLIENT_PORTAL_API_URL.substring(0, 30) + '...' : 'NOT SET',
    hasApiKey: !!FACTORY_SYNC_API_KEY,
    apiKeyPrefix: FACTORY_SYNC_API_KEY ? FACTORY_SYNC_API_KEY.substring(0, 10) + '...' : 'NOT SET'
  });

  // Check if API URL is configured
  if (!CLIENT_PORTAL_API_URL) {
    console.warn('CLIENT_PORTAL_API_URL not configured - skipping client sync');
    return {
      success: false,
      error: 'CLIENT_PORTAL_API_URL not configured',
    };
  }

  try {
    const requestBody = {
      name: clientData.name,
      email: clientData.email,
      phone_number: clientData.phone_number || null,
      logo_url: clientData.logo_url || null,
      source: 'factory_orders', // Identify where this client came from
    };

    console.log('Syncing client to Portal:', {
      url: `${CLIENT_PORTAL_API_URL}/api/sync-client`,
      name: clientData.name,
      email: clientData.email
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (FACTORY_SYNC_API_KEY) {
      headers['X-API-Key'] = FACTORY_SYNC_API_KEY;
    }

    const response = await fetch(`${CLIENT_PORTAL_API_URL}/api/sync-client`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Client Portal API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      return {
        success: false,
        error: `Client Portal API returned ${response.status}: ${response.statusText}`,
        message: errorText,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error syncing client to Portal:', error);

    return {
      success: false,
      error: error.message || 'Failed to communicate with Client Portal API',
    };
  }
}

/**
 * Test connection to Client Portal API
 * @returns Promise<boolean> - true if API is reachable
 */
export async function testClientPortalConnection(): Promise<boolean> {
  if (!CLIENT_PORTAL_API_URL) {
    return false;
  }

  try {
    const headers: Record<string, string> = {};
    if (FACTORY_SYNC_API_KEY) {
      headers['X-API-Key'] = FACTORY_SYNC_API_KEY;
    }

    const response = await fetch(`${CLIENT_PORTAL_API_URL}/api/health`, {
      method: 'GET',
      headers,
    });
    return response.ok;
  } catch (error) {
    console.error('Client Portal API connection test failed:', error);
    return false;
  }
}

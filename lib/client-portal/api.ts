/**
 * Client Portal API Integration
 * Handles syncing client data from Factory Orders to Client Portal
 * Replaces Scanacart integration
 * Last Modified: January 2025
 */

// Read env vars inside functions to ensure they're available in serverless
function getPortalUrl(): string {
  return process.env.CLIENT_PORTAL_API_URL || '';
}

function getApiKey(): string {
  return process.env.FACTORY_SYNC_API_KEY || '';
}

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
  const portalUrl = getPortalUrl();
  const apiKey = getApiKey();

  // Check if API URL is configured
  if (!portalUrl) {
    console.warn('CLIENT_PORTAL_API_URL not configured - skipping client sync');
    return {
      success: false,
      error: 'CLIENT_PORTAL_API_URL not configured',
    };
  }

  try {
    const requestBody = {
      name: clientData.name,
      contact_name: clientData.name, // Use company name as contact name
      email: clientData.email,
      phone_number: clientData.phone_number || null,
      logo_url: clientData.logo_url || null,
      source: 'factory_orders', // Identify where this client came from
    };

    console.log('Syncing client to Portal:', {
      url: `${portalUrl}/api/sync-client`,
      name: clientData.name,
      email: clientData.email
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key if configured
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(`${portalUrl}/api/sync-client`, {
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
  const portalUrl = getPortalUrl();
  const apiKey = getApiKey();

  if (!portalUrl) {
    return false;
  }

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    const response = await fetch(`${portalUrl}/api/health`, {
      method: 'GET',
      headers,
    });
    return response.ok;
  } catch (error) {
    console.error('Client Portal API connection test failed:', error);
    return false;
  }
}

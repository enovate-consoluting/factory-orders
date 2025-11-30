/**
 * Scanacart API Integration
 * Handles communication with Scanacart API for client management
 */

const SCANACART_API_URL = 'https://apiv2.scanacart.com/index.cfm';
const SCANACART_ENDPOINT = '/scanacartClient';

interface ScanacartClientData {
  company_name: string;
  email: string;
  password: string;
  phone?: string;
  logo?: string | null; // Base64 encoded logo or URL
}

interface ScanacartResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Convert base64 to Blob with file info
 */
function base64ToBlob(base64: string): { blob: Blob; extension: string } {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  // Extract file extension from content type
  const extension = contentType.split('/')[1] || 'png';

  return {
    blob: new Blob([uInt8Array], { type: contentType }),
    extension,
  };
}

/**
 * Generate filename from company name
 * Takes first word, converts to lowercase, removes special characters
 */
function generateFilename(companyName: string, extension: string): string {
  // Get first word from company name
  const firstWord = companyName.trim().split(/\s+/)[0];

  // Convert to lowercase and remove special characters
  const sanitized = firstWord
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  // Fallback to 'logo' if sanitization results in empty string
  const filename = sanitized || 'logo';

  return `${filename}.${extension}`;
}

/**
 * Create a client in Scanacart system
 * @param clientData - Client information (company_name, email, password, phone, logo)
 * @returns Promise with API response
 */
export async function createScanacartClient(
  clientData: ScanacartClientData
): Promise<ScanacartResponse> {
  try {
    // If logo is provided, use FormData for multipart upload
    if (clientData.logo) {
      const formData = new FormData();
      formData.append('company_name', clientData.company_name);
      formData.append('email', clientData.email);
      formData.append('password', clientData.password);

      // Add phone if provided
      if (clientData.phone) {
        formData.append('phone', clientData.phone);
      }

      // Convert base64 to Blob and append as file
      const { blob, extension } = base64ToBlob(clientData.logo);
      const filename = generateFilename(clientData.company_name, extension);
      formData.append('logo', blob, filename);

      const response = await fetch(
        `${SCANACART_API_URL}?endpoint=${encodeURIComponent(SCANACART_ENDPOINT)}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Scanacart API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        return {
          success: false,
          error: `Scanacart API returned ${response.status}: ${response.statusText}`,
          message: errorText,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    }

    // If no logo, use JSON
    const requestBody: any = {
      company_name: clientData.company_name,
      email: clientData.email,
      password: clientData.password,
    };

    // Add phone if provided
    if (clientData.phone) {
      requestBody.phone = clientData.phone;
    }

    const response = await fetch(
      `${SCANACART_API_URL}?endpoint=${encodeURIComponent(SCANACART_ENDPOINT)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    // Check if response is ok (status 200-299)
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scanacart API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });

      return {
        success: false,
        error: `Scanacart API returned ${response.status}: ${response.statusText}`,
        message: errorText,
      };
    }

    // Parse response
    const data = await response.json();

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('Error calling Scanacart API:', error);

    return {
      success: false,
      error: error.message || 'Failed to communicate with Scanacart API',
    };
  }
}

/**
 * Test connection to Scanacart API
 * @returns Promise<boolean> - true if API is reachable
 */
export async function testScanacartConnection(): Promise<boolean> {
  try {
    const response = await fetch(SCANACART_API_URL, {
      method: 'HEAD',
    });
    return response.ok;
  } catch (error) {
    console.error('Scanacart API connection test failed:', error);
    return false;
  }
}

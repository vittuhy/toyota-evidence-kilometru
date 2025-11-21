const crypto = require('crypto');
const { randomUUID } = require('crypto');

// Helper function to generate HMAC SHA256 (like pytoyoda)
function generateHmacSha256(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

const CLIENT_VERSION = '2.14.0';

// Using Node.js built-in fetch (Node 18+) or require node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch');
  }
} catch (e) {
  // Fallback if node-fetch not available
  fetch = async (url, options) => {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(data),
            text: async () => data,
            headers: res.headers
          });
        });
      });
      req.on('error', reject);
      if (options?.body) req.write(options.body);
      req.end();
    });
  };
}

// Load credentials from file for local development
function loadCredentialsFromFile() {
  try {
    const fs = require('fs');
    const path = require('path');
    // Try to load from pytoyoda/sandbox/credentials.json
    const credentialsPath = path.join(__dirname, '../../../pytoyoda/sandbox/credentials.json');
    if (fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      console.log('✓ Loaded credentials from file for local development');
      return credentials;
    }
  } catch (error) {
    console.log('Could not load credentials from file:', error.message);
  }
  return null;
}

// Toyota API authentication and mileage fetching
async function fetchToyotaMileage() {
  // Try to load from file first (for local development)
  const fileCredentials = loadCredentialsFromFile();
  const username = fileCredentials?.username || process.env.TOYOTA_USERNAME;
  const password = fileCredentials?.password || process.env.TOYOTA_PASSWORD;
  
  if (!username || !password) {
    throw new Error('Toyota credentials not configured. Please set TOYOTA_USERNAME and TOYOTA_PASSWORD in Netlify environment variables, or provide credentials.json file.');
  }

  try {
    // Step 1: Initial authentication request
    const authUrl = 'https://b2c-login.toyota-europe.com/json/realms/root/realms/tme/authenticate?authIndexType=service&authIndexValue=oneapp';
    
    let authData = {};
    let tokenId = null;
    
    // Authentication loop (up to 10 attempts)
    for (let attempt = 0; attempt < 10; attempt++) {
      // Handle callbacks
      if (authData.callbacks) {
        for (const cb of authData.callbacks) {
          if (cb.type === 'NameCallback' && cb.output?.[0]?.value === 'User Name') {
            cb.input[0].value = username;
          } else if (cb.type === 'PasswordCallback') {
            cb.input[0].value = password;
          } else if (cb.type === 'ChoiceCallback' && cb.output?.[0]?.value === 'Prompt') {
            cb.input[0].value = 0; // Default choice
          }
        }
      }
      
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authData),
      });
      
      if (!authResponse.ok) {
        throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
      }
      
      authData = await authResponse.json();
      
      if (authData.tokenId) {
        tokenId = authData.tokenId;
        break;
      }
      
      // Check for errors
      if (authData.callbacks) {
        const errorCallback = authData.callbacks.find(
          cb => cb.type === 'TextOutputCallback' && cb.output?.[0]?.value === 'User Not Found'
        );
        if (errorCallback) {
          throw new Error('Authentication failed: User not found. Please check your credentials.');
        }
      }
    }
    
    if (!tokenId) {
      throw new Error('Authentication failed: Could not obtain token after multiple attempts.');
    }
    
    // Step 2: Authorization
    const authorizeUrl = 'https://b2c-login.toyota-europe.com/oauth2/realms/root/realms/tme/authorize?client_id=oneapp&scope=openid+profile+write&response_type=code&redirect_uri=com.toyota.oneapp:/oauth2Callback&code_challenge=plain&code_challenge_method=plain';
    
    const authzResponse = await fetch(authorizeUrl, {
      method: 'GET',
      headers: {
        'Cookie': `iPlanetDirectoryPro=${tokenId}`,
      },
      redirect: 'manual',
    });
    
    if (authzResponse.status !== 302) {
      throw new Error(`Authorization failed: ${authzResponse.status}`);
    }
    
    const location = authzResponse.headers.get('location');
    if (!location) {
      throw new Error('Authorization failed: No redirect location');
    }
    
    const locationUrl = new URL(location);
    const authCode = locationUrl.searchParams.get('code');
    if (!authCode) {
      throw new Error('Authorization failed: No authorization code');
    }
    
    // Step 3: Get access token
    const tokenUrl = 'https://b2c-login.toyota-europe.com/oauth2/realms/root/realms/tme/access_token';
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic b25lYXBwOm9uZWFwcA==',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'com.toyota.oneapp:/oauth2Callback',
        code_verifier: 'plain',
      }).toString(),
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token retrieval failed: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      throw new Error('Token retrieval failed: No access token received');
    }
    
    // Extract GUID from JWT token (decode without verification)
    let userGuid = null;
    try {
      const jwtParts = accessToken.split('.');
      if (jwtParts.length >= 2) {
        const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
        userGuid = payload.uuid || payload.sub;
      }
    } catch (e) {
      console.warn('Could not extract GUID from token:', e.message);
    }
    
    if (!userGuid) {
      throw new Error('Could not extract user GUID from access token');
    }
    
    // Step 4: Get vehicle GUID
    const guidUrl = 'https://ctpa-oneapi.tceu-ctp-prd.toyotaconnectedeurope.io/v2/vehicle/guid';
    const clientRef = generateHmacSha256(CLIENT_VERSION, userGuid);
    const correlationId = randomUUID();
    
    const guidResponse = await fetch(guidUrl, {
      method: 'GET',
      headers: {
        'x-api-key': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'api_key': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'API_KEY': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'x-guid': userGuid,
        'guid': userGuid,
        'x-client-ref': clientRef,
        'x-correlationid': correlationId,
        'x-channel': 'ONEAPP',
        'x-brand': 'T',
        'x-region': 'EU',
        'x-appversion': CLIENT_VERSION,
        'authorization': `Bearer ${accessToken}`,
        'user-agent': 'okhttp/4.10.0',
      },
    });
    
    if (!guidResponse.ok) {
      throw new Error(`Failed to get vehicles: ${guidResponse.status}`);
    }
    
    const guidData = await guidResponse.json();
    const vehicles = guidData.payload || [];
    
    if (vehicles.length === 0) {
      throw new Error('No vehicles found in account');
    }
    
    const vehicle = vehicles[0];
    const vin = vehicle.vin;
    
    // Step 5: Get telemetry (mileage)
    const telemetryCorrelationId = randomUUID();
    const telemetryUrl = 'https://ctpa-oneapi.tceu-ctp-prd.toyotaconnectedeurope.io/v3/telemetry';
    const telemetryResponse = await fetch(telemetryUrl, {
      method: 'GET',
      headers: {
        'x-api-key': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'api_key': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'API_KEY': 'tTZipv6liF74PwMfk9Ed68AQ0bISswwf3iHQdqcF',
        'x-guid': userGuid,
        'guid': userGuid,
        'x-client-ref': clientRef,
        'x-correlationid': telemetryCorrelationId,
        'x-channel': 'ONEAPP',
        'x-brand': 'T',
        'x-region': 'EU',
        'x-appversion': CLIENT_VERSION,
        'authorization': `Bearer ${accessToken}`,
        'vin': vin,
        'user-agent': 'okhttp/4.10.0',
      },
    });
    
    if (!telemetryResponse.ok) {
      throw new Error(`Failed to get telemetry: ${telemetryResponse.status}`);
    }
    
    const telemetryData = await telemetryResponse.json();
    
    if (!telemetryData.payload || !telemetryData.payload.odometer) {
      throw new Error('Odometer data not available');
    }
    
    const odometer = telemetryData.payload.odometer;
    let mileageKm = odometer.value;
    
    // Convert to km if needed
    if (odometer.unit && (odometer.unit.toLowerCase() === 'miles' || odometer.unit.toLowerCase() === 'mi')) {
      mileageKm = odometer.value * 1.60934;
    }
    
    return {
      success: true,
      mileage: Math.round(mileageKm),
      unit: 'km',
      vin: vin,
      vehicle: vehicle.displayModelDescription || vehicle.modelName || 'Toyota Vehicle',
    };
    
  } catch (error) {
    console.error('Toyota API Error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event) => {
  console.log('Fetch mileage function called');
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ 
        success: false,
        error: 'Method not allowed' 
      }),
    };
  }
  
  try {
    const mileageData = await fetchToyotaMileage();
    
    if (!mileageData.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ 
          success: false,
          error: mileageData.error || 'Failed to fetch mileage'
        }),
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({
        success: true,
        mileage: mileageData.mileage,
        unit: mileageData.unit,
        vin: mileageData.vin,
        vehicle: mileageData.vehicle,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: error.message
      }),
    };
  }
};

const https = require('https');
const jwt = require('jsonwebtoken');

const SHEET_ID = '1QvIQpN0Yr4dee1aNf3_ubwyWpWCIULfRWOOAqWAmywM'; // Your sheet ID
const SHEET_NAME = 'Sheet1'; // Change if your sheet/tab is named differently

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function getAccessToken() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const token = jwt.sign(payload, creds.private_key, { algorithm: 'RS256' });
  
  const tokenResponse = await makeRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`
  });
  
  return tokenResponse.data.access_token;
}

async function makeGoogleRequest(endpoint, method = 'GET', body = null) {
  const accessToken = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await makeRequest(url, options);
  if (response.status >= 400) {
    throw new Error(`Google API error: ${response.status}`);
  }
  
  return response.data;
}

async function getRows() {
  const response = await makeGoogleRequest(`/values/${SHEET_NAME}!A2:D`);
  const rows = response.values || [];
  return rows.map(([id, date, totalKm, createdAt]) => ({
    id: Number(id),
    date,
    totalKm: Number(totalKm),
    createdAt,
  }));
}

async function appendRow(record) {
  await makeGoogleRequest(`/values/${SHEET_NAME}!A:D:append`, 'POST', {
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    data: [{
      range: `${SHEET_NAME}!A:D`,
      values: [[record.id, record.date, record.totalKm, record.createdAt]]
    }]
  });
}

async function updateRow(id, newData) {
  const rows = await getRows();
  const rowIndex = rows.findIndex(r => r.id === id);
  if (rowIndex === -1) return false;
  
  const rowNumber = rowIndex + 2; // +2 because of header and 0-index
  await makeGoogleRequest(`/values/${SHEET_NAME}!A${rowNumber}:D${rowNumber}`, 'PUT', {
    valueInputOption: 'RAW',
    data: [{
      range: `${SHEET_NAME}!A${rowNumber}:D${rowNumber}`,
      values: [[id, newData.date, newData.totalKm, newData.createdAt]]
    }]
  });
  return true;
}

async function deleteRow(id) {
  const rows = await getRows();
  const rowIndex = rows.findIndex(r => r.id === id);
  if (rowIndex === -1) return false;
  
  const rowNumber = rowIndex + 2; // +2 for header
  await makeGoogleRequest('', 'POST', {
    requests: [{
      deleteDimension: {
        range: {
          sheetId: 0, // Default first sheet
          dimension: 'ROWS',
          startIndex: rowNumber - 1,
          endIndex: rowNumber,
        },
      },
    }]
  });
  return true;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  console.log('Function called with event:', JSON.stringify(event, null, 2));
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  try {
    const { path: requestPath, httpMethod, body } = event;
    const endpoint = requestPath.replace('/.netlify/functions/api', '');
    console.log('Processing endpoint:', endpoint, 'with method:', httpMethod);

    // Health check
    if (endpoint === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }),
      };
    }

    // GET all records
    if (endpoint === '/records' && httpMethod === 'GET') {
      const rows = await getRows();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(rows),
      };
    }

    // POST create record
    if (endpoint === '/records' && httpMethod === 'POST') {
      const { date, totalKm } = JSON.parse(body);
      if (!date || !totalKm) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'Date and totalKm are required' }),
        };
      }
      const newRecord = {
        id: Date.now(),
        date,
        totalKm: Number(totalKm),
        createdAt: new Date().toISOString(),
      };
      await appendRow(newRecord);
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(newRecord),
      };
    }

    // PUT update record
    const putMatch = endpoint.match(/^\/records\/(\d+)$/);
    if (putMatch && httpMethod === 'PUT') {
      const id = Number(putMatch[1]);
      const { date, totalKm } = JSON.parse(body);
      if (!date || !totalKm) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'Date and totalKm are required' }),
        };
      }
      const updated = await updateRow(id, {
        date,
        totalKm: Number(totalKm),
        createdAt: new Date().toISOString(),
      });
      if (!updated) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'Record not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ id, date, totalKm: Number(totalKm), createdAt: new Date().toISOString() }),
      };
    }

    // DELETE record
    const delMatch = endpoint.match(/^\/records\/(\d+)$/);
    if (delMatch && httpMethod === 'DELETE') {
      const id = Number(delMatch[1]);
      const deleted = await deleteRow(id);
      if (!deleted) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'Record not found' }),
        };
      }
      return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    // 404 fallback
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Endpoint not found' }),
    };
  } catch (error) {
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message,
        stack: error.stack 
      }),
    };
  }
}; 
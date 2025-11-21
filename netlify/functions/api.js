const { google } = require('googleapis');

const SHEET_ID = '1QvIQpN0Yr4dee1aNf3_ubwyWpWCIULfRWOOAqWAmywM'; // Your sheet ID
const SHEET_NAME = 'Sheet1'; // Change if your sheet/tab is named differently

function getDoc() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getRows() {
  const sheets = getDoc();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:E`, // Updated to include source column
  });
  
  const rows = response.data.values || [];
  return rows.map(([id, date, totalKm, createdAt, source]) => ({
    id: Number(id),
    date,
    totalKm: Number(totalKm),
    createdAt,
    source: source || 'manual', // Default to 'manual' for backward compatibility
  }));
}

async function appendRow(record) {
  const sheets = getDoc();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:E`, // Updated to include source column
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[record.id, record.date, record.totalKm, record.createdAt, record.source || 'manual']]
    },
  });
}

async function updateRow(id, newData) {
  const rows = await getRows();
  const rowIndex = rows.findIndex(r => r.id === id);
  if (rowIndex === -1) return false;
  
  const rowNumber = rowIndex + 2; // +2 because of header and 0-index
  const sheets = getDoc();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowNumber}:E${rowNumber}`, // Updated to include source column
    valueInputOption: 'RAW',
    requestBody: {
      values: [[id, newData.date, newData.totalKm, newData.createdAt, newData.source || 'manual']]
    },
  });
  return true;
}

async function deleteRow(id) {
  const rows = await getRows();
  const rowIndex = rows.findIndex(r => r.id === id);
  if (rowIndex === -1) return false;
  
  const rowNumber = rowIndex + 2; // +2 for header
  const sheets = getDoc();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0, // Default first sheet
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      }],
    },
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
      const { date, totalKm, source } = JSON.parse(body);
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
        source: source || 'manual', // Default to 'manual' if not provided
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
      const { date, totalKm, source } = JSON.parse(body);
      if (!date || !totalKm) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({ error: 'Date and totalKm are required' }),
        };
      }
      const row = await getRows();
      const existingRecord = row.find(r => r.id === id);
      const updated = await updateRow(id, {
        date,
        totalKm: Number(totalKm),
        createdAt: new Date().toISOString(),
        source: source || existingRecord?.source || 'manual', // Preserve existing source if not provided
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
        body: JSON.stringify({ id, date, totalKm: Number(totalKm), createdAt: new Date().toISOString(), source: source || existingRecord?.source || 'manual' }),
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
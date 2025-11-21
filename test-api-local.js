/**
 * Local test script for Toyota API mileage fetch
 * Uses credentials.json from pytoyoda/sandbox directory
 */

const path = require('path');
const fs = require('fs');

// Load credentials from pytoyoda
const credentialsPath = path.join(__dirname, '../pytoyoda/sandbox/credentials.json');

let credentials;
try {
  const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
  credentials = JSON.parse(credentialsContent);
  console.log('✓ Loaded credentials from:', credentialsPath);
} catch (error) {
  console.error('✗ Could not load credentials.json:', error.message);
  console.error('  Expected path:', credentialsPath);
  process.exit(1);
}

// Set environment variables for testing
process.env.TOYOTA_USERNAME = credentials.username;
process.env.TOYOTA_PASSWORD = credentials.password;

// Import and run the fetch-mileage function
const fetchMileage = require('./netlify/functions/fetch-mileage');

// Create a mock event
const mockEvent = {
  httpMethod: 'POST',
  headers: {},
};

console.log('\n🧪 Testing Toyota API mileage fetch...\n');
console.log('Username:', credentials.username);
console.log('Password:', '***' + credentials.password.slice(-3));
console.log('\n');

// Call the handler
fetchMileage.handler(mockEvent)
  .then((response) => {
    console.log('\n📊 Response Status:', response.statusCode);
    console.log('📦 Response Body:');
    const body = JSON.parse(response.body);
    console.log(JSON.stringify(body, null, 2));
    
    if (body.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`   Mileage: ${body.mileage.toLocaleString()} ${body.unit}`);
      console.log(`   Vehicle: ${body.vehicle}`);
      console.log(`   VIN: ${body.vin}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(`   Error: ${body.error}`);
    }
  })
  .catch((error) => {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  });



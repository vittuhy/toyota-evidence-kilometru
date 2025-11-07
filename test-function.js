const https = require('https');

// Replace with your actual Netlify site URL
const SITE_URL = 'https://your-site-name.netlify.app';

function testFunction() {
  const url = `${SITE_URL}/.netlify/functions/api/health`;
  
  https.get(url, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
}

testFunction(); 
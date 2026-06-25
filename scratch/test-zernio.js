const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/ZERNIO_API_KEY=(.+)/);
const apiKey = match[1].trim();

async function checkLinkedAccounts() {
  const url = 'https://zernio.com/api/v1/accounts';
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    console.log("Connected accounts data:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}
checkLinkedAccounts();

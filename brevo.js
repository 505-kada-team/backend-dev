// Jalankan langsung: node test-brevo.js
// Tujuan: isolasi masalah pengiriman email dari logic Express/controller kamu

require('dotenv').config(); // sesuaikan kalau env loading kamu beda
const { BrevoClient } = require('@getbrevo/brevo');

// GANTI dengan cara kamu load config, atau hardcode sementara untuk test
const apiKey = process.env.BREVO_API_KEY; // sesuaikan nama env var kamu
const fromEmail = process.env.SMTP_USER; // sesuaikan
const fromName = process.env.SMTP_FROM_NAME || 'Test Sender';
const toEmail = 'GANTI-DENGAN-EMAIL-KAMU-SENDIRI@gmail.com'; // ganti manual

console.log('=== DEBUG INFO ===');
console.log('API Key ada?:', !!apiKey);
console.log('API Key length:', apiKey?.length);
console.log('API Key prefix:', apiKey?.substring(0, 10)); // harusnya "xkeysib-"
console.log('From Email:', fromEmail);
console.log('==================\n');

const brevo = new BrevoClient({ apiKey });

async function testSend() {
  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: toEmail }],
      subject: 'Test dari script diagnostik',
      htmlContent: '<p>Kalau kamu terima email ini, berarti API key & sender OK.</p>',
    });
    console.log('✅ SUKSES - Response dari Brevo:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.log('❌ GAGAL - Error tertangkap:');
    console.log('Error name:', err.constructor.name);
    console.log('Error message:', err.message);
    if (err.rawResponse) {
      console.log('Status HTTP:', err.rawResponse.status);
    }
    console.log('Full error:', err);
  }
}

testSend();

'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const emailService = require('../services/emailService');

async function testSendGridDelivery() {
  const apiKey = (process.env.SENDGRID_API_KEY || '').trim();
  const from = (process.env.EMAIL_FROM || '').trim();

  console.log('--- SendGrid Delivery Test ---');
  console.log('API Key configured:', apiKey && apiKey !== 'your_sendgrid_api_key' ? 'YES (SG.***)' : 'NO / PLACEHOLDER');
  console.log('Sender Address:', from);
  console.log('Recipient Address: 310624104006@eec.srmrmp.edu.in');

  if (!apiKey || apiKey === 'your_sendgrid_api_key') {
    console.log('\n[Result]: SENDGRID_API_KEY is not set or using placeholder.');
    console.log('Please set your active SendGrid API key in server/.env (SENDGRID_API_KEY=SG.xxx).');
    return;
  }

  const result = await emailService.sendOtpEmail({
    to: '310624104006@eec.srmrmp.edu.in',
    otp: '582914',
    purpose: 'registration',
    expirySeconds: 30,
  });

  console.log('\n--- Delivery Result ---');
  console.log('Accepted:', result.accepted);
  if (result.accepted) {
    console.log('Message ID:', result.messageId);
    console.log('Status: Email accepted by SendGrid for delivery.');
  } else {
    console.log('Error:', result.error);
    if (result.rawError) {
      console.log('Raw Error Details:', result.rawError);
    }
  }
}

testSendGridDelivery()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err.message);
    process.exit(1);
  });

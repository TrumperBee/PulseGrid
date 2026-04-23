const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

const RESEND_API_KEY = 're_Hy1TH7nk_EhqPzuus64koJmTbnqvGKebr'; // Replace with your key or use functions.config()

exports.sendAlertEmail = functions.firestore
  .document('email_queue/{emailId}')
  .onCreate(async (snap, context) => {
    const emailData = snap.data();
    
    if (!emailData.to || !emailData.subject) {
      console.log('Missing required fields');
      return;
    }

    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: 'PulseGrid Alerts <alerts@resend.dev>',
          to: recipients,
          subject: emailData.subject,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background: #050508; color: #E8E8F0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #0D0D18; border-radius: 12px; padding: 30px; }
                .header { color: #00F5FF; font-size: 24px; margin-bottom: 20px; }
                .alert { padding: 15px; border-radius: 8px; margin: 15px 0; }
                .down { background: rgba(255, 51, 102, 0.2); border-left: 4px solid #FF3366; }
                .up { background: rgba(57, 255, 20, 0.2); border-left: 4px solid #39FF14; }
                .details { margin-top: 20px; padding-top: 20px; border-top: 1px solid #1A1A2E; }
                .btn { display: inline-block; background: #00F5FF; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">🚨 PulseGrid Alert</div>
                <div class="alert ${emailData.eventType === 'down' ? 'down' : 'up'}">
                  <strong>${emailData.eventType === 'down' ? 'Monitor Down!' : 'Monitor Recovered!'}</strong>
                </div>
                <p><strong>Monitor:</strong> ${emailData.monitorName || 'Unknown'}</p>
                <p><strong>URL:</strong> ${emailData.monitorUrl || 'Unknown'}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <div class="details">
                  <a href="https://pulsegrid.vercel.app" class="btn">View in PulseGrid</a>
                </div>
              </div>
            </body>
            </html>
          `
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          }
        }
      );

      // Update email status
      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        resendId: response.data.id
      });

      console.log('Email sent:', response.data.id);
    } catch (error) {
      console.error('Error sending email:', error.response?.data || error.message);
      
      // Update email status
      await snap.ref.update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

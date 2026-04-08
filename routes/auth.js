const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Google Client Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Route 1: Login Page (Trigger)
router.get('/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Refresh token ke liye
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(authUrl); // User ko Google login page par bhej dega
});

// Route 2: Callback (Google login hone ke baad wapas aane ki jagah)
router.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // User ki email id nikalo
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Token ko main server.js ke DB mein save karo
    req.app.locals.userAccountsDB[email] = tokens;
    
    const totalAccounts = Object.keys(req.app.locals.userAccountsDB).length;

    res.send(`
      <h3>Account Linked: ${email}</h3>
      <p>Total Linked Accounts: <b>${totalAccounts}</b></p>
      <a href="/auth/login">Link Another Account</a>
    `);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).send('Login mein problem aayi!');
  }
});

module.exports = router;

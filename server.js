require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Frontend ko backend se baat karne ki permission dena
app.use(cors());
app.use(express.json());

// 30 Accounts save karne ka temporary database
app.locals.userAccountsDB = {}; 

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email'
];

// 1. Google Login Route
app.get('/auth/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// 2. Google Callback (Login hone ke baad)
app.get('/auth/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    req.app.locals.userAccountsDB[email] = tokens;
    
    // Login successful hone par wapas aapki website par bhej dega
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: green;">Account Linked: ${email}</h2>
        <p>Total Linked Accounts: ${Object.keys(req.app.locals.userAccountsDB).length}</p>
        <a href="https://hackerdam2003.github.io/Smartfile/" style="padding: 10px 20px; background: blue; color: white; text-decoration: none; border-radius: 5px;">Go Back to Dashboard</a>
      </div>
    `);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).send('Login failed!');
  }
});

// 3. Media Fetch Route (Sirf Photos, Video, Audio layega)
app.get('/get-media', async (req, res) => {
  const targetEmail = req.query.email; 
  if (!app.locals.userAccountsDB[targetEmail]) {
    return res.status(404).json({ error: 'Account not found. Please login first.' });
  }

  const client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
  client.setCredentials(app.locals.userAccountsDB[targetEmail]);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    const response = await drive.files.list({
      q: "mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'audio/'",
      pageSize: 100,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)', 
    });
    res.json(response.data.files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// 4. Delete File Route
app.delete('/delete-file', async (req, res) => {
  const { email, fileId } = req.body;
  if (!app.locals.userAccountsDB[email]) return res.status(404).json({ error: 'Account not found' });

  const client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
  client.setCredentials(app.locals.userAccountsDB[email]);
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    await drive.files.delete({ fileId: fileId });
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete file' });
  }
});

app.listen(PORT, () => {
  console.log(`Pro Cloud Manager Server running on port ${PORT}`);
});

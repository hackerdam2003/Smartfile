require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// FIREBASE DATABASE CONNECTION (Permanent Memory)
// ----------------------------------------------------
// Render ke Environment Variables se Firebase credentials uthana
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = admin.firestore(); // Ye hai tera database

// ----------------------------------------------------
// GOOGLE CLOUD OAUTH SETUP
// ----------------------------------------------------
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email'
];

// 1. Google Login
app.get('/auth/login', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

// 2. Save Tokens in Firebase
app.get('/auth/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Tokens ko Firebase mein save karna (Permanent)
    await db.collection('accounts').doc(email).set(tokens);
    
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: green;">Account Linked & Saved in Firebase: ${email}</h2>
        <a href="https://hackerdam2003.github.io/Smartfile/" style="padding: 10px 20px; background: blue; color: white; text-decoration: none; border-radius: 5px;">Go Back to Dashboard</a>
      </div>
    `);
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).send('Login failed!');
  }
});

// 3. Fetch Media (Get Tokens from Firebase)
app.get('/get-media', async (req, res) => {
  const targetEmail = req.query.email; 
  
  try {
    // Firebase se us account ka token nikalo
    const accountDoc = await db.collection('accounts').doc(targetEmail).get();
    
    if (!accountDoc.exists) {
      return res.status(404).json({ error: 'Account Firebase me nahi mila. Pehle login karein.' });
    }

    const tokens = accountDoc.data();
    
    const client = new google.auth.OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.REDIRECT_URI);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

    const response = await drive.files.list({
      q: "mimeType contains 'image/' or mimeType contains 'video/' or mimeType contains 'audio/'",
      pageSize: 100,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)', 
    });
    
    res.json(response.data.files);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running with Firebase DB on port ${PORT}`);
});

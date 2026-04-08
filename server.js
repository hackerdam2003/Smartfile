require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth'); // Alag ki hui login file ko import kiya

const app = express();
const PORT = process.env.PORT || 3000;

// Yeh humara Database variable hai jo poori app mein use hoga
app.locals.userAccountsDB = {}; 

// Login aur Auth wale saare routes '/auth' se shuru honge
app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('<h1>Pro Cloud Manager</h1><a href="/auth/login">Login with Google Account</a>');
});

app.listen(PORT, () => {
  console.log(`Server is running! Maja aa gaya!`);
});

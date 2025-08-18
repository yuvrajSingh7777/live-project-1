const express = require('express');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require('./routes/contact');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

dotenv.config();
const app = express();

// Initialize passport strategy
require('./config/passport');


app.use(express.json());

// Setup session (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Render pe HTTPS ke liye true
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/contact', contactRoutes);


app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
});

// Error Handler Middleware
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

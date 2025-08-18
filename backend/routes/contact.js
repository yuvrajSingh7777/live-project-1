const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// POST /api/contact
router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.EMAIL_RECEIVER,
      subject: `[AWS Nuggets Contact] ${subject}`,
      text: message,
    });

    res.json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('📨 Email send error:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;

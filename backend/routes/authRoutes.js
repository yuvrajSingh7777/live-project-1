const express = require('express');
const passport = require('passport');
const {
  signup,
  login,
  googleAuthCallback,
  forgotPassword,
  resetPassword
  
} = require('../controllers/authController');

const router = express.Router();


router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post("/reset-password/:token", resetPassword);


router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  googleAuthCallback
);




module.exports = router;

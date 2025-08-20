const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

require('dotenv').config();

const REGION = process.env.AWS_REGION ;
const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = 'Users';


async function findUserByEmail(email) {
  const params = {
    TableName: TABLE_NAME,
    Key: { email }
  };
  const result = await ddbDocClient.send(new GetCommand(params));
  return result.Item || null;
}

async function createUser(user) {
  const params = {
    TableName: TABLE_NAME,
    Item: user,
    ConditionExpression: 'attribute_not_exists(email)' 
  };
  await ddbDocClient.send(new PutCommand(params));
  return user;
}

async function updateUser(email, updates) {
  const updateExpressions = [];
  const ExpressionAttributeNames = {};
  const ExpressionAttributeValues = {};

  let idx = 0;
  for (const key in updates) {
    idx++;
    updateExpressions.push(`#key${idx} = :value${idx}`);
    ExpressionAttributeNames[`#key${idx}`] = key;
    ExpressionAttributeValues[`:value${idx}`] = updates[key];
  }

  const params = {
    TableName: TABLE_NAME,
    Key: { email },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: "ALL_NEW"
  };

  const result = await ddbDocClient.send(new UpdateCommand(params));
  return result.Attributes;
}

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const exists = await findUserByEmail(email);
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = {
      email,
      name,
      password: hash,
      profilePic: "/uploads/default-avatar.png",
      resetPasswordToken: null,
      resetPasswordExpires: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createUser(user);

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        profilePic: user.profilePic
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Signup failed', error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.password) return res.status(400).json({ message: 'Password authentication not available' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.status(200).json({
      token,
      user: {
        email: user.email,
        name: user.name,
        profilePic: user.profilePic || null 
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.googleAuthCallback = async (req, res) => {
  try {
    const user = req.user; 

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const userData = {
      email: user.email,
      name: user.name,
      profilePic: user.profilePic || null
    };

    const encodedUser = encodeURIComponent(Buffer.from(JSON.stringify(userData)).toString('base64'));

    res.redirect(`/auth-success?token=${token}&user=${encodedUser}`);
  } catch (err) {
    res.status(500).json({ message: 'Google Auth failed', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'No user with that email' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await updateUser(email, { resetPasswordToken: resetToken, resetPasswordExpires });

    const resetUrl = `/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Reset your password',
      html: `
        <h2>Forgot your password?</h2>
        <p>Click the button below to reset your password.</p>
        <a target="_self" href="${resetUrl}" style="display:inline-block;margin-top:10px;padding:10px 20px;background:#007BFF;color:white;text-decoration:none;border-radius:5px;">Reset Password</a>
        <p>If you did not request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Reset link sent to your email.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Could not send reset link', error: err.message });
  }
};


exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const params = {
      TableName: TABLE_NAME,
    
    };

    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const scanRes = await ddbDocClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "resetPasswordToken = :token AND resetPasswordExpires >= :now",
      ExpressionAttributeValues: {
        ":token": token,
        ":now": Date.now()
      }
    }));

    if (!scanRes.Items || scanRes.Items.length === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const user = scanRes.Items[0];

    const hash = await bcrypt.hash(password, 10);

    await updateUser(user.email, {
      password: hash,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      updatedAt: new Date().toISOString()
    });

    res.status(200).json({ message: "Password reset successful!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Could not reset password", error: err.message });
  }
};


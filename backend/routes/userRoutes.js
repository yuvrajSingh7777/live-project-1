const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const protect = require('../middleware/authMiddleware');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand,DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const dotenv = require('dotenv');
dotenv.config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = 'Users';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const s3Client = new S3Client({ region: REGION });

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get profile
router.get('/profile', protect, async (req, res) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { email: req.user.email }
    };
    const data = await ddbDocClient.send(new GetCommand(params));
    if (!data.Item) return res.status(404).json({ message: 'User not found' });

    const user = data.Item;
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;

    res.json(user);
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: 'Could not get profile', error: err.message });
  }
});

// Delete account
router.delete('/delete', protect, async (req, res) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { email: req.user.email }
    };
    await ddbDocClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { email: req.user.email },
      UpdateExpression: "REMOVE #password, #resetPasswordToken, #resetPasswordExpires",
      ExpressionAttributeNames: {
        "#password": "password",
        "#resetPasswordToken": "resetPasswordToken",
        "#resetPasswordExpires": "resetPasswordExpires"
      }
    }));
    // Delete whole user
    await ddbDocClient.send(new DeleteCommand(params));
    

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

// Upload profile picture to S3
router.patch('/profile-pic', protect, upload.single('profilePic'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const file = req.file;
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) return res.status(500).json({ message: 'S3_BUCKET_NAME not configured' });

    const key = `profile-pics/${req.user.email}-${Date.now()}-${file.originalname}`;

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    }));

    // Profile pic URL (assuming public read access)
    const profilePicUrl = `https://${bucketName}.s3.${REGION}.amazonaws.com/${key}`;

    // Update user profilePic in DynamoDB
    const updateParams = {
      TableName: TABLE_NAME,
      Key: { email: req.user.email },
      UpdateExpression: 'SET profilePic = :profilePic',
      ExpressionAttributeValues: {
        ':profilePic': profilePicUrl
      },
      ReturnValues: 'ALL_NEW'
    };
    const updatedUserData = await ddbDocClient.send(new UpdateCommand(updateParams));

    
    const user = updatedUserData.Attributes;
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;

    res.status(200).json({
      message: 'Profile picture updated',
      user
    });
  } catch (err) {
    console.error("Upload Error:", err.message);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// Update name
router.patch('/update-name', protect, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Name is required" });
    }

    const updateParams = {
      TableName: TABLE_NAME,
      Key: { email: req.user.email },
      UpdateExpression: 'SET #name = :name',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':name': name.trim()
      },
      ReturnValues: 'ALL_NEW'
    };

    const updatedUserData = await ddbDocClient.send(new UpdateCommand(updateParams));

    const user = updatedUserData.Attributes;
    delete user.password;
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;

    res.json({
      message: "Name updated successfully",
      user
    });
  } catch (err) {
    console.error("Name update failed:", err.message);
    res.status(500).json({ message: "Failed to update name", error: err.message });
  }
});

module.exports = router;

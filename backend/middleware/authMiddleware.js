const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const TABLE_NAME = 'Users';

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ message: 'Unauthorized: Token missing' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const params = {
      TableName: TABLE_NAME,
      Key: { email: decoded.email }
    };
    const result = await ddbDocClient.send(new GetCommand(params));

    if (!result.Item) return res.status(401).json({ message: 'Unauthorized: User not found' });

    req.user = result.Item;
    delete req.user.password; 
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = protect;

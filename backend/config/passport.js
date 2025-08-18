const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
require('dotenv').config();

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = 'Users';

const ddbClient = new DynamoDBClient({ region: REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        
        const getParams = {
          TableName: TABLE_NAME,
          Key: { email },
        };

        const getResult = await ddbDocClient.send(new GetCommand(getParams));
        let user = getResult.Item;

        if (!user) {
          
          user = {
            email,
            name: profile.displayName,
            password: 'google-auth',
            profilePic: profile.photos[0]?.value || '/uploads/default-avatar.png',
            resetPasswordToken: null,
            resetPasswordExpires: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const putParams = {
            TableName: TABLE_NAME,
            Item: user,
            ConditionExpression: 'attribute_not_exists(email)',
          };

          await ddbDocClient.send(new PutCommand(putParams));
          console.log('✅ New user created:', user.email);
        } else {
          console.log('✅ Existing user found:', user.email);
        }

        return done(null, user);
      } catch (err) {
        console.error('🔥 Error in Google Strategy:', err);
        return done(err, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  console.log('🧠 Serializing user:', user.email);
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  try {
    console.log('🔍 Deserializing user with email:', email);

    const getParams = {
      TableName: TABLE_NAME,
      Key: { email },
    };

    const result = await ddbDocClient.send(new GetCommand(getParams));

    if (!result.Item) {
      console.warn('❌ User not found in DB:', email);
      return done(null, false); 
    }

    done(null, result.Item);
  } catch (err) {
    console.error('🔥 Error in deserializing user:', err);
    done(err, null);
  }
});

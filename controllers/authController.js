const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/users');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Replace with your Google Client ID
const client = new OAuth2Client(CLIENT_ID);

const googleLogin = async (req, res) => {
  const { token } = req.body;

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if the user exists
    let user = await UserModel.findOne({ email });
    if (!user) {
      // Create a new user if not found
      user = new UserModel({
        username: name,
        email,
        img:picture,
        googleId,
      });
      user.isGoogleUser = true;
      await user.save();
    }

    // Generate JWT token
    const sessionToken = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    res.json({
      error: false,
      message: 'Login successful',
      user: { id: user._id, email: user.email, name: user.username, img: user.img },
      token: sessionToken,
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({
      error: true,
      message: 'Invalid token',
    });
  }
};

module.exports = { googleLogin };

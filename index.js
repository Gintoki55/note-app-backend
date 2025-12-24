const express = require('express');
const bcrypt = require('bcryptjs');
const _PORT = 3001;
const dotenv = require('dotenv');
dotenv.config();

const app = express();

const helmet = require('helmet');
app.use(helmet());
//// token package
const jwt = require('jsonwebtoken');
// Middleware
const cors = require('cors');
app.use(
    cors({
        origin: [
            'http://localhost:3000', // رابط الواجهة أثناء التطوير
            'https://subtle-cassata-13f01e.netlify.app', // رابط الإنتاج
        ],
        credentials: true, // السماح باستخدام بيانات الاعتماد (Cookies, Authorization headers)
    })
);

// لإدارة طلبات التحقق المسبق (OPTIONS)
app.options('*', cors());
app.use(express.json());

// MongoDB connection URI
const mongoose = require('mongoose');
const username = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;
const dbName = process.env.MONGO_DB_NAME;
const MONGO_URI = `mongodb+srv://${username}:${password}@mern-note.99ozae0.mongodb.net/${dbName}?retryWrites=true&w=majority`;
const usersUrl = process.env.GET_ALL_USERS;
// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });



// Import user model
const UserModel = require('./models/users')

// get all users 
app.get(`/${usersUrl}`,async (req, res) => {
    const users = await UserModel.find();
    res.json(users);
})

// create new user
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username) {
        return res.status(400).json({
            error: true,
            message: 'Username is required.',
        });
    }

    if (!email) {
        return res.status(400).json({
            error: true,
            message: 'Email is required.',
        });
    }

    if (!password) {
        return res.status(400).json({
            error: true,
            message: 'Password is required.',
        });
    }

    try {
      console.log("Mongoose state:", mongoose.connection.readyState);
        const existingUser = await UserModel.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            const field = existingUser.email === email ? 'Email' : 'Username';
            return res.status(400).json({
                error: true,
                message: `${field} already exists.`,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new UserModel({ 
            username, 
            email, 
            password: hashedPassword,
        });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

        res.status(201).json({
            message: 'User registered successfully.',
            user: { id: newUser._id, email: newUser.email, name: newUser.username}, 
            token,
        });
    } catch (error) {
        if (error.code === 11000) { // MongoDB duplicate key error code
            const duplicateField = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                error: true,
                message: `${duplicateField} already exists.`,
            });
        }

        console.error('Registration error:', error);
        res.status(500).json({
            error: true,
            message: 'Error registering user.',
        });
    }
});


// Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: 'Email and password are required.',
    });
  }

  try {
    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

    return res.json({
      error: false,
      message: 'User logged in successfully',
      user: { id: user._id, email: user.email, name: user.username ,img:user.img}, // Send minimal user info
      token, // Send JWT token for authentication
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: true,
      message: 'An error occurred during login. Please try again.',
    });
  }
});

//// delete user
app.delete('/user/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const deletedUser = await UserModel.findByIdAndDelete(userId);
        
        if (!deletedUser) {
            return res.status(404).json({ error: true, message: 'User not found or already deleted' });
        }
        
        res.json({ error: false, message: 'User deleted successfully', user: deletedUser });
    } catch (error) {
        res.status(500).json({ error: true, message: 'An error occurred while deleting the user', details: error.message });
    }
});



//// notes API ////

const authenticateToken = require('./middleware/authenticateToken');
const NoteModel = require('./models/notes');

//add note
app.post('/add-note', authenticateToken, async (req, res) => {
    const { title, content, tags } = req.body; // Extract note details from request body

    if (!title || !content) {
        return res.status(400).json({ error: true, message: 'Title and content are required' });
    }
    const note = await NoteModel.findById()

    try {
          const newNote = new NoteModel({
            title,
            content,
            tags,
            userId: req.user.id, // Attach user ID from the token to the note
        });

        const savedNote = await newNote.save(); // Save note to the database
        res.status(201).json({ error: false, message: 'Note added successfully', note: savedNote });
    } catch (err) {
        res.status(500).json({ error: true, message: 'Failed to add note', details: err.message });
    }
});


// Get specific notes for the authenticated user
app.get('/my-note', authenticateToken, async (req, res) => {
  try {
    // Use the `req.user.id` from the token to filter notes
    const userId = req.user.id;
    const notes = await NoteModel.find({ userId }); // Find notes belonging to the user
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving notes', error: error.message });
  }
});



/// delete note
app.delete('/delete-note/:id', authenticateToken , async (req,res)=>{
   const noteId = req.params.id;
   try {
        const deletedNote = await NoteModel.findByIdAndDelete(noteId);
        
        if (!deletedNote) {
            return res.status(404).json({ error: true, message: 'Note not found or already deleted' });
        }
        
        res.json({ error: false, message: 'Note deleted successfully', note: deletedNote });
    } catch (error) {
        res.status(500).json({ error: true, message: 'An error occurred while deleting the note', details: error.message });
    }
})


/// updateing note 
app.put('/update-note/:id', authenticateToken, async (req, res) => {
  const noteId = req.params.id;
  const { title, content, tags } = req.body;

  try {
    // Filter out undefined fields
    const fieldsToUpdate = {};
    if (title !== undefined) fieldsToUpdate.title = title;
    if (content !== undefined) fieldsToUpdate.content = content;
    if (tags !== undefined) fieldsToUpdate.tags = tags;

    // Ensure the note belongs to the authenticated user
    const note = await NoteModel.findOneAndUpdate(
      { _id: noteId, userId: req.user.id }, 
      fieldsToUpdate,
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: true, message: 'Note not found !!' });
    }

    res.status(200).json({ 
      error: false, 
      message: 'Note updated successfully', 
      note 
    });
  } catch (error) {
    res.status(500).json({ 
      error: true, 
      message: 'Failed to update note', 
      details: error.message 
    });
  }
});

// ------------------ Request Reset Password ------------------
app.post('/request-reset-password', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await UserModel.findOne({ email });
        if (!user) return res.status(404).json({ error: true, message: "User not found" });

        // توليد OTP 4 أرقام
        const otp = Math.floor(1000 + Math.random() * 9000);

        // حفظ في اليوزر مع صلاحية 5 دقائق
        user.resetOtp = otp.toString();
        user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        // إرجاع OTP للفرونت (لتجربة NProgress)
        res.json({ error: false, message: "OTP generated", user:user.resetOtp });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: true, message: "Server error" });
    }
});

const crypto = require("crypto");  
// ------------------ Verify OTP ------------------
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await UserModel.findOne({ email });
        if (!user) return res.status(404).json({ error: true, message: "User not found" });

        if (!user.resetOtp || !user.resetOtpExpires)
            return res.status(400).json({ error: true, message: "OTP not requested" });

        if (Date.now() > new Date(user.resetOtpExpires))
            return res.status(400).json({ error: true, message: "OTP expired" });

        if (user.resetOtp !== otp)
            return res.status(400).json({ error: true, message: "Invalid OTP" });

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق
        // مسح OTP بعد التحقق
        user.resetOtp = null;
        user.resetOtpExpires = null;
        await user.save();

        // إرسال نجاح للتحويل للفرونت
        res.json({ error: false, message: "OTP verified. You can reset password now.", token: resetToken });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: true, message: "Server error" });
    }
});
// ------------------ Reset Password ------------------
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const user = await UserModel.findOne({
          resetPasswordToken: token,
          resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user)
        return res.status(400).json({ error: true, message: "Invalid or expired token" })

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.json({ error: false, message: "Password reset successful" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: true, message: "Server error" });
    }
});


// Start the server
app.listen(_PORT, () => {
  console.log(`Server is running on http://localhost:${_PORT}`);
});

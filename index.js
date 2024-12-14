const express = require('express');
const bcrypt = require('bcryptjs');
const _PORT = 3001;
const dotenv = require('dotenv');
dotenv.config();

const app = express();
// لحمايه من iframes
const helmet = require('helmet');
app.use(helmet());





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
app.options('*', cors()); // لمعالجة طلبات التحقق المسبق
app.use(express.json());

// MongoDB connection URI
const mongoose = require('mongoose');
const username = process.env.MONGO_USERNAME;
const password = process.env.MONGO_PASSWORD;
const dbName = process.env.MONGO_DB_NAME;
const MONGO_URI = `mongodb+srv://${username}:${password}@mern-note.wlxir.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=mern-note`;
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


//// token package
const jwt = require('jsonwebtoken');
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

    if (user.isGoogleUser) {
      return res.status(400).json({
        error: true,
        message: 'This account was created using Google Sign-In and does not have a password. Please use Google Sign-In or reset your password to create one.',
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
  const { title, content, tags, isPinned } = req.body;

  try {
    // Filter out undefined fields
    const fieldsToUpdate = {};
    if (title !== undefined) fieldsToUpdate.title = title;
    if (content !== undefined) fieldsToUpdate.content = content;
    if (tags !== undefined) fieldsToUpdate.tags = tags;
    if (isPinned !== undefined) fieldsToUpdate.isPinned = isPinned;

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

//// google login

const { googleLogin } = require('./controllers/authController');
app.post('/google-login', googleLogin);





const nodemailer = require('nodemailer');

// إعداد بيانات SMTP لـ SendGrid
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  secure: false, // استخدم `false` إذا كنت تستخدم المنفذ 587
  auth: {
    user: "apikey", // يجب أن يكون دائمًا "apikey"
    pass: process.env.SENDGRID_API_KEY, // مفتاح API الخاص بـ SendGrid
  },
});


// طلب إعادة تعيين كلمة المرور
app.post('/request-reset-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: true, message: "We couldn’t find an account with that email address. Please double-check or sign up if you’re new." });
    }

    const token = jwt.sign({ id: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    const resetLink = `https://subtle-cassata-13f01e.netlify.app/reset-password?token=${token}`;
    await transporter.sendMail({
      from: 'Note App <ahmedbarkhed7@gmail.com>',
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 15 minutes.</p>`,
    });

    res.json({ error: false, message: 'Password reset link sent to email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: true, message: 'Error sending reset link.' });
  }
});


// إعادة تعيين كلمة المرور
app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ error: true, message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.isGoogleUser = false;
    await user.save();

    res.json({ error: false, message: 'Password has been reset successfully.' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: true, message: 'Invalid or expired token.' });
  }
});


// Start the server
app.listen(_PORT, () => {
    console.log(`Server is running on http://localhost:${_PORT}`);
});

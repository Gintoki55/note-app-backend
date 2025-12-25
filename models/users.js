// Import Schema and model from mongoose
const { Schema, model } = require('mongoose');

// Define the users schema
const usersSchema = new Schema({
    // Username: required and must be unique
    username: {
        type: String,
        required: true,
        unique: true,
    },
    // Email: required and must be unique
    email:{
        type: String,
        required: true,
        unique: true,
    },
    // Password (optional, e.g., for social login it might be empty)
    password: {
        type: String,
    },
    // User profile image URL
    img: {
        type: String,
    },
    // OTP code for password reset
    resetOtp: {           
        type: String,
    },
    // Expiration date for the OTP
    resetOtpExpires: {  
        type: Date,
    },
    // Token for resetting password (optional)
    resetPasswordToken: String,
    // Expiration date for the reset token
    resetPasswordExpires: Date,
});

// Create a model from the schema
const UsersModel = model('users', usersSchema);

// Export the model to use in other files
module.exports = UsersModel;

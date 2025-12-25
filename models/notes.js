const mongoose = require('mongoose'); // Import mongoose
const { Schema, model } = mongoose;  // Destructure Schema and model from mongoose

// Define the schema for notes
const notesSchema = new Schema({
    title: {
        type: String,      // Note title
        required: true,    // Title is required
    },
    content: {
        type: String,      // Note content
        required: true,    // Content is required
    },
    tags: {
        type: [String],    // Array of tags for the note
        default: [],       // Default is an empty array
    },
    isPinned: {
        type: Boolean,     // Indicates if the note is pinned
        default: false,    // Default is not pinned
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, // Reference to the user who owns the note
        ref: 'User',                           // Refers to the 'User' model
        required: true                         // Must be provided
    },
    createdAt: {
        type: String,     // Creation date of the note
        default: () => new Date().toLocaleDateString('EN-EG'), // Default is today’s date (EN-EG format)
    },
});

const NoteModel = model('Note', notesSchema); // Create the Note model

module.exports = NoteModel; // Export the model

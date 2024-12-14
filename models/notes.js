const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const notesSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    tags: {
        type: [String],
        default: [],
    },
    isPinned: {
        type: Boolean,
        default: false,
    },
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    createdAt: {
        type: String, 
        default: () => new Date().toLocaleDateString('EN-EG'),
    },
});

const NoteModel = model('Note', notesSchema);

module.exports = NoteModel;

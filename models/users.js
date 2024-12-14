const {Schema, model} = require('mongoose');

const usersSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email:{
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
    },
    img: {
        type: String,
    },
    isGoogleUser: {
        type: Boolean,
        default: false,
    },
})

const UsersModel = model('users', usersSchema);

module.exports = UsersModel;

const mongoose = require("mongoose");
const VerifyEmail = mongoose.model(
    "VerifyEmail",
    new mongoose.Schema({
        email: String, 
        link:  String, 
        password: String, 
        updatedAt: Date,
    })
);
module.exports = VerifyEmail;
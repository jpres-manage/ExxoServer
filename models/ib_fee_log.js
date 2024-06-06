const mongoose = require("mongoose");
const { DepositMode } = require("../controllers/constant");

const IBFeeLog = mongoose.model(
    "IBFeeLogs",
    new mongoose.Schema({
        clientUuid: String, 
        amount: Number, 
        from: String,   /// payout , ibcommission, ibFeeLog, 
        ibDepth: Number, 
        createdAt: Date, 
    })
);
module.exports = IBFeeLog;
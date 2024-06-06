const mongoose = require("mongoose");
const { DepositMode } = require("../controllers/constant");

const IBBalanceLog = mongoose.model(
    "IBBalanceLogs",
    new mongoose.Schema({
        clientUuid: String, 
        amount: Number, 
        newBalance: Number, 
        logType: String, 
        from: String,   /// payout , ibcommission, ibFeeLog, 
        createdAt: Date
    })
);
module.exports = IBBalanceLog;
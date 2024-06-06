const mongoose = require("mongoose");
const { DepositMode } = require("../controllers/constant");

const IBCommission = mongoose.model(
  "IBCommissions",
  new mongoose.Schema({
    from: String, 
    closedVolume: Number,
    createdAt: Date, 
    commissionAmount: Number, 
    comment: String, 
    positionID: String, 
    ibTradingAccountId: String, 
    parentAccountUuid: String, 
    email: String,
    depositState: Number, 
    ibDepth: Number, 
    generatedTime: Number, 
    orderId: String, 
    lastIBBalance: Number, 
    newIBBalance: Number
  })
);

module.exports = IBCommission;
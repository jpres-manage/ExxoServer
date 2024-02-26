const mongoose = require("mongoose");
const { DepositMode } = require("../controllers/constant");

const IBCommission = mongoose.model(
  "IBCommissions",
  new mongoose.Schema({
    uuid: String, 
    clientUuid: String,
    email: String,
    user_name: String, 
    tradingAccountUuid: String,
    tradingAccountId: String,
    amount: Number,
    code: String,
    transfer_code: String,
    transfer_amount: String,
    createdAt: {
      type: Date, 
      default: new Date()
    },
    ethAddress: String,
    status: String,
    depositMode: {
      type: String, 
      default: DepositMode.GATEWAY
    },
    dealer: String, 
    comment:String, 
  })
);

module.exports = IBCommission;
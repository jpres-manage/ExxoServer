const mongoose = require("mongoose");

const MissedWallet = mongoose.model(
  "MissedWallet",
  new mongoose.Schema({
    clientUuid:           String,
    email:                String,
    tradingAccountUuid:   String,
    tradingAccountId:     String,
    ethAddress:           String,
    ethPrivateKey:        String,
    tronAddress:          String,
    tronPrivateKey:       String,
    offerUuid:            String,
    isDemo:               Boolean, 
    balance: {
      type: Number, 
      default: 0
    }, 
    creditBalance: {
      type: Number, 
      default: 0
    },
    createdAt: Date, 
  })
);

module.exports = MissedWallet;
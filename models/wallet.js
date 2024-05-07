const mongoose = require("mongoose");

const Wallet = mongoose.model(
  "Wallet",
  new mongoose.Schema({
    clientUuid:          {
       type: String, 
       index: true,
    }, 
    email: {
      type: String, 
      index: true
    } , 
    tradingAccountUuid:  {
      type: String,
      index: true
    },
    tradingAccountId:   {  
      type: String,
      index: true
    },
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

module.exports = Wallet;
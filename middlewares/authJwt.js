const jwt = require("jsonwebtoken");
const config = require("../config/auth.js");
const User = require("../models/user");
const Role = require("../models/role");
const BotController = require("../controllers/Bot/index.js");

const redisClient = require("../controllers/Redis"); 
const Database = require("../controllers/Database/index.js");

const verifyToken = async(req, res, next) => {
  try {
    let token = req.headers["authorization"];
    if (!token) {
      return res.status(403).send({ message: "Authorization" });
    }

    let decode = jwt.verify(token, config.secret);
    req.email = decode.email; 
    req.accountUuid =decode.accountUuid; 
    req.isEmailVerified = decode.isEmailVerified; 
    req._id = decode._id;
    next();

  } catch (e) {
    return res.status(401).send({ message: "Unauthorized!" });
  }
};

const authJwt = {
  verifyToken,
};
module.exports = authJwt;
const Database = require("../controllers/Database");
const { KYCStatus, IBStatus } = require("../controllers/constant");


const EmailVerifyed = async (req, res, next) => {



}

const kycApproved = async (req, res, next)=>{
    const accountUuid = req.accountUuid; 
    const email = req.email; 
    let userInfo =await Database.Account.getAccountDetailByEmail(email); 
    if(userInfo.verification_status !== KYCStatus.APPROVED){
        return res.status(403).send({
            message: "You should be approved to use this role."
        }); 
    }
    next(); 
}
const ibApproved = async (req, res, next)=>{
    const accountUuid = req.accountUuid; 
    const email = req.email; 
    let userInfo =await Database.Account.getAccountDetailByEmail(email); 
    if(userInfo.ib_status !== IBStatus.APPROVED ){
        return res.status(403).send({
            message: "You should be IBClient to use this role."
        }); 
    }
    next(); 
}
const socialApproved = async (req, res, next)=>{
    const accountUuid = req.accountUuid; 
    let userInfo =await Database.SocialAccount.getSocialAccountInfoByUuid(accountUuid); 
    if(userInfo.ibStatus !== IBStatus.APPROVED ){
        return res.status(403).send({
            message: "You should be IBClient to use this role."
        }); 
    }
    next(); 
}

const UserValidation = {
    kycApproved, ibApproved, socialApproved
}

module.exports = UserValidation; 
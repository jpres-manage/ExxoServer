var router = require("express").Router();
const { authJwt, verifySignUp, checkAdmin, checkAdminWithout2FA, checkSuperAdmin } = require("../middlewares");
const controller = require("../controllers/auth");
const UserController = require("../controllers/customer");
const Database = require("../controllers/Database");
const CommissionController = require("../controllers/Commission");
const EmailController = require("../controllers/Email");
const BOController = require("../controllers/BO");
const User = require("../models/user");

router.get("/admins",[checkSuperAdmin] ,controller.getAdmins);
router.post("/admin",  [verifySignUp.checkDuplicateAdminNameOrEmail],  controller.updateAdmin);
router.delete("/admin", controller.deleteAdmin);
router.post("/admin-signin", controller.adminSignin);
router.post("/admin-signin-with-token",[checkAdmin], controller.adminSigninWithToken);
router.post("/signup", UserController.createUser);
router.post("/google-signup", [verifySignUp.checkDuplicateUsernameOrEmail],UserController.createUserFromGoogle);
router.post("/signin", controller.signin);
router.post("/google-signin", UserController.googleSignIn);
router.get("/verify", UserController.verifyEmail);
router.post("/reset-link", controller.resetLink);
// router.post("/resend-email",controller.resendEmail);
router.post("/resend-email",[authJwt.verifyToken] ,controller.resendEmail);
router.get("/resend-email-point",[authJwt.verifyToken] ,controller.getResetEmailPoint);
router.post("/resend-all-email", controller.resendAllEmail);
router.get("/reset-password", controller.resetPasswordPage);
router.post("/reset-password", UserController.changePasswordFP);
// router.post("/reset-password", controller.resetPassword);
router.post("/send-verify-code", [authJwt.verifyToken] ,controller.sendWithdrawVerifyCode);
router.get("/verify-withdraw-code", controller.verifyWithdrawCode);

router.post('/start-2fa', controller.startAdmin2FA); 
router.post('/start-2fa', controller.verifyAdmin2FA )
router.get('/get-2fa', controller.getAdmin2FA); 
router.post("/verify-2fa", [checkAdminWithout2FA], controller.verifyAdmin2FA );
router.post("/signinWithToken",[authJwt.verifyToken], async (req, res, next)=>{
    const user =await Database.Account.getAccountDetailByUuid(req.accountUuid); 
    res.status(200).send({
        success: true, 
        body: {
         ...user._doc,
         password: undefined, 
         oneTimeToken: undefined, 
         ibRanking: CommissionController.getIBRankingName(user.ibRanking)
        }
    });
});

router.post("/test/email",async (req, res)=>{

    const {email} = req.body; 
    await EmailController.sendAccountCreated("sigma2.trading@outlook.com");
    return res.status(200).send("true")
})

router.post("/bo/user", async(req, res)=>{
    const users = await User.find({email: "admin.test2@exxo.com"}); 
    let count = 0 ; 
    for(let user of users){
        const userInfo =await BOController.Account.checkEmailFromBO(user.email)
        if(userInfo){
            count++; 
            let _user = new User({...userInfo,  ...user, isEmailVerified:true});
            await User.findOneAndUpdate({email: user.email}, {$set:{..._user}});
        }else {
            continue; 
        }
    }
    return res.status(200).send("" + count);
})

router.get("/bo/users", async(req, res)=>{

    const userInfo =await BOController.Account.GetAllUsers()

    console.log({userInfo})
    return res.status(200).send(userInfo);
})

module.exports = router;

const Database = require("./Database");
const EmailController = require("./Email");
const { templateNames, templateKeys } = require("./Email/constant");
const jwt = require("jsonwebtoken");
const config = require("../config/auth");
const bcrypt = require("bcryptjs");
const { IBStatus, KYCStatus, PaymentGateway, WithdrawMode, OperationTypes, IBBalanceLogType } = require("./constant");
const BOController = require("./BO");
const BotController = require("./Bot");
const PositionController = require("./position");
const { OAuth2Client } = require('google-auth-library');
const { generatePassword } = require("../utils/helper");
const { readSettings } = require("./Commission");
const User = require("../models/user");
const redisClient = require("./Redis");
const { default: mongoose } = require("mongoose");
const BalanceController = require("./balance");
const { OperationType } = require("moralis/common-core");
const IBFeeLog = require("../models/ib_fee_log");
const IBBalanceLog = require("../models/ib_balance_logs");
const ManagerApi = require("./Manager");
const client = new OAuth2Client(`${process.env.GOOGLE_CLIENT_ID}`);

const getUsers = async (req, res, next) => {
    const { adminUuid, role } = req;
    const { refresh } = req.query;

    let admin_users = null;
    let key = `admin_users`;

    let keyExist = await redisClient.exists(key);
    if (keyExist && refresh == 'false') {
        let admin_users_data = await redisClient.get(key);
        admin_users = JSON.parse(admin_users_data);
    } else {
        admin_users = await Database.Account.getUsers(adminUuid, role);
        redisClient.set(key, JSON.stringify(admin_users), "EX", process.env.REDIS_EXPIRATION || 3600)
    }

    if (!admin_users) {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    } else {
        return res.status(200).send({
            success: true,
            body: [
                ...admin_users
            ]
        })
    }
}

//// For user Role: using token
const getUserProfile = async (req, res, next) => {
    const id = req.params.id;
    const result = await Database.Account.getAccountDetailById(id);
    if (!result) {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    } else {
        const branchInfo = await Database.Branch.getBranchDetailsByUuid(result.branchUuid);
        return res.status(200).send({
            success: true,
            body: {
                ...result,
                branchInfo
            }
        })
    }
}

/// For Admin Role
const getUserProfileByUuid = async (req, res, next) => {
    const accountUuid = req.params.id;
    const result = await Database.Account.getAccountDetailByUuid(accountUuid);

    if (result) {
        const branchInfo = await Database.Branch.getBranchDetailsByUuid(result.branchUuid);
        return res.status(200).send({
            success: true,
            body: {
                ...result,
                branchInfo
            }
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    }
}

const saveUserProfile = async (req, res, next) => {
    const accountUuid = req.accountUuid;
    const data = req.body;
    const result = await Database.Account.updateAccountProfile(accountUuid, { ...data });
    if (!result) {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    } else {
        return res.status(200).send({
            success: true,
            body: {
                ...result
            }
        })
    }
}
const updateProfileFromAdmin = async (req, res, next) => {
    const { id: accountUuid } = req.params;
    const data = req.body;

    const { admin, remoteIp } = req;

    BotController.sendAdminLog(admin.email, remoteIp, "updateProfileFromAdmin " + accountUuid)
    const result = await Database.Account.updateAccountProfile(accountUuid, { ...data });
    if (!result) {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    } else {
        return res.status(200).send({
            success: true,
            body: {
                ...result
            }
        })
    }
}

const saveUserProfileImage = async (req, res, next) => {
    const { email, accountUuid } = req;
    let filename = req.file.filename;
    await Database.Account.updateProfileImage(email, filename);
    res.status(200).send({
        success: true,
        body: filename
    })
}

const createUser = async (req, res, next) => {
    const _data = req.body;
    let parentAccountUuid = null;

    let branchUuid = await Database.Setting.getDefaultBranch();
    const { ibLinkCookie } = _data;
    if (!!ibLinkCookie) {
        const IBUser = await Database.Account.getAccountDetailByIblink(Number(ibLinkCookie));
        if (!!IBUser) {
            branchUuid = IBUser.branchUuid;
            parentAccountUuid = IBUser.accountUuid;
        }
    }

    let { email, password } = req.body;
    email = email.toLowerCase();

    const data = {
        ...req.body,
        email,
        branchUuid,
        parentAccountUuid,
        password: bcrypt.hashSync(password, 8)
    };
    let result = await Database.Account.createAccountSync(data)
    if (!result) {

        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    } else {
        try {

            BotController.userSignup(email);
            let info = { id: result._id, accountUuid: result.accountUuid, email, fullname: result.fullname, countryCode: result.countryCode, password };
            const token = jwt.sign(info, config.secret, { expiresIn: 3600 * 24 * 365 });
            link = process.env.BACKEND_SERVER + "/api/auth/verify?token=" + token;
            BotController.errors(email, "Sent verify email");
            await Database.VerifyEmail.createVerifyEmail(email, link, password);
            await EmailController.verifyEmail(email, link);
            return res.status(200).send({
                success: true,
                body: {
                    ...result,
                    accessToken: token
                }
            })
        } catch (e) {
            console.log(e);
            BotController.errors(data, "Failed to send verify email");
            return res.status(200).send({
                success: false,
                body: {
                    ...result,
                }
            })
        }
    }
}
const approveAnway = async (req, res, next) => {
    try {

        const _id = req.params.id;

        const user = await User.findOne({ _id })
        const token = await Database.VerifyEmail.getVerifyEmail(user.email);
        let decoded = jwt.verify(token, config.secret);

        let result = await BOController.Account.registerUser(decoded);
        let branchUuid = await Database.Setting.getDefaultBranch();
        await Database.Account.updateAccountProfileByEmail(decoded.email, { ...result.data, isEmailVerified: true, password: user.password, branchUuid });

        let place = await Database.Account.updateVerifyStatus({ _id, status: KYCStatus.APPROVED });

        BotController.userApporved(place.email);
        EmailController.sendUserApproved(place.email);
        BOController.Account.updateUserInfo(place.email, place);

    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Failed to create user."
        })
    }
}
const updateStatus = async (req, res, next) => {

    const { admin, remoteIp } = req;
    const _id = req.params.id;

    if (admin) {
        BotController.sendAdminLog(admin?.email, remoteIp, `updateStatus user  ${_id}  to ${req.body.verification_status}`);
    }

    try {
        let status = req.body.verification_status;
        let place = await Database.Account.updateVerifyStatus({ _id, status });

        if (place) {
            if (status === KYCStatus.APPROVED) {
                BotController.userApporved(place.email);
                EmailController.sendUserApproved(place.email);
                BOController.Account.updateUserInfo(place.email, place);
            } else {
                EmailController.sendUserDeclined(place.email, req.body.remark);
            }
            return res.status(200).send({
                body: place,
                success: true
            })
        } else {
            return res.status(200).send({
                success: false,
                error: "Failed to create user."
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Failed to create user."
        })
    }
}
const verifyEmail = async (req, res, next) => {

    try {
        let decoded = jwt.verify(req.query.token, config.secret);

        let key = `user_${decoded.email}`;
        let keyExist = await redisClient.exists(key);
        let user = null;
        if (keyExist) {
            let userData = await redisClient.get(key);
            user = JSON.parse(userData);

        } else {
            user = await Database.Account.getAccountDetailByEmail(decoded.email);
        }

        if (!user)
            return res.redirect(`${process.env.FRONT_ENTRY}/login`);
        else {
            let result = await BOController.Account.registerUser(decoded);
            if (!result) {
                return res.redirect(`${process.env.FRONT_ENTRY}/login`);
            }
            let branchUuid = await Database.Setting.getDefaultBranch();
            await Database.Account.updateAccountProfileByEmail(decoded.email, { ...result.data, isEmailVerified: true, password: user.password, branchUuid });

            await redisClient.set(key, JSON.stringify({ ...result.data, isEmailVerified: true, password: user.password, branchUuid }), "EX", process.env.REDIS_EXPIRATION || 3600)

            BotController.emailVerified(decoded.email);
            return res.redirect(`${process.env.FRONT_ENTRY}/login`);
        }
    } catch (e) {
        return res.redirect(`${process.env.FRONT_ENTRY}/login`);
    }

}
const updateUserBranch = async (req, res, next) => {

    const id = req.params.id;
    const branchUuid = req.body.branchUuid;
    let branchInfo = await Database.Branch.getBranchDetailsByUuid(branchUuid);
    try {
        if (branchInfo) {
            const data = {
                branchUuid,
                branchInfo: branchInfo[0]
            }
            let result = await Database.Account.updateAccountProfile(id, data);
            if (result) {
                return res.status(200).send({
                    success: true,
                    body: result
                })
            }
        }
    } catch (e) {
        BotController.errors(e, "customer.updateUserBranch");
    }
    return res.status(200).send({
        success: false,
        error: "Internal Server Error"
    });
}

const getSystemLogs = async (req, res, next) => {
    const { from, to } = req.query;
    const { adminUuid, role } = req;
    let result = await Database.SysLog.getSysteLogs({ from, to, adminUuid, role });
    if (result) {
        res.status(200).send({
            success: true,
            body: result
        })
    } else {
        res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    }
}
const updateIBCommissionType = async (req, res, next) => {
    const { accountUuid, ibCommissionType } = req.body;
    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, "update IB CommissionType " + ibCommissionType)
    }
    try {
        const result = await Database.Account.updateAccountProfile(accountUuid, { ibCommissionType });
        return res.status(200).send({
            success: true,
            body: result
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const payoutIBFeeFromAdmin = async (req, res) => {

    const { id } = req.params;
    const _user = await Database.Account.getAccountDetailByUuid(id);

    if (!!_user.ibFeePaied || _user.ibStatus !== IBStatus.APPROVED) {
        return res.status(200).send({ success: false, error: "Bad request" });
    }

    const user_tradingAccounts = await Database.TradingAccount.getTradingAccountByEmail(_user.email);
    const _tradingAccounts = [];
    for (let account of user_tradingAccounts) {
        try {
            if (account.isDemo) continue;
            const result_account = await ManagerApi.Account.getInfo(account.tradingAccountId);
            let accountInfo = result_account.data.accountInfo;
            _tradingAccounts.push({
                ...account,
                balance: accountInfo.balance / 100,
                equity: accountInfo.equity / 100,
                ethPrivateKey: undefined
            })
        } catch (e) {
            console.log(e)
        }
    };

    const tradingAccounts = _tradingAccounts.filter(v => !!v);
    let isValid = false, sTradingAccount = null;

    tradingAccounts.map(tradingAccount => {
        if (tradingAccount.equity > 100) {
            isValid = true;
            sTradingAccount = tradingAccount
        }
    })

    if (!isValid) {
        return res.status(200).send({
            success: false,
            error: "This user has no enough balance."
        })
    }

    const rsltPayout = await payoutIBFee(sTradingAccount, _user);

    if (!rsltPayout) {
        return res.status(200).send({
            success: false,
            error: "Failed to payout IB Fee."
        })
    }
    return res.status(200).send({
        success: true,
    })
}

const payoutIBFee = async (tradingAccount, user) => {
    const comment = `IB register fee from ${tradingAccount.tradingAccountId}`
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const opts = { session, new: true };
        const level_fees = [50, 10, 10, 10, 10, 10];
        let rest = 100;
        let parentUser = null, _user = user;
        for (let i = 0; i < 6; i++) {
            if (!_user.parentAccountUuid || rest < 0) break;
            parentUser = await User.findOneAndUpdate({ accountUuid: _user.parentAccountUuid }, { $inc: { ibBalance: level_fees[i] } }, opts)
            if (!parentUser) break;
            const _date = new Date
            const ibFeeLog = new IBFeeLog({
                clientUuid: parentUser.accountUuid,
                amount: level_fees[i],
                from: user.email,   /// payout , ibcommission, ibFeeLog, 
                ibDepth: i + 1,
                createdAt: _date
            })
            const result = await ibFeeLog.save({ session });
            const ibBalanceLog = new IBBalanceLog({
                clientUuid: parentUser.accountUuid,
                amount: level_fees[i],
                newBalance: parentUser.ibBalance,
                logType: IBBalanceLogType.IB_REG_FEE,
                from: result._id,
                createdAt: _date, 
                tradingAccount: tradingAccount.tradingAccountId
            })
            await ibBalanceLog.save({ session });
            rest -= level_fees[i];
            _user = parentUser;
        }

        await User.findOneAndUpdate({email:user.email}, {ibFeePaied: true}, opts); 

        if (rest > 0) {
            const rsltDeposit = await BalanceController._depositToTradingAccountId(rest, rest, PaymentGateway.IB_REG_FEE, `${process.env.IBFEE_PAYOUT_ACCOUNT}`, "USD", comment,
                "System", "System", "System", 0, tradingAccount.tradingAccountid)
            if (rsltDeposit.status !== OperationTypes.OPERRATION_SUCCESS) {
                throw new Error("Deposit Failed")
            }
        }
        const rsltWithdraw = await BalanceController._withdrawToTradingAccountId(100, 100, PaymentGateway.INTERNAL_TRANSFER, tradingAccount.tradingAccountId, "usd", comment, user.email, user.accountUuid, WithdrawMode.AUTO)
        if (rsltWithdraw.status !== OperationTypes.OPERRATION_SUCCESS) {
            throw new Error("Withdraw Failed")
        }
        await session.commitTransaction();
        session.endSession();
        return true;
    } catch (e) {
        await session.abortTransaction();
        session.endSession();
        return false;
    }
}

const updateIBStatus = async (req, res, next) => {
    const reqbody = req.body;
    const { id, ibStatus } = reqbody;

    const { admin, remoteIp } = req;
    const _user = await Database.Account.getAccountDetailById(id);

    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `updateIBStatus  ${_user.email} with ${ibStatus}`)
    }

    if (_user.ibStatus === ibStatus) {
        return res.status(200).send({
            success: false,
            error: "Already in " + ibStatus
        })
    }
    const user_tradingAccounts = await Database.TradingAccount.getTradingAccountByEmail(_user.email);
    const _tradingAccounts = [];
    for (let account of user_tradingAccounts) {
        try {
            if (account.isDemo) continue;
            const result_account = await ManagerApi.Account.getInfo(account.tradingAccountId);
            let accountInfo = result_account.data.accountInfo;

            _tradingAccounts.push({
                ...account,
                balance: accountInfo.balance / 100,
                equity: accountInfo.equity / 100,
                ethPrivateKey: undefined
            })
        } catch (e) {

        }
    };

    const tradingAccounts = _tradingAccounts.filter(v => !!v);
    let isValid = false, sTradingAccount = null;

    tradingAccounts.map(tradingAccount => {
        if (tradingAccount.equity >= 100) {
            isValid = true;
            sTradingAccount = tradingAccount
        }
    })

    if (!isValid) {
        return res.status(200).send({
            success: false,
            error: "This user has no enough balance."
        })
    }

    const rsltPayout = await payoutIBFee(sTradingAccount, _user)

    if (!rsltPayout) {
        BotController.errors("Failed to payout reg fee"); 
        return res.status(200).send({ success: false, error: "Failed payout IB fee" });
    }

    let user_result = null;
    if (ibStatus === IBStatus.APPROVED) {
        let commissionType = await Database.Setting.getCommissionType();
        user_result = await Database.Account.updateIBStatus(req.body);
        if (user_result.parentAccountUuid) {
            let parentAccount = await Database.Account.findOneAccountByQuery({ accountUuid: user_result.parentAccountUuid });
            user_result.ibCommissionType = parentAccount.ibCommissionType || commissionType || 'Lot';
        } else {
            user_result.ibCommissionType = commissionType || 'Lot'
        }
        user_result.ibRanking = 0;
        user_result.isIBWithdraw = 1;
        user_result.ibFeePaied = true; 
        await user_result.save();
    } else {
        user_result = await Database.Account.updateIBStatus(req.body, null, null);
    }
    if (user_result) {
        if (ibStatus === IBStatus.APPROVED)
            await EmailController.sendIBApproved(user_result.email);
        else
            await EmailController.sendIBDecliend(user_result.email);
        return res.status(200).send({
            success: true,
            body: user_result
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "Failed to update IBStatus"
        })
    }
}
const getIBClients = async (req, res, next) => {

    const { eamil, accountUuid } = req;
    if (account) {
        const parentAccountUuid = accountUuid;
        const verification_status = KYCStatus.APPROVED;
        const _ibClients = await Database.Account.getIBOwnClients({ parentAccountUuid, verification_status });
        return res.status(200).send({
            success: true,
            body: _ibClients
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    }
}

const getIBOwnClients = async (req, res, next) => {
    const { email, accountUuid } = req;




    const user = await Database.Account.getAccountDetailByEmail(email);
    if (user && user.ibStatus == IBStatus.APPROVED) {
        let start = 0, end = 10;
        const commissionSetting = readSettings();

        if (user.ibRanking == 0 || user.ibRanking == 1) {
            start = 0;
            end = commissionSetting.rankingCommissionLevels[0];
        } else {
            start = commissionSetting.rankingCommissionLevels[user.ibRanking - 1];
            end = commissionSetting.rankingCommissionLevels[user.ibRanking];
        }

        /////// get tree and summary info 
        let summary = {
            totalQClients: 0,
            totalIbs: 0,
            totalVolume: 0
        }

        let result = await Database.Account.createIBClientTree(user.accountUuid, 0, start, end, summary);
        return res.status(200).send({
            success: true,
            body: result,
            summary
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "There are some problems with your account."
        })
    }
}


const getAccountInfo = async (req, res, next) => {

    const email = req.email;
    const accountUuid = req.accountUuid;

    let depositHistory = await Database.Deposit.getDepositAmountByUserId(accountUuid);
    let closedPositions = await PositionController._getClosedPositionsByClientUuid(0, new Date().getTime(), accountUuid);
    let activePositions = await PositionController._getAllPositionsByClientUuid(accountUuid);
    return res.status(200).send({
        success: true,
        body: {
            deposit: depositHistory && depositHistory.length && depositHistory[0].totalAmount,
            closedPositions,
        }
    })
}

const changePassword = async (req, res, next) => {

    try {
        const { email, accountUuid } = req;
        const { currentPassword, newPassword } = req.body;
        const _user = await Database.Account.getAccountDetailByEmail(email);
        const result = await bcrypt.compare(currentPassword, _user.password);

        if (result) {
            let result_BO = await BOController.Account.createPassword({ email: _user.email, password: newPassword });
            await Database.Account.updateAccountPassword(accountUuid, newPassword);
            return res.status(200).send({
                success: true,
                body: {

                }
            })
        } else {
            return res.status(200).send({
                success: false,
                error: "Password was not matched."
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Internal server error"
        })
    }
}

const changePasswordFP = async (req, res, next) => {
    try {
        const { password } = req.body;
        const _user = await Database.Account.getAccountDetailByEmail(global.resetEmail);
        if (!_user) {
            return res.status(404).send({ error: "User not found" });
        }

        let result = await BOController.Account.createPassword({ email: _user.email, password: password });
        global.resetEmail = "";
        // let result = await BOController.Account.updateUserInfo({ accountUuid: _user.accountUuid, password: newPassword });
        if (result) {
            await Database.Account.updateAccountPassword(_user.accountUuid, password);
            return res.status(200).send({
                success: true,
                body: {
                }
            })
        } else {
            return res.status(200).send({
                success: false,
                error: "Failed to update password."
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Failed to update password by Some issue."
        })
    }
}

const changePasswordFromAdmin = async (req, res, next) => {
    try {
        const { newPassword } = req.body;
        const { id } = req.params;
        const _user = await Database.Account.getAccountDetailByUuid(id);
        const { admin, remoteIp } = req;

        BotController.sendAdminLog(admin.email, remoteIp, `Changed password for user ${_user.email}`)

        let result = await BOController.Account.createPassword({ email: _user.email, password: newPassword });
        // let result = await BOController.Account.updateUserInfo({ accountUuid: _user.accountUuid, password: newPassword });
        if (result) {
            await Database.Account.updateAccountPassword(id, newPassword);
            return res.status(200).send({
                success: true,
                body: {

                }
            })
        } else {
            return res.status(200).send({
                success: false,
                error: "Failed to update password."
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Failed to update password by Some issue."
        })
    }
}
const changeEmail = async (req, res, next) => {
    try {
        const { newEmail } = req.body;
        const { id } = req.params;
        const _user = await Database.Account.getAccountDetailByUuid(id);

        const { admin, remoteIp } = req;

        if (admin) {
            BotController.sendAdminLog(admin.email, remoteIp, `Changed email from user ${_user.email} to ${newEmail}`)
        }

        let result = await BOController.Account.updateUserInfo({ accountUuid: _user.accountUuid, email: newEmail });
        if (result) {
            await Database.Account.updateAccountProfile(id, { email: newEmail });
            return res.status(200).send({
                success: true,
                body: {

                }
            })
        } else {
            return res.status(200).send({
                success: false,
                error: "Password was not matched."
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "Internal server error"
        })
    }
}
const googleSignIn = async (req, res, next) => {

    const { clientId, credential } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: `${process.env.GOOGLE_CLIENT_ID}`  // Specify the CLIENT_ID of the app that accesses the backend
        });

        // If token is valid, you'll get the decoded user's data
        const payload = ticket.getPayload();
        const { email, name: fullname } = payload;

        const user = await Database.Account.getAccountDetailByEmail(email);
        if (!user) {
            return res.redirect(`${process.env.FRONT_ENTRY}/login`);
        } else {
            var token = jwt.sign({ email, accountUuid: user.accountUuid }, config.secret, {
                expiresIn: 3599 // 1 hours
            });
            BotController.sendLogin(email);
            res.status(200).send(
                {
                    success: true,
                    body: {
                        ...user,
                        accessToken: token,
                    }
                });
        }
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
}
const createUserFromGoogle = async (req, res, next) => {

    const { clientId, credential } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: `${process.env.GOOGLE_CLIENT_ID}`  // Specify the CLIENT_ID of the app that accesses the backend
        });

        // If token is valid, you'll get the decoded user's data
        const payload = ticket.getPayload();
        const { email, name: fullname } = payload;

        let password = generatePassword(14);
        let result = await BOController.Account.registerUser({ email, fullname, password });
        if (!result) {
            return res.redirect(`${process.env.FRONT_ENTRY}/login`);
        }
        let branchUuid = await Database.Setting.getDefaultBranch();
        await Database.Account.createAccountSync({
            email,
            fullname,
            ...result.data,
            isEmailVerified: true,
            branchUuid
        })
        EmailController.sendTFACode(email, password);
        return res.redirect(`${process.env.FRONT_ENTRY}/login`);
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
}
const deleteUser = async (req, res, next) => {

    const { id } = req.params;
    const { admin, remoteIp } = req;
    BotController.sendAdminLog(admin?.email, remoteIp, `updateStatus user  ${_id}  to ${req.body.verification_status}`);

    let result = await Database.Account.updateVerifyStatus({ _id: id, status: KYCStatus.DELETED, remark: "" });

    return res.status(200).send({
        success: true,
    })

}
const approveBulkKYCStatus = async (req, res, next) => {
    const { ids } = req.body;
    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `approveBulkKYCStatus  at ${new Date} ${JSON.stringify(ids)}`)
    }
    try {
        for (let index = 0; index < ids.length; index++) {
            await Database.Account.updateVerifyStatus({ _id: ids[index], status: KYCStatus.APPROVED, remark: "" });
        }
        return res.status(200).send({
            success: true,
            body: ids
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
        })
    }
}
const rejectBulkKYCStatus = async (req, res, next) => {
    const { ids, remark } = req.body;

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `reject Bulk KYCStatus   ${JSON.stringify(ids)}`)
    }
    try {
        for (let index = 0; index < ids.length; index++) {
            let result = await Database.Account.updateVerifyStatus({ _id: ids[index], status: KYCStatus.REJECTED, remark });
            EmailController.sendUserDeclined(req.email, result.email);
        }
        return res.status(200).send({
            success: true,
            body: ids
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
        })
    }
}
const deleteBulkKYCStatus = async (req, res, next) => {
    const { ids, remark } = req.body;

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `approveBulkKYCStatus  ${JSON.stringify(ids)}`)
    }

    try {
        for (let index = 0; index < ids.length; index++) {
            let result = await Database.Account.updateVerifyStatus({ _id: ids[index], status: KYCStatus.DELETED, remark });
            BotController.deleteUser()
        }
        return res.status(200).send({
            success: true,
            body: ids
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
        })
    }
}

const approveBulkIBStatus = async (req, res, next) => {
    const { ids, remark } = req.body;
    for (let index = 0; index < ids.length; index++) {
        await _approveIBStatus(ids[index]);
    }
    return res.status(200).send({
        success: true
    })
}

const _approveIBStatus = async (id) => {
    let tradingAccount;
    const _user = await Database.Account.getAccountDetailById(id);
    tradingAccount = await Database.TradingAccount.getIBTradingAccountByAccountUuid(_user.accountUuid);
    if (!tradingAccount)
        tradingAccount = await Database.TradingAccount.createIBTradingAccount(id);
    if (!tradingAccount) {
        return false
    }
    let user_result = null;
    user_result = await Database.Account.updateIBStatus({ id, ibStatus: IBStatus.APPROVED }, tradingAccount.tradingAccountId, tradingAccount.tradingAccountUuid);
    BotController.errors(user_result);
    if (user_result) {
        EmailController.sendIBApproved(user_result.email);
    } else {
        return false;
    }
    return true;
}
const rejectBulkIBStatus = async (req, res, next) => {
    const { ids, remark } = req.body;
    for (let index = 0; index < ids; index++) {
        await _rejectIBStatus(ids[index], remark);
    }
    return res.status(200).send({
        success: true
    })
}
const _rejectIBStatus = async (id, remark) => {

    let user_result = null;
    user_result = await Database.Account.updateIBStatus({ id, ibStatus: IBStatus.DECLINED, remark }, tradingAccount.tradingAccountId, tradingAccount.tradingAccountUuid);
    if (user_result) {
        EmailController.sendIBDecliend(user_result.email);
    } else {
        return false;
    }
    return true;
}
const getIBUser = async (req, res, next) => {
    const accountUuid = req.params.id;
    try {
        const _ibUser = await Database.Account.getAccountDetailByUuid(accountUuid);
        if (_ibUser) {

            return res.status(200).send({
                success: true,
                body: {
                    accountUuid: _ibUser.accountUuid,
                    email: _ibUser.email,
                }
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false
        })
    }
}
const updateIBUser = async (req, res, next) => {
    const accountUuid = req.params.id;
    const data = req.body;
    try {
        const user = await Database.Account.updateAccountProfile(accountUuid, data);
        if (user) {
            return res.status(200).send({
                success: true,
            })
        }
    } catch (e) {
        return res.status(200).send({
            success: false
        })
    }
}

const resendVerifyEmail = (req, res) => {



}
const UserController = {
    changePasswordFP,
    changePasswordFromAdmin,
    changePassword,
    changeEmail,
    createUser,
    createUserFromGoogle,
    googleSignIn,
    getUserProfile,
    getUserProfileByUuid,
    getUsers,
    getSystemLogs,
    getIBClients,
    getIBOwnClients,
    getAccountInfo,

    saveUserProfile,
    deleteUser,
    saveUserProfileImage,

    updateProfileFromAdmin,
    updateUserBranch,
    updateIBCommissionType,
    updateStatus,
    approveAnway,
    verifyEmail,

    approveBulkKYCStatus,
    rejectBulkKYCStatus,
    deleteBulkKYCStatus,

    approveBulkIBStatus,
    rejectBulkIBStatus,
    getIBUser,
    updateIBStatus,
    updateIBUser,
    resendVerifyEmail,
    payoutIBFee,
    payoutIBFeeFromAdmin
}

module.exports = UserController; 

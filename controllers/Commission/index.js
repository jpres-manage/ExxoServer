var cron = require('node-cron');
const Database = require('../Database');
const LedgerController = require('../ledger');
const FileController = require("../Utils/file");
const path = require("path");
const BotController = require('../Bot');
const BalanceController = require('../balance');
const { min } = require('moment');
const ManagerApi = require('../Manager');
const SymbolController = require('../Symbol');
const { commissionTypes, DepositMode, KYCStatus, IBStatus, PaymentGateway, IBWDAllowState, IBBalanceLogType } = require('../constant');
const { userInfo } = require('os');
const User = require('../../models/user');
const IBCommission = require('../../models/ib_commission');
const Position = require('../../models/position');
const { exportJsonToExcel } = require('../../utils/helper');
const Wallet = require('../../models/wallet');
const { default: mongoose } = require('mongoose');
const IBBalanceLog = require('../../models/ib_balance_logs');

const commissionSetting = {
    setting: {}
}

const getLastAccessTime = () => {
    const absPath = path.resolve(__dirname + '/setting.json');
    let settings = FileController.readJsonFile(absPath);
    return settings.accessTime;
}

const readSettings = () => {
    const absPath = path.resolve(__dirname + '/setting.json');
    let settings = FileController.readJsonFile(absPath);
    return settings;
}

const writeSettings = (settings) => {
    const absPath = path.resolve(__dirname + '/setting.json');
    FileController.writeJsonFile(absPath, { ...settings });
}

const updateLastAccessTime = (time) => {
    const absPath = path.resolve(__dirname + '/setting.json');
    let settings = FileController.readJsonFile(absPath);
    FileController.writeJsonFile(absPath, {
        ...settings,
        accessTime: time
    });
}

const startCommissionMonitor = async () => {
    await checkClosedPosition();
    await CommissionController.depositIBCommissions();
    cron.schedule('0 0 */1 * * *', async () => {
        await checkClosedPosition();
        await CommissionController.depositIBCommissions();
    });
}

const getCommissionLevel = async (tradingAccountId) => {
    try {
        const tradingAccount = await Database.TradingAccount.getTradingAccountByTradintAccountId(tradingAccountId);
        const _offerUuid = tradingAccount.offerUuid;
        const _commissionLevel = await Database.Commission.getCommissionLevelForIB(_offerUuid);
        return _commissionLevel;
    } catch (e) {
        return false;
    }
}

const checkClosedPosition = async () => {
    try {
        commissionSetting.setting = readSettings();

        const _tradingAccounts = await Database.TradingAccount.getAllLiveTradingAccounts();
        const rangeEnd = (new Date()).getTime();
        const rangeStart = getLastAccessTime();

        let flag = true;
        for (let index = 0; index < _tradingAccounts.length; index += 100) {
            let end = index + 100;
            if (end > _tradingAccounts.length) end = _tradingAccounts.length;

            let __tradingAccounts = _tradingAccounts.slice(index, end);
            console.log({ __tradingAccounts });

            const _closedPositions = await LedgerController._getClosedTrades(rangeStart, rangeEnd, __tradingAccounts);

            if (_closedPositions) {
                const insertedResult = await Database.Position.insertManyClosedPositions(_closedPositions);
                for (let i = 0; i < insertedResult.length; i++) {
                    let position = insertedResult[i];
                    let _user = await Database.TradingAccount.getAccountDetailByTradingAccountId(position.clientId);
                    // //////////
                    let trTotalVolume = _user.trTotalVolume;
                    if (!_user.trTotalVolume) {
                        trTotalVolume = 0;
                    }

                    trTotalVolume += Math.abs(Number(position.closedVolume) / 100);

                    if (trTotalVolume > 1 && _user.isIBWithdraw !== IBWDAllowState.PER_DISABLED) {
                        await Database.Account.updateAccountProfile(_user.accountUuid, { trTotalVolume, isIBWithdraw: IBWDAllowState.ENABLED });
                    } else {
                        await Database.Account.updateAccountProfile(_user.accountUuid, { trTotalVolume });
                    }

                    /////////
                    await handleIBCommission(0, position, _user);
                }
            } else {
                flag = false;
            }
        }
        if (flag)
            updateLastAccessTime(rangeEnd);
    } catch (e) {
        BotController.errors(JSON.stringify(e), "checkClosedPosition");
    }
}
const handleIBCommission = async (ibDepth, position, userInfo) => {

    try {
        if (userInfo.parentAccountUuid) {
            const _userInfo = await Database.Account.getAccountDetailByUuid(userInfo.parentAccountUuid);
            if (_userInfo.verification_status !== KYCStatus.DELETED)
                handleIBCommission(ibDepth + 1, position, _userInfo);
        }
        if (ibDepth > 0) {
            const ibRanking = userInfo.ibRanking;
            BotController.errors({ ibDepth, ibRanking });
            if (commissionSetting.setting.rankingCommissionLevels[ibRanking] < ibDepth) {
                return;
            }
            const parentAccountUuid = userInfo.accountUuid;
            const { ibCommissionAmount, closedVolume } = await getIBCommissionAmout(ibDepth, position, userInfo);

            if (ibCommissionAmount === 0) {

                BotController.errors({ position, ibDepth, ibRanking, ibCommissionAmount, email: userInfo.email }, "IB commission amount 0");
                return

            };

            const comment = `IB Commission from ${position.closedClOrdId} : ${"#".repeat(ibDepth - 1)}`;

            // const user = await User.findOne({ accountUuid: parentAccountUuid });
            // const curIBBalance = user.ibBalance;
            // const newIBBalance = curIBBalance + ibCommissionAmount;
            // user.ibBalance = newIBBalance;

            // const rsltUsr = await user.save();

            let ibCommissionLog = new IBCommission({
                from: position.clientId,
                closedVolume,
                createdAt: new Date().getTime(),
                generatedTime: position.generatedTime,
                orderId: position.closedClOrdId,
                commissionAmount: ibCommissionAmount,
                positionID: position.uid,
                parentAccountUuid,
                comment,
                email: userInfo.email,
                depositState: 0,
                ibDepth,
                lastIBBalance: 0,
                newIBBalance: 0
            })

            // if (rsltUsr) {
            //     ibCommissionLog.depositState = 1
            // } else {
            //     ibCommissionLog.depositState = 0
            // }

            await ibCommissionLog.save();

        }
    } catch (e) {
        BotController.errors(e, "handleIBCommission");
        BotController.errors({ ibDepth, position, email: userInfo.email }, "Failed to creating IB commission");

    }
}

const getIBCommissionAmout = async (ibDepth, position, userInfo) => {
    try {
        const symbolInfo = await SymbolController.getSymbolInfo(position.instrument);
        let { closedAvgOpenPrice, closePrice, closedVolume, instrument } = position;
        const { decimalPlaces, volumePrecision, lotSize, contractSize, leverage, commissionPercentRatio, multiplier } = symbolInfo;

        const DecMass = Math.pow(10, Number(volumePrecision));
        const tradingAccount = await Database.TradingAccount.getTradingAccountByTradintAccountId(position.clientId);

        let levels = [];
        const commissionLevel = await Database.Commission.getCommissionLevelsBySymbolAndOffer(position.instrument, tradingAccount.offerUuid, userInfo.ibCommissionType);

        if (commissionLevel?.isAllInstrument) {
            levels = commissionLevel.levels;
        } else {
            const symbolLevels = await Database.SymbolLevel.getSymbolLevel({ symbolId: symbolInfo.symbolId, commissionLevelUuid: commissionLevel.commissionLevelUuid });
            if (symbolLevels) {
                levels = symbolLevels.levels.split(",");
            }
        }
        BotController.errors(levels, 'levels');
        let _comUnit = 0.1;
        if (levels.length) {
            _comUnit = Number(levels[Math.min(ibDepth, levels.length) - 1].trim());
        }

        const volumeLot = Math.abs((closedVolume / DecMass) / lotSize);

        if (userInfo.ibCommissionType === commissionTypes.COM_100K) {
            const _tradingAmount = Math.abs(Number(closedVolume)) * Number(contractSize) * (Number(closedAvgOpenPrice) + Number(closedAvgOpenPrice)) / (2 * DecMass * DecMass)
            return { ibCommissionAmount: _tradingAmount * _comUnit * 10 / 1000000, closedVolume: volumeLot }
        } else if (userInfo.ibCommissionType === commissionTypes.COM_LOT) {
            return { ibCommissionAmount: volumeLot * _comUnit * 10 / 10, closedVolume: volumeLot };
        } else if (userInfo.ibCommissionType === commissionTypes.COM_MEDIUM) {

        }
    } catch (e) {
        BotController.errors(JSON.stringify(e), "IB checking");
        console.log(e)
        return 0;
    }
}

const makeCommissionForTrading = async (ibDepth, accountUuid) => {


}
const _checkClosedPosition = async (req, res, next) => {
    const { eamil, adminUuid, role } = req;

    try {
        await checkClosedPosition();
        await CommissionController.depositIBCommissions();
        return res.status(200).send({
            success: true,
            body: IBCommissionHistory
        })
    } catch (e) {
        return res.status(200).send({ success: false, error: "Failed to refersh" })
    }
}

const evalRankingFromAdmin = async (req, res) => {

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `started ranking reset `)
    }
    await startCheckRanking(false);    // by admin
    return res.status(200).send("ok");

}

const startCheckRanking = async (bAuto = true) => {

    const setting = readSettings();

    let currentTime = new Date().getTime();
    let prevTime = currentTime - setting.resetPeriod * 86400 * 1000;

    await checkQualifiedClient(prevTime, currentTime);
    await checkQualifiedIB(setting.rankingOwnNumbers[0]);
    await checkIBRankings(setting);
}

const checkQualifiedClient = async (start, end) => {
    const clients = await User.find({});
    for (let client of clients) {
        let totalClosedVolume = await getTotalUserClosedVolume(client.email, start, end);
        if (totalClosedVolume >= 1) {
            client.isQClient = true;
        } else {
            client.isQClient = false;
        }
        await client.save();
    }
}

const getTotalUserClosedVolume = async (email, start = 0, end = (new Date()).getTime()) => {
    let tradingAccounts = await Database.TradingAccount.getTradingAccountByEmail(email);
    if (tradingAccounts) {
        let clientIds = tradingAccounts.map(tradingAccount => {
            if (!tradingAccount.isDemo) {
                return tradingAccount.tradingAccountId
            }
        }).filter(v => !!v);

        let totalClosedVolume = await Database.Position.getTotalVolume(start, end, clientIds);
        return totalClosedVolume;
    }
    return 0;
}

// QC_limit from Setting count of qualified clients for qualified ib client
const checkQualifiedIB = async (QC_limit) => {
    try {
        let ibClients = await Database.Account.getIBClients();
        for (let ibClient of ibClients) {
            const parentAccountUuid = ibClient.accountUuid;
            const verification_status = KYCStatus.APPROVED;
            const ibOwnClients = await Database.Account.getIBOwnClients({ parentAccountUuid, verification_status });
            let countOfQClient = 0;
            for (let ibOwnClient of ibOwnClients) {
                if (ibOwnClient.isQClient) {
                    countOfQClient++;
                }
            }
            if (countOfQClient >= QC_limit) {
                await Database.Account.updateAccountProfile(ibClient.accountUuid, { isQIB: true, ibRanking: 1 });
            } else {
                await Database.Account.updateAccountProfile(ibClient.accountUuid, { isQIB: false, ibRanking: 0 });
            }
        }
    } catch (e) {
        console.log(e);
        return;
    }
}
const depositIBCommissions = async () => {
    const ibCommissions = await IBCommission.find({ depositState: 0 });
    BotController.errors(ibCommissions, "ib commissions");

    for (let ibCommission of ibCommissions) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();
            const opts = { new: true, session };

            BotController.errors(ibCommission, "IB commission");
            const user = await User.findOneAndUpdate(
                { accountUuid: ibCommission.parentAccountUuid },
                { $inc: { ibBalance: ibCommission.commissionAmount } },
                opts
            );

            if (!user) {
                throw new Error("User not found");
            }

            const curIBBalance = user.ibBalance - Number(ibCommission.commissionAmount);
            const newIBBalance = user.ibBalance;

            ibCommission.lastIBBalance = curIBBalance;
            ibCommission.newIBBalance = newIBBalance;
            ibCommission.depositState = 1;
            ibCommission.createdAt = new Date();
            await ibCommission.save({ session });

            const ibBlanaceLog = new IBBalanceLog({
                clientUuid: user.accountUuid,
                amount: ibCommission.commissionAmount, 
                newBalance: user.ibBalance, 
                logType: IBBalanceLogType.IB_COMMISSION, 
                createdAt: new Date, 
                from: ibCommission._id
            })
            await ibBlanaceLog.save({session})

            await session.commitTransaction();
        } catch (e) {
            await session.abortTransaction();
            BotController.errors(e, "Transaction failed");
            throw e; // Rethrow the error after logging
        } finally {
            session.endSession(); // Ensure session is always closed
        }
    }
};

// "maxCommissionLevel":10, 
// "rankingLabels": ["Q", "S1", "S2", "S3", "S4"], 
// "rankingCommissionLevels":[3, 4, 6, 8, 10],
// "rankingMinVolume":[0, 100, 300, 600, 1000], 
// "rankingOwnNumbers":[3, 3, 3, 3, 3], 
// "resetPeriod":90
const checkIBRankings = async (setting) => {

    const rankingCount = setting.rankingLabels.length;
    for (let index = 2; index < rankingCount; index++) {

        let prevLevel = setting.rankingLabels[index - 1];
        let curLevel = setting.rankingLabels[index];
        let minVolume = setting.rankingMinVolume[index];
        let ownNumber = setting.rankingOwnNumbers[index];

        await checkIBRankingLevel(index - 1, index, minVolume, ownNumber);
    }
}

const getLowRankingCounts = async (depth, ranking, parentAccountUuid, IBMember) => {
    if (depth <= 0) return;

    const verification_status = KYCStatus.APPROVED;
    const ibStatus = IBStatus.APPROVED;
    const ibOwnClients = await Database.Account.getIBOwnClients({ parentAccountUuid, verification_status, ibStatus });
    for (let ibOwnClient of ibOwnClients) {
        if (ibOwnClient.ibRanking === ranking) {
            IBMember.count++;
        }
        if (ibOwnClient.ibStatus === IBStatus.APPROVED) {
            await getLowRankingCounts(depth - 1, ranking, ibOwnClient.accountUuid, IBMember);
        }
    }
}

const checkIBRankingLevel = async (prevLevel, curLevel, minVolume, ownNumber) => {  // rIndex: Ranking index in setting

    const setting = readSettings();
    let ibClients = await Database.Account.getIBClients();
    const currentTime = (new Date()).getTime();
    for (let ibClient of ibClients) {
        try {

            // if raking is same or grater than checking ranking 
            if (ibClient.ibRanking >= curLevel && currentTime < ibClient.ibRankingUpdated + setting.resetPeriod * 86400 * 1000)
                continue;

            const parentAccountUuid = ibClient.accountUuid;
            const verification_status = KYCStatus.APPROVED;
            const ibOwnClients = await Database.Account.getIBOwnClients({ parentAccountUuid, verification_status });
            let totalClosedVolume = 0;
            let IBMember = {
                count: 0
            }
            for (let ibOwnClient of ibOwnClients) {
                if (ibOwnClient.ibRanking === prevLevel) {
                    IBMember.count++;
                }
                totalClosedVolume += await getTotalUserClosedVolume(ibOwnClient.email);
                if (ibOwnClient.ibStatus === IBStatus.APPROVED) {
                    await getLowRankingCounts(setting.rankingCommissionLevels[curLevel] - 1, curLevel, ibOwnClient.accountUuid, IBMember);
                }
            }
            if (IBMember.count >= ownNumber && totalClosedVolume > minVolume) {
                await Database.Account.updateAccountProfile(ibClient.accountUuid, { isQClient: true, ibRanking: curLevel, ibRankingUpdated: currentTime });
            }
        } catch (e) {
            console.log(e);
            return;
        }
    }
}

const updateIBRanking = async (req, res) => {
    const { ibRanking } = req.body;
    const {id:accountUuid} = req.params;
    const { admin, remoteIp } = req;

    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `updated IB ranking ${accountUuid} to ${ibRanking} `)
    }

    try {
        const result = await Database.Account.updateAccountProfile(accountUuid, { ibRanking });
        return res.status(200).send({
            success: true,
            body: result
        });
    } catch (e) {
        return res.status(500).send("failed");
    }
}

const getRankingTypes = async (req, res) => {
    try {
        let commissionSettings = readSettings();
        let rankingLabels = commissionSettings.rankingLabels;
        return res.status(200).send({
            success: true,
            body: rankingLabels
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
        })
    }
}

const getIBRankingName = (ibRanking) => {
    const setting = readSettings();
    let rankingName = setting.rankingLabels[ibRanking];
    if (ibRanking > 0) rankingName = "IB_" + rankingName;
    return rankingName;
}


const syncIBCommissionGenTimeOrderID = async (req, res) => {

    const ibCommissions = await IBCommission.find({});
    // const ibCommissions = await IBCommission.find({generatedTime: null}); 
    for (let ibCommission of ibCommissions) {
        const position = await Position.findOne({ uid: ibCommission.positionID }).lean();
        ibCommission.generatedTime = position.generatedTime;
        ibCommission.orderId = position.closedClOrdId;
        await ibCommission.save();
    }
    return res.status(200).send("OK");
}

const resetIBDepth = async (req, res) => {
    try {
        const tradingAccounts = await Wallet.aggregate([
            {
                $match: {
                    isDemo: false,
                }
            },
            {
                $lookup: {
                    from: "offers",
                    foreignField: "uuid",
                    localField: "offerUuid",
                    as: "offer"
                }
            },
            {
                $unwind: "$offer"
            },
            {
                $match: {
                    "offer.name": {
                        $ne: "Exxo IB"
                    }
                }
            },
            {
                $project: {
                    email: 1,
                    tradingAccountId: 1,
                }
            }
        ])


        tradingAccounts.map(async (tradingAccount) => {
            const user = await Database.Account.getAccountDetailByEmail(tradingAccount.email);
            await resetIBDepthByAccount(tradingAccount.tradingAccountId, user, 0);
        })

    } catch (e) {

        console.log(e);
    }

    return res.status(200).send("ok")

}

const resetIBDepthByAccount = async (tradingAccount, user, depth) => {
    try {
        const parentTradingAccountId = user.parentTradingAccountId;
        if (!parentTradingAccountId) return;
        const result = await IBCommission.updateMany({ from: tradingAccount, ibTradingAccountId: parentTradingAccountId }, { ibDepth: depth + 1 });
        const parent = await User.findOne({ ibParentTradingAccountId: parentTradingAccountId }).lean();
        await resetIBDepthByAccount(tradingAccount, parent, depth + 1);
    } catch (e) {

    }
}


/// for user request
const getIBUserReport = async (req, res, next) => {
    try {

        const email = req.email;
        const { start, end } = req.body;

        const ibUser = await Database.Account.getAccountDetailByEmail(email);

        if (ibUser.ibStatus !== IBStatus.APPROVED) return res.status(400).send("Bad Request: No valid ib user");

        const fileName = await getIBReportByUser(ibUser, start, end);

        const filePath = path.join(__dirname, `../../public/excels/${fileName}`);

        res.download(filePath, fileName, (err) => {
            if (err) {
                // Handle error, but don't expose to the user
                console.error('Error downloading file:', err);
                res.status(500).send('Error downloading file');
            }
        });
    } catch (e) {
        console.log(e);
        return res.status(400).send("Invalid requrest");
    }
}

const getIBReportByUser = async (ibUser, start, end) => {

    try {
        const parentAccountUuid = ibUser.accountUuid;
        let ibCommissions = await IBCommission.aggregate([
            {
                $match: {
                    parentAccountUuid: parentAccountUuid,
                    createdAt: {
                        $gte: new Date(start),
                        $lte: new Date(end)
                    },
                    depositState: 1
                }
            },

        ])

        let totalAmount = 0, totalVolume = 0

        let _ibCommissions = [];
        for (let ibCommission of ibCommissions) {
            try {
                totalAmount += Number.isFinite(ibCommission.commissionAmount) ? ibCommission.commissionAmount : 0;
                totalVolume += Number.isFinite(ibCommission.closedVolume) ? ibCommission.closedVolume : 0;
                const position = await Position.findOne({ uid: ibCommission.positionID });

                let _ibCommission = {};
                _ibCommission.commissionAmount = ibCommission.commissionAmount;
                _ibCommission.closedVolume = ibCommission.closedVolume;
                _ibCommission.from = ibCommission.from;
                _ibCommission.instrument = position.instrument;
                _ibCommission.generatingOrdId = position.closedClOrdId;
                _ibCommission.generatedTime = new Date(position.generatedTime).toUTCString();
                _ibCommission.ibDepth = ibCommission.ibDepth;
                _ibCommission.lastIBBalance = ibCommission.lastIBBalance;
                _ibCommission.newIBBalance = ibCommission.newIBBalance;
                _ibCommissions.push(_ibCommission);

            } catch (e) {
                console.log(e)
            }
        }

        _ibCommissions = [{ commissionAmount: totalAmount, closedVolume: totalVolume }, ..._ibCommissions];

        const filePath = `${new Date().getTime()}_export.xls`;
        exportJsonToExcel(_ibCommissions, filePath)

        return filePath;

    } catch (e) {
        console.log(e)
    }
}



const getAdminIBReports = async (req, res) => {

    const { start, end } = req.body;

    try {
        let ibCommissions = await IBCommission.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(start),
                        $lte: new Date(end)
                    },
                    depositState: 1
                }
            },
            {
                $sort: {
                    createdAt: 1
                }
            },
            {
                $facet: {
                    "report": [
                        {
                            $group: {
                                _id: "$parentAccountUuid",
                                closedVolume: { $sum: "$closedVolume" },
                                commissionAmount: { $sum: "$commissionAmount" },
                                parentAccountUuid: { $first: "$parentAccountUuid" },
                                email: { $first: "$email" },
                                lastIBBalance: { $first: "$lastIBBalance" },
                                newIBBalance: { $last: "$newIBBalance" }
                            }
                        }
                    ],
                    "totalInfo": [
                        {
                            $group: {
                                _id: "$positionID",
                                commissionAmount: { $first: "$commissionAmount" },
                                closedVolume: { $first: "$closedVolume" }
                            }
                        }
                    ]
                }
            },
        ])

        let totalAmount = 0, totalVolume = 0

        const ibSetting = readSettings();
        let _ibCommissions = [];
        for (let ibCommission of ibCommissions[0]?.report) {
            try {


                const user = await Database.Account.getAccountDetailByEmail(ibCommission.email);

                let _ibCommission = {};
                _ibCommission.commissionAmount = ibCommission.commissionAmount;
                _ibCommission.closedVolume = ibCommission.closedVolume;
                _ibCommission.email = ibCommission.email;
                _ibCommission.ibRanking = ibSetting.rankingLabels[user.ibRanking];
                _ibCommission.lastIBBalance = ibCommission.lastIBBalance;
                _ibCommission.newIBBalance = ibCommission.newIBBalance;
                _ibCommission.CurBalance = user.ibBalance;

                _ibCommissions.push(_ibCommission);

            } catch (e) {
                console.log(e)
            }
        }
        ibCommissions[0]?.totalInfo.map(positionInfo => {
            totalAmount += Math.abs(positionInfo.commissionAmount);
            totalVolume += Math.abs(positionInfo.closedVolume);
        })

        _ibCommissions = [{ commissionAmount: totalAmount, closedVolume: totalVolume }, ..._ibCommissions];
        const fileName = `${(new Date()).getTime()}_export.xls`;
        exportJsonToExcel(_ibCommissions, fileName);
        const filePath = path.join(__dirname, `../../public/excels/${fileName}`);

        res.download(filePath, fileName, (err) => {
            if (err) {
                // Handle error, but don't expose to the user
                console.error('Error downloading file:', err);
                res.status(500).send('Error downloading file');
            }
        });

        return filePath;

    } catch (e) {
        console.log(e)
    }
}

const getAdminIBReportsByUser = async (req, res) => {

    const { email, startDate, endDate } = req.body;

    const ibUser = await Database.Account.getAccountDetailByEmail(email);

    const fileName = await getIBReportByUser(ibUser, startDate, endDate);

    const filePath = path.join(__dirname, `../../public/excels/${fileName}`);

    res.download(filePath, fileName, (err) => {
        if (err) {
            // Handle error, but don't expose to the user
            console.error('Error downloading file:', err);
            res.status(500).send('Error downloading file');
        }
    });
}
const getAdminIBBalanceReportsByUser = async (req, res) => {

    const { email, startDate, endDate } = req.body;

    const ibUser = await Database.Account.getAccountDetailByEmail(email);

    const ibBalanceLogs = await IBBalanceLog.aggregate([
        {
            $match:{
                createdAt: {
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate)
                }, 
                clientUuid: ibUser.accountUuid
            }, 
        }, 
        {
            $sort: {
                createdAt: -1
            }
        }
    ])
    const fileName = `${(new Date()).getTime()}_export.xls`;
    exportJsonToExcel(ibBalanceLogs, fileName);
    const filePath = path.join(__dirname, `../../public/excels/${fileName}`);

    res.download(filePath, fileName, (err) => {
        if (err) {
            // Handle error, but don't expose to the user
            console.error('Error downloading file:', err);
            res.status(500).send('Error downloading file');
        }
    });
}

const CommissionController = {
    startCommissionMonitor,
    checkClosedPosition,
    _checkClosedPosition,
    startCheckRanking,
    readSettings,
    writeSettings,
    evalRankingFromAdmin,
    updateIBRanking,
    getRankingTypes,
    getIBRankingName,
    depositIBCommissions,
    getIBReportByUser,
    getAdminIBReports,
    resetIBDepth,
    getIBUserReport,
    getAdminIBReportsByUser,
    getAdminIBBalanceReportsByUser, 
    syncIBCommissionGenTimeOrderID
}

module.exports = CommissionController; 
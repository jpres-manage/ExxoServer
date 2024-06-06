const Database = require("./Database");
const { IBStatus, KYCStatus, commissionTypeNames, DepositMode } = require("./constant");
const BotController = require("./Bot");
const { readSettings } = require("./Commission");
const IBCommission = require("../models/ib_commission");

const getIBClients = async (req, res, next) => {
    
    const { adminUuid, role } = req;

    let result = await Database.Account.getIBClients({ adminUuid, role });
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const getIBOwnClients = async (req, res, next) => {

    const id = req.params.id;
    const account = await Database.Account.getAccountDetailById(id);
    if (account) {
        const parentAccountUuid = account.accountUuid;
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

const getIBOwnClientsTree = async (req, res, next) => {

    const id = req.params.id;
    const account = await Database.Account.getAccountDetailById(id);

    console.log({ account })
    if (account) {
        const parentAccountUuid = account.accountUuid;
        const verification_status = KYCStatus.APPROVED;

        /////////// Get setting for IB ranking
        let start = 0, end = 10;
        const commissionSetting = readSettings();
        const index = account.ibRanking;
        if (index == 0 || index == 1) {
            start = 0;
            end = commissionSetting.rankingCommissionLevels[0];
        } else {
            start = commissionSetting.rankingCommissionLevels[index - 1];
            end = commissionSetting.rankingCommissionLevels[index];
        }
        /////// get tree and summary info 
        let summary = {
            totalQClients: 0,
            totalIbs: 0,
            totalVolume: 0,
            totalUsers: 0
        }
        const _ibClients = await Database.Account.createIBClientTree(parentAccountUuid, 0, start, end, summary);
        summary.totalUsers = await Database.Account.getTotalIBOwnUsers(parentAccountUuid);
        summary.totalVolume = await Database.Account.getIBTotalVolume(parentAccountUuid);

        console.log({ _ibClients });
        return res.status(200).send({
            success: true,
            body: _ibClients,
            summary: summary
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "Internal Server Error"
        })
    }
}



const getIBCommissions = async (req, res, next) => {

    let result;
    result = await Database.Commission.getAllCommmissions();
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: false,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const getIBCommissionReports = async (req, res, next) => {
    const { email, adminUuid, role } = req;
    const { from, to } = req.query;
    try {
        let result = await Database.Deposit.exportIBCommissionHistory(adminUuid, role, from, to);
        return res.status(200).send({
            success: true,
            body: result
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "server error"
        })
    }
}
const getIBCommissionHistory = async (req, res, next) => {

    const { email, adminUuid, role } = req;
    const { from, to } = req.query;

    try {
        let result = await Database.Deposit.getIBCommissionHistory(adminUuid, role, from, to);
        // let result = await Database.Deposit.exportIBCommissionHistory(adminUuid, role, from, to);
        return res.status(200).send({
            success: true,
            body: result
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
            error: "server error"
        })
    }
}
//// From admin 
const getIBPaymentHistory =async (req, res, next)=>{

    try{
        const userId = req.params.id; 
        const user = await Database.Account.getAccountDetailById(userId);
        const query = {
            depositMode: DepositMode.IB_INTERNAL, 
            email: user.email
        }
        let result = await Database.Deposit.getData({
            ...query
        }); 
        return res.status(200).send({success: true, body: result}); 

    }catch(e){
        return res.status(400).send("Bad Request"); 
    }
}

//// From User 
const getIBPaymentHistoryForUser =async (req, res, next)=>{

    try{
        const accountUuid = req.accountUuid; 
        const user = await Database.Account.getAccountDetailByUuid(accountUuid);
        const query = {
            depositMode: DepositMode.IB_INTERNAL, 
            email: user.email
        }
        let result = await Database.Deposit.getData({
            ...query
        }, {createdAt: -1}); 
        return res.status(200).send({success: true, body: result}); 

    }catch(e){
        return res.status(400).send("Bad Request"); 
    }
}



const getIBAllPaymentHistory = async(req, res, next)=>{

    const {email, from, to, tradingAccountId, pageNo, pageItems} = req.query; 

    const match= {
        createdAt: {
            $gte: new Date(from), 
            $lte: new Date(to),
        },
        depositMode: DepositMode.IB_INTERNAL, 
    }
    try{
        const result =await Database.Deposit.getData({...match}, {createdAt: -1}); 
        return res.status(200).send({success: true, body: result}); 
    }catch(e){
        return res.status(200).send({success: false, error: "Bad request"}); 
    }
}
const createCommission = async (req, res, next) => {

    let result;
    const { admin, remoteIp } = req;

    if (await Database.Commission.checkCommissionExistByName(req.body.name)) {
        return res.status(200).send({
            success: false,
            code: 502,
            error: "Name already exist"
        })
    }
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `create Commission ${req.body.name}`)
    }
    result = await Database.Commission.createCommission({ ...req.body });
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const creteCommissionLevel = async (req, res, next) => {

    let result;
    const data = req.body;
    result = await Database.Commission.createCommissionLevel(data);

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `create commission level  ${JSON.stringify(data)} `)
    }
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: false,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const deleteCommissionLevel = async (req, res, next) => {
    try {
        const commissionLevelUuid = req.params.id;
        await Database.Commission.deleteCommissionLevelByUuid(commissionLevelUuid);
        return res.status(200).send({
            success: true
        })
    } catch (e) {
        return res.status(200).send({ success: false });
    }
}

const updateCommissionLevel = async (req, res, next) => {

    const id = req.params.id;
    let result;
    const { isAllInstrument, symbolLevels } = req.body;
    result = await Database.Commission.updateCommissionLevel(id, req.body);
    if (!isAllInstrument) {
        for (let symbolLevel of symbolLevels) {
            await Database.SymbolLevel.updateSymbolLevel({ ...symbolLevel, commissionLevelUuid: id });
        }
    }
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const updateCommission = async (req, res, next) => {

    let result;

    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const addCommissionLevel = async (req, res, next) => {

    let result;
    const { commissionUuid, ...data } = req.body;


    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Internal Server Error"
        })
    }
}
const deleteCommission = async (req, res, next) => {
    let result;
    const commissionUuid = req.params.id;
    result = await Database.Commission.deleteCommissionByUuid(commissionUuid);
    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Cann't delete this Commission."
        })
    }
}
const getCommissionDetail = async (req, res, next) => {
    let result;
    const commissionUuid = req.params.id;
    result = await Database.Commission.getCommissionDetails({ commissionUuid });

    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Commission does not exist with give Id."
        })
    }
}
const getCommissoinLevels = async (req, res, next) => {
    let result;
    const commissionUuid = req.params.id;
    result = await Database.Commission.getCommissoinLevelsForCommission(commissionUuid);

    if (result) {
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } else {
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Commission does not exist with give Id."
        })
    }
}
const getCommissoinTypes = async (req, res, next) => {
    try {
        let result;
        const _usedCommissions = await Database.Commission.getAllCommmissions();
        result = commissionTypeNames.filter(item => _usedCommissions.findIndex(ele => ele.commissionType === item) !== -1);
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } catch (e) {
        BotController.errors(e, "getCommissoinTypes");
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Commission does not exist with give Id."
        })
    }
}
const getUnusedCommissoinTypes = async (req, res, next) => {
    try {
        let result;
        const _usedCommissions = await Database.Commission.getAllCommmissions();
        result = commissionTypeNames.filter(item => _usedCommissions.findIndex(ele => ele.commissionType === item) === -1);
        return res.status(200).send({
            success: true,
            code: 200,
            body: result
        })
    } catch (e) {
        BotController.errors(e, "getCommissoinTypes");
        return res.status(200).send({
            success: true,
            code: 500,
            error: "Commission does not exist with give Id."
        })
    }
}
const getCommissionLevelByUuid = async (req, res, next) => {

    const id = req.params.id;
    let _commissionLevel = await Database.Commission.getCommissionLevelByUuid(id);
    if (_commissionLevel)
        return res.status(200).send({
            success: true,
            body: _commissionLevel
        })
    else
        return res.status(200).send({
            success: false,
            error: "Error"
        })
}

const getCommisssionSymbolLevels = async (req, res, next) => {

    const id = req.params.id;
    try {
        let result = await Database.SymbolLevel.getSymbolLevelsByCLUuid(id);
        return res.status(200).send({
            success: true,
            body: result
        })
    } catch (e) {
        return res.status(200).send({
            success: false,
        })
    }
}

const getIBCommissionInfoForUser = async (req, res, next) => {
    try {
        const { email, accountUuid } = req;

        const user =await Database.Account.getAccountDetailByEmail(email)

          // Define the start date for commission aggregation
        const startDate = new Date("2024-05-26T00:00:00Z"); 

        const ibCommissions = await IBCommission.aggregate([
            {
                $match: {
                    email, 
                    createdAt: {
                        $gte: startDate
                    }, 
                    depositState: 1
                }
            }, 
            {
                $group:{
                    _id: null, 
                    totalAmount: {$sum: 
                        {
                            $abs: "$commissionAmount"
                        }
                    }, 
                    totalClosedVolume: {$sum: "$closedVolume"}
                }
            }
        ])
        if(ibCommissions.length>0){
            return res.status(200).send({
                success: true,
                body: {
                    ...ibCommissions[0], 
                    ibBalance: user.ibBalance
                },
            })
        }else{
            return res.status(200).send({
                success: true,
                body: {
                    ibBalance: user.ibBalance
                },
            })
        }
    } catch (e) {
        BotController.errors(JSON.stringify(e), "getIBCommissions")
    }
}

const getIBReport = async (req, res, next) => {
    try {

        const { id } = req.params;
        const { date } = req.query;

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 99);

        const ibUser = await Database.Account.getAccountDetailById(id);

        const match = {
            email: ibUser.email,
            createdAt: {
                $gte: start,
                $lte: end
            },
            depositState: 1
        }
        // Define the aggregation pipeline
        const aggregationPipeline = [
            {
                $match: {
                    ...match
                }
            },
            {
                $group: {
                    _id: "$from", // Group by email
                    ClosedVolume: { $sum: "$closedVolume" },
                    CommissionAmount: { $sum: "$commissionAmount" },
                    ibDepth: {$first: "$ibDepth"}
                }
            },
            {
                $lookup: {
                    from: 'wallets',
                    foreignField: "tradingAccountId",
                    localField: "_id",
                    as: "wallet"
                }
            },
            {
                $unwind: "$wallet"
            },
            {
                $project: {
                    from: "$_id",
                    ClosedVolume: 1,
                    CommissionAmount: 1,
                    email: "$wallet.email",
                    ibDepth: 1
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "email",
                    foreignField: "email",
                    as: "user"
                }
            },
            {
                $project:{
                    email: "$user.email",
                    Volume: "$ClosedVolume",
                    Amount: "$CommissionAmount",
                    Ranking: {
                        $switch: {
                            branches: [
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 0] }, then: "IB" },
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 1] }, then: "Q" },
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 2] }, then: "E1" },
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 3] }, then: "E2" },
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 4] }, then: "E3" },
                                { case: { $eq: [{ $arrayElemAt: ["$user.ibRanking", 0] }, 5] }, then: "E4" }
                            ],
                            default: "Unknown"
                        }
                    } ,
                    ibBalance: "$user.ibBalance", 
                    depth: "$ibDepth"
                }
            }
        ];
        let ibReports = await IBCommission.aggregate(aggregationPipeline);

        ibReports = [{
            
            _id: "From",
            email: "email",
            Volume: "Closed Volume",
            Amount: "CommissionAmount",
            Ranking: "ibRanking",
            ibBalance: "ibBalance", 
            depth:"Depth"
            
        }, ...ibReports]
        return res.status(200).send({ success: true, body: ibReports })

    } catch (e) {
        console.log(e)
        return res.status(200).send({ success: false })
    }
}

const IBCommissionCotroller = {
    getIBClients,
    getIBOwnClients,
    getIBOwnClientsTree,
    createCommission,
    updateCommission,
    getIBCommissions,
    deleteCommission,
    getCommissionDetail,
    addCommissionLevel,
    creteCommissionLevel,
    deleteCommissionLevel,
    updateCommissionLevel,
    getCommissoinLevels,
    getCommissionLevelByUuid,
    getCommisssionSymbolLevels,
    getCommissoinTypes,
    getIBCommissionHistory,
    getIBPaymentHistory,
    getIBAllPaymentHistory, 
    getIBCommissionReports,
    getIBReport,
    getIBCommissionInfoForUser,
    getUnusedCommissoinTypes,
    getIBPaymentHistoryForUser
}

module.exports = IBCommissionCotroller;
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
const { commissionTypes, DepositMode, KYCStatus } = require('../constant');
const { userInfo } = require('os');

const getLastAccessTime = () => {
    const absPath = path.resolve(__dirname + '/setting.json');
    let settings = FileController.readJsonFile(absPath);
    return settings.accessTime;
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
    checkClosedPosition();
    cron.schedule('0 */30 * * * *', () => {
        checkClosedPosition();
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
        const _tradingAccounts = await Database.TradingAccount.getAllTradingAccounts();
        const rangeEnd = (new Date()).getTime();
        const rangeStart = getLastAccessTime();
        const _closedPositions = await LedgerController._getClosedTrades(rangeStart, rangeEnd, _tradingAccounts);
        await Database.Position.insertManyClosedPositions(_closedPositions);
        if (_closedPositions) {
            updateLastAccessTime(rangeEnd);
            for (let i = 0; i < _closedPositions.length; i++) {
                let position = _closedPositions[i];
                let _user = await Database.TradingAccount.getAccountDetailByTradingAccountId(position.clientId);
                await handleIBCommission(0, position, _user);
            }
        } else {

        }
    } catch (e) {
        BotController.errors(JSON.stringify(e), "checkClosedPosition");
    }
}
const handleIBCommission = async (ibDepth, position, userInfo) => {

    try {
        if (userInfo.parentTradingAccountId) {
            const _userInfo = await Database.TradingAccount.getAccountDetailByTradingAccountId(userInfo.parentTradingAccountId);
            if (_userInfo.verification_status !== KYCStatus.DELETED)
                handleIBCommission(ibDepth + 1, position, _userInfo);
        }
        if (ibDepth > 0) {
            console.log(ibDepth, "ibDepth");
            const ibTradingAccountId = userInfo.ibParentTradingAccountId;
            const ibCommissionAmount = await getIBCommissionAmout(ibDepth, position, userInfo);
            const comment = `IB Commission from ${position.closedClOrdId} : ${"#".repeat(ibDepth - 1)}`;
            const result = await BalanceController._depositToTradingAccountId(ibCommissionAmount, ibCommissionAmount, DepositMode.IB_COMMISSION, ibTradingAccountId, "USD",
                comment, "System", userInfo.email, userInfo.accountUuid, 0, position.clientId);
        }
    } catch (e) {
        BotController.errors(e, "handleIBCommission");
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

        if (commissionLevel.isAllInstrument) {
            levels = commissionLevel.levels;
        } else {
            const symbolLevels = await Database.SymbolLevel.getSymbolLevel({ symbolId: symbolInfo.symbolId, commissionLevelUuid: commissionLevel.commissionLevelUuid });
            if (symbolLevels) {
                levels = symbolLevels.levels.split(",");
            }
        }

        let _comUnit = 0.1;
        if (levels.length) {
            _comUnit = Number(levels[Math.min(ibDepth, levels.length) - 1]);
        }
        BotController.errors(_comUnit, "levels"); 

        console.log(levels, _comUnit, ibDepth, position, userInfo, symbolInfo); 

        if (userInfo.ibCommissionType === commissionTypes.COM_100K) {
            const _tradingAmount = Math.abs(Number(closedVolume)) * Number(contractSize) * (Number(closedAvgOpenPrice) + Number(closedAvgOpenPrice)) / (2 * DecMass * DecMass)
            return _tradingAmount * _comUnit *10/ 1000000
        } else if (userInfo.ibCommissionType === commissionTypes.COM_LOT) {
            console.log(Math.abs((closedVolume / DecMass) / lotSize), "real voloume");
            return Math.abs((closedVolume / DecMass) / lotSize) * _comUnit*10/10;
        } else if (userInfo.ibCommissionType === commissionTypes.COM_MEDIUM) {

        }
    } catch (e) {
        console.log(e)
        return 0;
    }
}

const makeCommissionForTrading = async (ibDepth, accountUuid) => {


}

const _checkClosedPosition = async (req, res, next) => {
    const { eamil, adminUuid, role } = req;

    await checkClosedPosition();
    const IBCommissionHistory = await Database.Deposit.getIBCommissionHistory(adminUuid, role);
    if (IBCommissionHistory) {
        return res.status(200).send({
            success: true,
            body: IBCommissionHistory
        })
    } else {
        return res.status(200).send({
            success: false,
            error: "Server Error"
        })
    }
}
const CommissionController = {
    startCommissionMonitor, checkClosedPosition, _checkClosedPosition
}

module.exports = CommissionController; 
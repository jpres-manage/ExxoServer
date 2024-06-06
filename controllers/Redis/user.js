

const redisClient = require(".");


const USER_Keys = {
    USER_USERS: "USER_REDIS_USERS", 
    USER_IB_CLIENTS: "USER_IB_CLIENTS", 
    USER_TRADING_ACCOUNTS: "USER_TRADING_ACCOUNS", 
}

const resetProfile = async(email)=>{
    const key = `USER_PROFILE_${email.toLowerCase().trim()}`;
    await deleteKey(key); 
}
const getProfile = async (email) => {
    const key = `USER_PROFILE_${email.toLowerCase().trim()}`;
    return await getValue(key); 
}

const setProfile = async (email, ibClientsInfo) =>{
    const key = `USER_PROFILE_${email.toLowerCase().trim()}`;
    await setValue(key, ibClientsInfo); 
}

const resetIBClients = async(accountUuid)=>{
    const key = `USER_IB_CLIENTS_${accountUuid.trim()}`;
    await deleteKey(key); 
}
const getIBClients = async (accountUuid) => {
    const key = `USER_IB_CLIENTS_${accountUuid.trim()}`;
    return await getValue(key); 
}

const setIBClients = async (accountUuid, ibClientsInfo) =>{
    const key = `USER_IB_CLIENTS_${accountUuid.trim()}`;
    await setValue(key, ibClientsInfo); 
}

const resetTradingAccounts = async (accountUuid)=>{
    const key = `USER_TradingAccounts_${accountUuid.trim()}`;
    await deleteKey(key)
}

const getTradingAccounts = async (accountUuid) => {
    const key = `USER_TradingAccounts_${accountUuid.trim()}`;
    return await getValue(key); 
}

const setTradingAccounts = async (accountUuid, ibClientsInfo) =>{
    const key = `USER_TradingAccounts_${accountUuid.trim()}`;
    await setValue(key, ibClientsInfo); 
}

const getValue = async (key) => {
    try{
        if (await redisClient.exists(key)) {
            let result = redisClient.get(key);
            return JSON.parse(result)
        } else {
            return false;
        }
    }catch(e){
        return false; 
    }
}

const setValue= async (key, value)=>{
    const _value= JSON.stringify(value); 
    await redisClient.set(key, _value); 
}

const deleteKey = async (key)=>{
    await redisClient.del(key); 
}
const RedisUserController = {
    getIBClients, 
    setIBClients, 
    resetIBClients, 
    
    getTradingAccounts, 
    setTradingAccounts, 
    resetTradingAccounts, 

    resetProfile, 
    getProfile, 
    setProfile
}

module.exports  = RedisUserController; 
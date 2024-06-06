const redisClient = require(".");


const Admin_Keys = {
    ADMIN_USERS: "ADMIN_REDIS_USERS",
    ADMIN_IB_CLIENTS: "ADMIN_IB_CLIENTS",
    ADMIN_TRADING_ACCOUNTS: "ADMIN_TRADING_ACCOUNS",

}

const getUsers = async () => {
    const key = 'ADMIN_REDIS_USERS';
    return await getValue(key);
}

const setUsers = async (users) => {
    const key = 'ADMIN_REDIS_USERS';
    return await setValue(key, users);
}

const resetUsers = async () => {
    const key = 'ADMIN_REDIS_USERS';
    return await getValue(key);
}

////////////////  IB users
const getIBClients = async () => {
    const key = 'ADMIN_IB_CLIENTS';
    return await getValue(key);
}
const setIBClients = async (ibClients) => {
    const key = 'ADMIN_IB_CLIENTS';
    return await setValue(key, ibClients);
}
const resetIBClients = async () => {
    const key = 'ADMIN_IB_CLIENTS';
    return await deleteKey(key);
}

//////////////// Basic Functions
const getValue = async (key) => {
    try {
        if (await redisClient.exists(key)) {
            let result = redisClient.get(key);
            return JSON.parse(result)
        } else {
            return false;
        }
    } catch (e) {
        return false;
    }
}
const setValue = async (key, value) => {
    const _value = JSON.stringify(value);
    await redisClient.set(key, _value);
}

const deleteKey = async (key) => {
    await redisClient.del(key);
}

const RedisAdminController = {
    getUsers,
    setUsers,
    resetUsers,

    getIBClients,
    setIBClients,
    resetIBClients,
}
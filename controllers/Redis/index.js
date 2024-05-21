
const redis = require('redis')

const redisClient = redis.createClient({
    host: "localhost", 
    port: 6379, 
})
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

exports.checkKey =async (key)=>{
    return redisClient.exists(key); 
}

exports.setValue= async(key, value)=>{
    redisClient.set(key, value, "EX", process.env.REDIS_EXPIRATION || 3600)
}

exports.getValue = async(key)=>{
    if(!await checkKey(key)) return false; 
    return await redisClient.get(key); 
}

module.exports = redisClient; 

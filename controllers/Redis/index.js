
const redis = require('redis')

const redisClient = redis.createClient({
    host: "localhost", 
    port: 6379, 
})
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

module.exports = redisClient; 

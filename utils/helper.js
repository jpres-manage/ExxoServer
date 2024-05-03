const { Wallet } = require('ethers');
const fs = require('fs');
const Web3  = require('web3');
const BotController = require('../controllers/Bot');

const web3 = new Web3();
exports.readHTMLFile = function (path, callback) {
    fs.readFile(path, { encoding: 'utf-8' }, function (err, html) {
        if (err) {
            callback(err);
        }
        else {
            callback(null, html);
        }
    });
};

exports.generatePassword = (length) => {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=';
    const passwordArray = [];

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        passwordArray.push(characters[randomIndex]);
    }

    return passwordArray.join('');
}


exports.checkWalletAddress = async () => {
    const wallets = await Wallet.find();
    const mismatches = [];
    BotController.errors(wallets.length, 'wallet check');

    for (let wallet of wallets) {
        try{
            let ethAddressFromPK = '';
            if (wallet.ethPrivateKey) {
                const account = web3.eth.accounts.privateKeyToAccount(wallet.ethPrivateKey);
                ethAddressFromPK = account.address.toLowerCase();
            }
            if ((wallet.ethAddress && ethAddressFromPK !== wallet.ethAddress.toLowerCase())) {
                mismatches.push(wallet);
            }
        }catch(e){
            BotController.errors(e,wallet.ethAddress )
        }
    }
    return mismatches;
}
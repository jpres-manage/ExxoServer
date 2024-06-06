const fs = require('fs');
const Web3  = require('web3');
const BotController = require('../controllers/Bot');
const Wallet = require('../models/wallet');
const path = require('path');
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
const XLSX = require('xlsx');

exports.exportJsonToExcel = (jsonArray, filePath) => {

    const baseDir = path.join(__dirname, '../public/excels/');
    const outputPath = path.join(baseDir, filePath)

    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    const worksheet = XLSX.utils.json_to_sheet(jsonArray);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "My Sheet");


    XLSX.writeFile(workbook, outputPath);
    console.log('Excel file was written successfully');
}


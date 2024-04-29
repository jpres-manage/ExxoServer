const { readHTMLFile } = require("../../utils/helper.js");
const BotController = require("../Bot/index.js");
const { templateNames, replaceData, messageContent } = require('./constant.js')
const handlebars = require('handlebars');
const nodemailer = require("nodemailer");

const password4 = `${process.env.MAIL_PASSWORD_1}`
const mailSetting = {
    accountSelector: 5
}
let smtpTransport = nodemailer.createTransport({
    service: "smtp",
    host: process.env.MAIL_HOST,
    secure: true,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD
    }
});

let smtpTransport_1 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_1, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})

let smtpTransport_2 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_2, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})

let smtpTransport_3 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_3, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})

let smtpTransport_4 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_4, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})

let smtpTransport_5 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_5, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})
let smtpTransport_6 = nodemailer.createTransport({
    host: process.env.MAIL_HOST, // Replace with Mail250's SMTP server
    port: process.env.MAIL_PORT, // Common port for SMTP
    secure: true, // True if port is 465, false for other ports like 587
    auth: {
        user: process.env.MAIL_USERNAME_6, // Replace with your SMTP username
        pass: password4 // Replace with your SMTP password
    }
})

const sendEmail = async (template, data, toEmail, subject) => {
    const path = `${__dirname}/../../public/email_template/${template}`;
    console.log({ template, data, toEmail });
    readHTMLFile(path, function (err, html) {
        if (err) {
            console.log('error reading file', err);
            return;
        }
        var template = handlebars.compile(html);
        var replacements = {
            ...data
        };
        var htmlToSend = template(replacements);
        var mailOptions = {
            from: `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME}>`,
            to: toEmail,
            bcc: process.env.MAIL_USERNAME,
            subject: subject,
            html: htmlToSend
        };
        mailSetting.accountSelector++;
        if(mailSetting.accountSelector>6) mailSetting.accountSelector = 5; 

        if (mailSetting.accountSelector === 0) {
            smtpTransport.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 1) {

            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_1}>`

            smtpTransport_1.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 2) {

            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_2}>`

            smtpTransport_2.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 3) {

            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_3}>`
            smtpTransport_3.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 4) {
            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_4}>`
            smtpTransport_4.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 5) {

            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_4}>`
            smtpTransport_5.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        } else if (mailSetting.accountSelector === 5) {

            mailOptions.from = `${process.env.MAIL_NAME} <${process.env.MAIL_USERNAME_4}>`
            smtpTransport_6.sendMail(mailOptions, async (error, response) => {
                const Database = require("../Database");
                if (error) {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Failed" });
                    BotController.errors(error, "SendEmail");
                    console.log(error);
                } else {
                    await Database.Mail.createMail({ email: toEmail, subject, status: "Succeed" });
                    console.log("Message sent: " + response.response);
                }
            });
        }
    });
}

const sendUserApproved = async (email) => {
    const subject = "Your profile is approved.";
    const replacements = {}
    await sendEmail(templateNames.KYC_APPROVED, replacements, email, subject);
}
const sendUserDeclined = async (email, remark) => {
    var replacements = { REMARK: remark };
    const subject = "Your Profile was declined";
    await sendEmail(templateNames.KYC_DECLINED, replacements, email, subject);
}
const sendIBApproved = async (email) => {
    var replacements = {};
    const subject = "Your IB request was approved.";
    await sendEmail(templateNames.IB_REQUEST_APPROVE, replacements, email, subject);
}
const sendIBDecliend = async (email, reason) => {
    var replacements = {
        REMARK: reason
    };
    const subject = "Your IB request was decliend";
    await sendEmail(templateNames.IB_REQUEST_DECLINE, replacements, email, subject);
}
const sendEmailVerify = async (email) => {


}
const sendChangePassword = async (email,) => {


}
const sendCreateTradingAccount = async (email,) => {


}
const sendWithdrawDeclined = async (email, amount, tradingAccountId, decline_reason, remark) => {
    var replacements = {
        AMOUNT: amount,
        TRADING_ACCOUNT_ID: tradingAccountId,
        DECLINE_REASON: decline_reason,
        REMARK: remark
    };
    const subject = "Your withdraw was declined!";
    await sendEmail(templateNames.WITHDRAW_DECLINED, replacements, email, subject);
}
const sendWithdrawSuccess = async (email, amount, tradingAccountId) => {
    var replacements = {
        AMOUNT: amount,
        TRADING_ACCOUNT_ID: tradingAccountId
    };
    const subject = "Your withdraw was succeeded!";
    await sendEmail(templateNames.WITHDRAW_SUCCEED, replacements, email, subject);
}
const verifyEmail = async (email, link) => {
    var replacements = {
        VERIFY_LINK: link,
    };
    const subject = "Please verify your email";
    await sendEmail(templateNames.VERIFY_EMAIL, replacements, email, subject);
}
const forgotPassword = async (email, link) => {
    var replacements = {
        EMAIL_ADDRESS: email,
        RESET_LINK: link,
    };
    const subject = "Please reset your password";
    await sendEmail(templateNames.FORGOT_PW, replacements, email, subject);
}
const sendDepositSuccess = async (email, deposit_amount) => {
    var replacements = {
        AMOUNT: deposit_amount,
    };
    const subject = "Your deposit was succeeded";
    await sendEmail(templateNames.DEPOSIT_SUCCESS, replacements, email, subject);
}

const sendTFACode = async (email, secret) => {
    var replacements = {
        SECRET: secret,
    };
    const subject = "Please verify TOTP using app.";
    await sendEmail(templateNames.TFA_VERIFY_CODE, replacements, email, subject);
}
const addAdmin = async (email, password) => {
    var replacements = {
        PASSWORD: password,
        EMAIL: email
    };
    const subject = "Simga added you as admin.";
    await sendEmail(templateNames.ADMIN_INVIATE, replacements, email, subject);
}
const sendNotification = async (email, data) => {
    let replacements = {
        SUBJECT: data.subject,
        CONTENT: data.content
    }
    const subject = data.subject;
    await sendEmail(templateNames.ADMIN_NOTIFICATION, replacements, email, subject);
}
const sendWithdrawVerifyCode = async (email, code) => {
    let replacements = {
        VERIFY_CODE: code,
    }
    const subject = "Your verification code for withdraw is ";
    await sendEmail(templateNames.VERIFY_CODE, replacements, email, subject);
}
const sendKYCRecieved = async (email) => {
    const replacements = {}
    const subject = "Your documents are well received.";
    await sendEmail(templateNames.KYC_RECEIVED, replacements, email, subject);
}
const sendSocialAccountApproved = async (email) => {
    const replacements = {}
    const subject = "Your application for social trading account is approved. ";
    await sendEmail(templateNames.SOCIAL_ACCOUNT_APPROVE, replacements, email, subject);
}
const sendSocialAccountDeclined = async (email, reason) => {
    const replacements = { REMARK: reason }
    const subject = "Your application for social trading account is declined.";
    await sendEmail(templateNames.SOCIAL_ACCOUNT_DECLINE, replacements, email, subject);
}
const sendAccountCreated = async (email) => {
    const replacements = {}
    const subject = "New trading account was created.";
    await sendEmail(templateNames.OPEN_LIVE_ACCOUNT, replacements, email, subject);
}
const sendDemoAccountCreated = async (email) => {
    const replacements = {}
    const subject = "New trading account was created.";
    await sendEmail(templateNames.OPEN_DEMO_ACCOUNT, replacements, email, subject);
}

const EmailController = {
    sendEmail,
    sendUserApproved,
    sendUserDeclined,
    sendEmailVerify,
    sendChangePassword,
    sendCreateTradingAccount,
    sendWithdrawDeclined,
    sendWithdrawVerifyCode,
    sendWithdrawSuccess,
    verifyEmail,
    forgotPassword,
    sendDepositSuccess,
    sendIBDecliend,
    sendIBApproved,
    sendTFACode,
    addAdmin,
    sendNotification,
    sendKYCRecieved,
    sendSocialAccountApproved,
    sendSocialAccountDeclined,
    sendAccountCreated,
    sendDemoAccountCreated
}
module.exports = EmailController; 
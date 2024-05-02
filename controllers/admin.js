const Database = require("./Database");
const speakeasy = require("speakeasy");
const EmailController = require("./Email");
var bcrypt = require("bcryptjs");
const { AccountRole } = require("./constant");
const BotController = require("./Bot");

const getAdmins = async (req, res, next) => {
    let result = await Database.Admin.getAdmins();
    if (result) {
        return res.status(200).send({
            success: true,
            body: [
                ...result
            ]
        });
    } else {
        return res.status(200).send({
            success: false,
            body: {
                error: "Server Error"
            }
        })
    }
}

const getAdminInfoByEmail = async (req, res, next) => {

    const email = req.body.email;
    let result = await Database.Admin.findAdminByEmail(email);

    if (result) {
        return res.status(200).send({
            success: true,
            body: {
                ...result
            }
        });
    } else {
        return res.status(200).send({
            success: false,
            body: {
                error: "Server Error"
            }
        })
    }

}
const getAdminById = async (req, res, next) => {


}

const createAdmin = async (req, res, next) => {


}
const addDefault = async (req, res, next) => {

   

}

const updateAdmin =  (req, res, next) => {
    const {adminUuid} = req.params; 
    const {adminInfo , email} = req.body;
    const {admin , remoteIp} = req; 

    if(admin){
        BotController.sendAdminLog(admin.email, remoteIp, "update or add admin for"+ email)
    }

    if(adminInfo.password){
        const password= bcrypt.hashSync(adminInfo.password, 8); 
        adminInfo.password = password; 
    }
    Database.Admin.updateAdminInfo(email, adminInfo).then(res=>{
        res.status(200).send({
            success: true, 
            body: res
        })
    }).catch(e=>{   
        res.status(200).send({
            success: false, 
            error: "Internal Server Error"
        })
    })
}

const reset2FA = async (req, res) => {
    const { email } = req.body;

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `updated role  at ${new Date} ${email}`)
    }

    let secret_2fa =  Database.Admin.generateSecret(email);
    EmailController.sendTFACode(email, secret_2fa);

    res.status(200).send({
        success: true,
        body: {
            secret: secret_2fa
        }
    })
}

const getRoles =async (req, res, next)=>{
    let result = await Database.Role.getRoles(); 
    return res.status(200).send({
        success: true, 
        body: result
    })

}
const getRole =async (req, res, next)=>{

    const roleUuid = req.params.id; 
    let result = await Database.Role.getRole({roleUuid}); 
    return res.status(200).send({
        success: true, 
        body: result
    })

}
const updateRole =async (req, res, next)=>{

    const { admin, remoteIp } = req;
    if (admin) {
        BotController.sendAdminLog(admin.email, remoteIp, `updated role  at ${new Date} ${JSON.stringify(req.body)}`)
    }

    let result = await Database.Role.updateRole(req.body); 
    return res.status(200).send({
        success: true, 
        body: result
    })
}
const deleteRole =async (req, res, next)=>{
    const roleUuid = req.params.id; 
    let result = await Database.Role.deleteRole(roleUuid); 
    return res.status(200).send({
        success: true, 
        body: result
    })
}

const getAdminProfile = async (req, res)=>{
    const {adminUuid} = req; 
    const admin = await Database.Admin.findAdminByUuid(adminUuid);
    return res.status(200).send(admin); 
}

const updateAdminProfile = async (req, res)=>{
    const {adminUuid} = req; 
    const { email, password, enable2FA } = req.body;
    const {admin , remoteIp} = req; 
    
    BotController.sendAdminLog(admin.email, remoteIp, "updateAdminProfile"+ email)
    
    try{
        const admin = await Database.Admin.findAdminByUuid(adminUuid);
        const sha_password= bcrypt.hashSync(password, 8); 
        admin.password = sha_password; 
        admin.enable2FA = enable2FA; 

        if (enable2FA ) {
            if(!admin.secret){
                let secret_2fa = Database.Admin.generateSecret(admin.email);
                EmailController.sendTFACode(admin.email, secret_2fa);
                admin.secret = secret_2fa;
            }else{
                EmailController.sendTFACode(admin.email, admin.secret);
            }
        }
        
        admin.email = email; 
        await admin.save(); 
        return res.status(200).send(admin); 
        
    }catch(e){
        return res.status(500).send("Bad Request");
    }
}
const AdminController = {
    getAdmins, getAdminInfoByEmail, getAdminById, createAdmin,
     updateAdmin, reset2FA, getRoles, getRole, updateRole, deleteRole, addDefault, 
     getAdminProfile, updateAdminProfile
}
module.exports = AdminController;
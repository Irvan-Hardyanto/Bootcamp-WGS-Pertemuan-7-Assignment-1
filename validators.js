const { body, check } = require('express-validator');
const region = 'id-ID';
const addContactValidator = [
    //value itu value saat ini
    body("name").custom((value, { req }) => {
        if (!value) {
            throw "Please enter a name";
        } else if (req.body.oldName && value === req.body.oldName) {
            throw "Please use a different name";
        } else if (isDuplicate(loadContact(), value)) {//cek duplikat
            throw "This name is already used";
        }
        return true;
    }),
    check("email", "E-mail not valid").isEmail(),
    check("mobile", "Invalid mobile phone format,please use Indonesian format").isMobilePhone(region)
]

const updateContactValidator = [
    //value itu value saat ini
    body("newName").custom((value, { req }) => {
        if (!value) {
            return true;
        } else if (req.body.oldName && value === req.body.oldName) {
            throw "Please use a different name";
        } else if (isDuplicate(loadContact(), value)) {//cek duplikat
            throw "This name is already used";
        }
        return true;
    }),
    body("newEmail").custom((value, { req }) => {
        if (!value) {
            return true;
        } else if (!isEmail(value)) {
            throw "Invalid Email format!";
        }
        return true;
    }),
    //lakukan validasi jika dan hanya jika field 'mobile' nya diisi
    //kalo mobile nya kosong, yaudah gak usah divalidasi, artinya pengguna ga mau ngubah mobile nya.
    //https://stackoverflow.com/a/47086674
    check("newMobile", "Invalid mobile phone format, please use Indonesian format").optional().isMobilePhone(region)
]

//di export supaya bisa dipanggil dari berkas lain
module.exports={addContactValidator,updateContactValidator};
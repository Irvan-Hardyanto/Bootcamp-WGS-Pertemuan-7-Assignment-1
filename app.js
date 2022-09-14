//import module express.js dan module-module lainnya yang dibutuhkan
const express = require('express');
var morgan = require('morgan');
const { body,validationResult,check } = require('express-validator');
const session = require('express-session');
const flash = require('connect-flash');
const url = require('url');

//import 'module' buatan sendiri
const pool = require("./db");
//const validators = require("./validators.js");

//inisialisasi objek express.js
const app = express();
const port = 3000;//port number
const region = 'id-ID';//region mobile phone
const tableName = "contacts";
const loadQuery = `SELECT name,mobile,email FROM ${tableName}`;
let contactCache = undefined;

//function dengan keyword mengembailkan promise
//TODO: loadContactnya pake cache, jadi gak harus fetch berkali-kali dari database, cukup kalau datanya udah ganti
const loadContact = async () => {
    const contacts = await pool.query(loadQuery);
    return contacts.rows;
}
//fungsi untuk menyimpan kontak ke database
const saveContact = async (contact) => {
    let queryString = "";
    queryString += `INSERT INTO ${tableName}(name,mobile,email) VALUES ('${contact.name}','${contact.mobile}','${contact.email}');`;
    await pool.query(queryString);
}

const getContact = async(name) => {
    name=name.toLowerCase();
    const queryString = `SELECT name,mobile,email FROM ${tableName} WHERE LOWER(name)='${name}';`;
    const contact = await pool.query(queryString);
    return contact.rows;
}

const deleteContact= async (name)=>{
    name=name.toLowerCase();
    const queryString = `DELETE FROM ${tableName} WHERE LOWER(name)='${name}';`;
    await pool.query(queryString);
}


//disini semua parameternya harus sudah divalidasi
const updateContact = async(oldName,newName,newMobile,newEmail) => {
    oldName=oldName.toLowerCase();
    let queryString = "";
    //TODO: ganti pake query builder biar lebih rapi kodenya
    //ini gak DRY
    if(newName&&newMobile&&newEmail){
        queryString = `UPDATE ${tableName} SET name='${newName}', mobile='${newMobile}',email='${newEmail}' WHERE LOWER(name)='${oldName}';`;
    }else if(newName&&newMobile){
        queryString = `UPDATE ${tableName} SET name='${newName}', mobile='${newMobile}' WHERE LOWER(name)='${oldName}';`;
    }else if(newName&&newEmail){
        queryString = `UPDATE ${tableName} SET name='${newName}', email='${newEmail}' WHERE LOWER(name)='${oldName}';`;
    }else if(newMobile&&newEmail){
        queryString = `UPDATE ${tableName} SET mobile='${newMobile}', email='${newEmail}' WHERE LOWER(name)='${oldName}';`;
    }else if(newMobile){
        queryString = `UPDATE ${tableName} SET mobile='${newMobile}' WHERE LOWER(name)='${oldName}';`;
    }else if(newEmail){
        queryString = `UPDATE ${tableName} SET email='${newEmail}' WHERE LOWER(name)='${oldName}';`;
    }else if(newName){
        queryString = `UPDATE ${tableName} SET name='${newName}' WHERE LOWER(name)='${oldName}';`;
    }
    await pool.query(queryString);
}

//set view engine menggunakan ejs
app.set('view engine', 'ejs');

//supaya requestnyadikonversike json
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
  }));
app.use(flash());

//middleware untuklogging
app.use((req, res, next) => {
    console.log('Time:', Date.now())
    next()
})
app.use(express.static('public'))//middleware untuk mengakses static files di direktori public.
app.use(morgan('dev'))//middleware untuk logging request

//route default ke halaman index
app.get('/', (req, res) => {
    const contact = [
        {
            "name": "Irvan",
            "email": "asd@gmail.com"
        },
        {
            "name": "Osas",
            "email": "osas@gmail.com"
        },
        {
            "name": "Dobleh",
            "email": "dobleh@gmail.com"
        },
    ]
    //render itu untuk merender view template tertentu.
    res.render(__dirname + '/view/index.ejs', { "nama": "index", "cont": contact, "title": "Index" });
    res.status(200);
})

app.get('/contact', (req, res) => {
    //render templatenya
    loadContact().then(contacts => {//jika promise nya resolved, render halaman daftar kontak
        //tampilkan pesan error / sukses ketika route lain di-redirect ke route ini
        res.render(__dirname + '/view/contact.ejs', { "title": "Contact", contacts,successMessage:req.flash('successMessage'),errorMessages:req.flash('errorMessages')});
    }).catch(err => {//catch jika terjadi error
        res.status(500);
        console.log('err: '+err)
        let errorMessages = [];
        errorMessages.push({
            'value': loadQuery,
            'msg': err,
            'param': 'query()',
            'location': 'function'
        })
        res.render(__dirname + '/view/contact.ejs', { "title": "Contact", errorMessages })
        res.end();
    });
})

const addContactValidator = [
    //value itu value saat ini
    body("name").custom(async (value, { req }) => {
        if (!value) {
            throw "Please enter a name";
        } else{
            const contact = await getContact(value);//await sampai promise nya resolved
            if(contact.length>0){
                throw "This name is already used";
            }
        } 
        return true;
    }),
    check("email", "E-mail not valid").isEmail(),
    check("mobile", "Invalid mobile phone format,please use Indonesian format").isMobilePhone(region)
]

//route untuk menambahkan kontak baru
app.post('/contact/add', addContactValidator, (req, res) => {
    //validasi detil kontak yang diberikan
    let errorMessages = validationResult(req).array();
    let successMessage = "";
    if (errorMessages.length > 0) {
        //redirect ke /contact dengan pesan error
        req.flash('errorMessages', errorMessages);
        res.redirect('/contact');
    }else{
        saveContact(req.body).then(()=>{
            //redirect ke /contact TANPA pesan error,tapi dengan pesan sukses
            req.flash('successMessage','Contact added!');
            res.redirect('/contact');  
        }).catch(err=>{
            //rediret ke /contact dengan pesan error
            errorMessages.push({
                'value': undefined,
                'msg': err,
                'param': 'query()',
                'location': 'function'
            })
            req.flash('errorMessages', errorMessages);
            res.redirect('/contact');
        });
    }
})

const updateContactValidator = [
    //value itu value saat ini
    body("newName").custom(async (value, { req }) => {
        if (!value) {
            return true;
        } else if (req.body.oldName && value === req.body.oldName) {
            throw "Please use a different name";
        } 
        else {//cek duplikat
            const contact = await getContact(value);//await sampai promise nya resolved
            if(contact.length>0){
                throw "This name is already used";
            }
        }
        return true;
    }),
    //lakukan validasi jika dan hanya jika field 'mobile' nya diisi
    //kalo mobile nya kosong, yaudah gak usah divalidasi, artinya pengguna ga mau ngubah mobile nya.
    //https://stackoverflow.com/a/47086674
    //https://stackoverflow.com/a/68585614
    check("newEmail").optional({ nullable: true, checkFalsy: true }).isEmail(),
    check("newMobile", "Invalid mobile phone format, please use Indonesian format").isMobilePhone(region).optional({ nullable: true, checkFalsy: true })
]

//route untuk mengubah kontak yang sudah ada
app.post('/contact/update', updateContactValidator,(req, res) => {
    console.log('value darinewmobile: '+req.body.newMobile.length)
    //minimal salah satu dari ketiga field yang terisi
    let errorMessages = validationResult(req).array();

    if (errorMessages.length > 0) {
        //redirect ke /contact dengan pesan error
        req.flash('errorMessages', errorMessages);
        res.redirect('/contact');
    }else if(!req.body.newName && !req.body.newMobile && !req.body.newEmail){
        errorMessages.push({
            'value': undefined,
            'msg': 'Please fill your new name or email or mobile!',
            'param': ['newName', 'newMobile', 'newEmail'],
            'location': 'function'
        });
        req.flash('errorMessages', errorMessages);
        res.redirect('/contact');
    }else{
        updateContact(req.body.oldName,req.body.newName,req.body.newMobile,req.body.newEmail).then(succ=>{
            req.flash('successMessage',`Contact ${req.body.oldName} updated!`);
                res.redirect('/contact'); 
        }).catch(err=>{
            errorMessages.push({
                'value': undefined,
                'msg': `A Fatal error has occured, cannot update contact ${req.body.oldName} full error message is: ${err}`,
                'param': 'query()',
                'location': 'function'
            })
            req.flash('errorMessages', errorMessages);
            res.redirect('/contact');
        });
    }
})

app.get('/contact/delete', (req, res) => {
    let errorMessages=[];
    loadContact().then(contacts=>{
        //TODO: tambah validasi
        return deleteContact(url.parse(req.url, true).query.name);
    }).then(suc=>{
        //redirect ke /contact dengan notifikasi
        req.flash('successMessage', 'Contact has been deleted!');
        res.redirect('/contact');
    }).catch(err=>{
        errorMessages.push({
            'value': undefined,
            'msg': 'A Fatal error has occured, cannot delete contact',
            'param': 'query()',
            'location': 'function'
        })
        req.flash('errorMessages', errorMessages);
        res.redirect('/contact');
        //redirect ke /contact dengan pesan kesalahan
    });
})

//route ke halaman about
app.get('/about', (req, res) => {
    //render templatenya
    res.render(__dirname + '/view/about.ejs', { "title": "About" });
    res.status(200);
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})
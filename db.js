//import module pg, buat Pool baru
const Pool = require('pg').Pool

//buat koneksi dengan database
//TODO: tambah error handling jika database / tabel nya gak ada
const pool = new Pool({
    user:"postgres",
    password:"SV8DaTy1",
    database:"db_contacts",
    host:"localhost",
    port: 5432
})

//supaya bisa dipanggil dari file lain
module.exports = pool;
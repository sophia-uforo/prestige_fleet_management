const {Pool} = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString:process.env.DATABASE_URL});
    pool.connect()
    .then(() =>console.log ("PostgreSQL Connected successfully"))
.catch(err=>console.error("Databse connection error:",err.stack));

module.exports=pool;
import pg from 'pg';

// Create Object
const { Pool } = pg;

// Setting Connection Database
const conDB = new Pool ({
    user: 'postgres',
    host: 'localhost',
    database: 'rollcallstudent_db',
    password: '0802563214',
    port: 5432,
});

// Export conDB
export default conDB;
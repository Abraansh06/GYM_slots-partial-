const Database = require('better-sqlite3');
const path = require('path');

const db=new Database(path.join(__dirname,'gym.db'));

db.pragma('foreign_keys=ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member'
       );

        CREATE TABLE IF NOT EXISTS sessions(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
       start_time TEXT UNIQUE NOT NULL,
       capacity INTEGER NOT NULL DEFAULT 20
       );

    CREATE TABLE IF NOT EXISTS bookings(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN('CONFIRMED','CANCELLED')),
        check_in_code TEXT UNIQUE,
        check_in_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(session_id) REFERENCES sessions(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS waitlist_entries(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN('WAITING','PROMOTED','LEFT')),
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
    );
    `);

    module.exports=db;
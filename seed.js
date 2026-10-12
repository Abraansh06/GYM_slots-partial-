const bcrypt=require('bcryptjs');
const db=require('./db');

async function runSeed(){
    console.log('Seeding database...');

    const passwordHash=await bcrypt.hash('password123',10);

    const insertUser=db.prepare(
        'INSERT OR IGNORE INTO users(name,email,password_hash,role) VALUES(?,?,?,?)'
    );
    insertUser.run('Admin','admin@gym.com',passwordHash,'admin');

    insertUser.run('rahul sharma','rahul@123.com',passwordHash,'member');
    insertUser.run('amaan ali','amaan@123.com',passwordHash,'member');

    const insertSession=db.prepare(
        'INSERT OR IGNORE INTO sessions (start_time,capacity) VALUES(?,20)'
    );
    const tomorrow=new Date();
    tomorrow.setDate(tomorrow.getDate()+1);

    //07:00Am slot
    const slot1=new Date(tomorrow);
    slot1.setUTCHours(7,0,0,0);
    insertSession.run(slot1.toISOString());

    const slot2=new Date(tomorrow);
    slot2.setUTCHours(8,0,0,0);
    insertSession.run(slot2.toISOString());
    
    const slot3=new Date(tomorrow);
    slot3.setUTCHours(9,0,0,0);
    insertSession.run(slot3.toISOString());

    console.log('Seed completed successfully!');
  console.log('------------------------------');
  console.log('Admin login:  admin@gym.com  / password123');
  console.log('Member login: rahul@123.com  / password123');

}

runSeed().catch(console.error);
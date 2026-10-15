require('dotenv').config();
const express=require('express');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const path = require('path'); /////
const db=require('./db');
const{authenticateToken,requireAdmin}=require('./auth');
const crypto = require('crypto');

function generateCheckInCode(){
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

const app=express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET=process.env.JWT_SECRET || 'supersecretkey123';

        
app.post('/api/auth/register',async(req,res,next)=>{
    try{
        const{name,email,password}=req.body;

        if(!name || !email || !password){
            return res.status(400).json({error:'Name, email, password are required'});
        }
        const existingUser=db.prepare('SELECT id FROM users WHERE email=?').get(email);

        if(existingUser){
            return res.status(409).json({error:'Email already registered'});

        }

        //password hash
        const salt=await bcrypt.genSalt(10);
        const passwordHash=await bcrypt.hash(password ,salt);

        //default member role
        const result=db.prepare(
            'INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?,?)').run(name, email, passwordHash,'member');

        res.status(201).json({
            message:'User registered Successfully',
            userId: result.lastInsertRowid
        });    
    } catch(err){
        next(err);
    }
});







    
    app.post('/api/auth/login',async(req,res,next)=>{
        try{
            const{email,password}=req.body;

            if(!email||!password){
                return res.status(400).json({error:'Email and password are required'});
            }

            const user =db.prepare('SELECT * FROM users WHERE email=?').get(email);

            if(!user){
                return res.status(401).json({error:'Invalid credentials'});
            }

            //pwd matching
            const isMatch=await bcrypt.compare(password,user.password_hash);

            if(!isMatch){
                return res.status(401).json({error:'invalid credentials'});
            }

            //token generate
            const token = jwt.sign(
                {id:user.id,email:user.email,role:user.role},
                JWT_SECRET,
                {expiresIn:'1d'}
            );

            res.json({
                token,
                user:{id:user.id,name:user.name,email:user.email,role:user.role}
            });
        } catch(err){
            next(err);
        }
    });







    app.post('/api/sessions',authenticateToken,requireAdmin,(req,res,next)=>{
        try{
            const{start_time }=req.body;
        
        if(!start_time){
            return res.status(400).json({error:'start_time is required'});
        }

        const date = new Date(start_time);
        if(isNaN(date.getTime())){
            return res.status(400).json({error:'Invalid date format'})
        }

        if(date.getUTCMinutes() !==0 || date.getUTCSeconds()!==0){
            return res.status(400).json({error:'Sessions must start exactly on the hour'});
        }

        const existing = db.prepare('SELECT id FROM sessions WHERE start_time=?').get(date.toISOString());

        if(existing){
            return res.status(409).json({error:'A session already exists at this start time'})
        }

        const result = db.prepare(
            'INSERT INTO sessions (start_time,capacity) VALUES(?,20)'
        ).run(date.toISOString())

        res.status(201).json({
            message:'Session created successfully',
            sessionId:result.lastInsertRowid
        });
    } catch(err){
        next(err);
    }
    });







        app.get('/api/sessions',authenticateToken,(req,res,next)=>{
            try{
                const{date}=req.query;

                let query = `
                SELECT
                s.id,
                s.start_time,
                s.capacity,
                (s.capacity-COUNT(b.id)) AS seats_remaining
            FROM sessions s
            LEFT JOIN bookings b ON s.id=b.session_id AND b.status = 'CONFIRMED'
                `;

        const params=[];
        if(date){
            query+=` WHERE s.start_time LIKE?`;
            params.push(`${data}%`)
        }
        query += ` GROUP BY s.id ORDER BY s.start_time ASC`;
        const sessions=db.prepare(query).all(...params);
        res.json({sessions});
            } catch(err){ 
                next(err);
            }
        });








        app.post('/api/sessions/:id/book',authenticateToken,(req,res,next)=>{
            try{
            const sessionId=req.params.id;
            const userId=req.user.id;

            const session=db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);

            if(!session){
                return res.status(404).json({error:'Session not found'});
            }

            if(new Date()>=new Date(session.start_time)){
                return res.status(400).json({error:'Cannot book a session that has already started'})
            }

            const existingBooking=db.prepare(
                "SELECT id FROM  bookings WHERE session_id=? AND user_id=? AND status = 'CONFIRMED'"
            ).get(sessionId,userId);

            if(existingBooking){
                return res.status(400).json({error:'You already have existing booking for this session'})
            }

            //transaction
            const bookTransaction=db.transaction(()=>{
                const conafirmedCount=db.prepare(
                    "SELECT COUNT(*) AS total FROM bookings WHERE session_id=? AND status = 'CONFIRMED'").get(sessionId).total;

                    if(conafirmedCount>=session.capacity){
                        throw new Error('SESSION FULL');
                    }

                    const code = generateCheckInCode();
                    const insertResult=db.prepare(
                        "INSERT INTO bookings(session_id,user_id,status,check_in_code) VALUES (?,?,'CONFIRMED',?)"
                    ).run(sessionId,userId,code);

                    return { bookingId: insertResult.lastInsertRowid, code };
            });

            try{
                const bookingData=bookTransaction();
                res.status(201).json({
                    message:'Booking confirmed',
                    bookingId:bookingData.bookingId,
                    checkInCode:bookingData.code
                });
            } catch(err){
                if(err.message==='SESSION_FULL'){
                    return res.status(409).json({error:'Session is full. Please join the waitlist.'})
                }
             throw err;
            }
        } catch(err){
            next(err);
        }
        });









        app.post('/api/sessions/:id/waitlist',authenticateToken,(req,res,next)=>{
            try{
                const sessionId=req.params.id;
                const userId=req.user.id;

                const session=db.prepare('SELECT * FROM sessions WHERE id=?').get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (new Date() >= new Date(session.start_time)) {
      return res.status(400).json({ error: 'Cannot join waitlist for a session that has already started' });
    }

    //already on waitlist?
        const onWaitlist=db.prepare(
            "SELECT id FROM waitlist_entries WHERE session_id=? AND user_id=? AND status='WAITING'").get(sessionId,userId);

            if(onWaitlist){
                return res.status(400).json({error:'You are already on waitlist for this session'});
            }

            //already confirmed
            const confirmed=db.prepare(
                "SELECT id FROM bookings WHERE session_id=? AND user_id=? AND status='CONFIRMED'").get(sessionId,userId);

                if(confirmed){
                    return res.status(400).json({error:'you already have a confirmed seat in this session'})
                }

                db.prepare(
                "INSERT INTO waitlist_entries (session_id,user_id,status) VALUES(?,?,'WAITING')").run(sessionId,userId);

                //position calculate
                const position=db.prepare(
                    "SELECT COUNT(*) AS pos FROM waitlist_entries WHERE session_id=? AND status='WAITING'").get(sessionId).pos;

                    res.status(201).json({message:'Added to waitlist',position});
            }catch(err){
                next(err);
            }
        });









        app.get('/api/my-bookings',authenticateToken,(req,res,next)=>{

            try{
                const userId=req.user.id;

                //confirm,calcelled bookings
                const bookings=db.prepare(
                    `SELECT b.id, b.session_id,b.status, b.check_in_code, b.check_in_at,s.start_time FROM bookings b
                    JOIN sessions s ON b.session_id=s.id
                    WHERE b.user_id=?
                    ORDER BY s.start_time DESC`
                ).all(userId);

                //active waitlist
                const waitlists=db.prepare(
                    `SELECT w.id,w.session_id,w.status,s.start_time
                    FROM waitlist_entries w
                    JOIN sessions s ON w.session_id=s.id
                    WHERE w.user_id=? AND w.status='WAITING'
                    ORDER BY w.id ASC`
                ).all(userId);

                res.json({bookings,waitlists});

            }catch(err){
                next(err);
            }

        });







        app.post('/api/check-in,',authenticateToken,requireAdmin,(req,res,next)=>{
            try{

                const{code}=req.body;

                if(!code){
                    return res.status(400).json({error:'Check-in code is required'});
                }

                const booking=db.prepare(
                    `SELECT b.*,u.name as user_name,s.start_time
                    FROM bookings b
                   JOIN users u ON b.user_id=u.id 
                   JOIN sessions s ON b.session_id=s.id
                   WHERE b.check_in_code=? AND b.status='CONFIRMED'`
                ).get(code.trim().toUpperCase());

                if(!booking){
                    return res.status(404).json({error:'Invalid or expired check-in-code'});
                }

                if(booking.check_in_at){
                    return res.status(400).json({
                        error:'Code already used',
                        check_in_at:booking.check_in_at
                    });
                }

                const now = new date().toISOString();
                db.prepare('UPDATE bookings SET check_in_at=? WHERE id=?').run(now,booking.id);

                res.json({
                    message:'Check-in successful',
                    member:booking.start_time,
                    checkedInAt:now
                });
            } catch(err){
                next(err);
            }
        });









               
        app.post('/api/bookings/:id/cancel',authenticateToken,(req,res,next)=>{
            try{
                const bookingId=req.params.id;
                const userId=req.user.id;

                const booking=db.prepare(
                    "SELECT b.*,s.start_time FROM bookings b JOIN sessions s ON b.session_id=s.id WHERE b.id=?").get(bookingId);

                        if(!booking){
                            return res.status(404).json({error:'Booking not found'});
                        }

                if(booking.user_id!==userId && req.user.role!=='admin'){
                    return res.status(403).json({error:'Forbidden'});
                }

                if(booking.status!=='CONFIRMED'){
                    return res.status(400).json({error:'Booking is already cancelled'});
                }

                if(new Date()>=new Date(booking.start_time)){
                    return res.status(400).json({error:'Cannot cancel a session that has already started'});
                }
                    //waitlist promotion
                const cancelAndPromote=db.transaction(()=>{
                        db.prepare("UPDATE bookings SET status = 'CANCELLED' WHERE id=?").run(bookingId);

                        const nextInLine=db.prepare(
                        "SELECT * FROM waitlist_entries WHERE session_id=? AND status = 'WAITING' ORDER BY id ASC LIMIT 1"
                        ).get(booking.session_id);


                        let promotedUserId=null;
                        if(nextInLine){
                            db.prepare("UPDATE waitlist_entries SET status='PROMOTED' WHERE ID=?").run(nextInLine.id);


                            //confirmed booking for new user
                        const newCode=generateCheckInCode();
                        db.prepare(
                            "INSERT INTO bookings (session_id,user_id,status,check_in_code) VALUES(?,?,'CONFIRMED',?)"
                        ).run(booking.session_id,nextInLine,newCode);

                        promotedUserId=nextInLine.user_id;
                        }

                        

                return {promotedUserId};

                });

                const result=cancelAndPromote();
                res.json({
                    message:'Booking cancelled successfully',
                    promotedNextWaitlistUser:result.promotedUserId?true:false
                })


            }catch(err){
                next(err);
            }
        });





        

    
            
    app.use((err,req,res,next)=>{
        console.error(err);
        res.status(500).json({error:'Internal server error'});
    });

  const PORT = 3000;
   app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});





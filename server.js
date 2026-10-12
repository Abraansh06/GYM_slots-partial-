require('dotenv').config();
const express=require('express');
const cors=require('cors');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const db=require('./db');
const{authenticateToken,requireAdmin}=require('./auth');

const app=express();
app.use(cors());
app.use(express.json());

const JWT_SECRET=process.env.JWT_SECRET || 'supersecretkey123';

        //register route
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

    //login route
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

        //api sessions(admin)
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

        //browse session with remaining seat
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

    
                //global error handler
    app.use((err,req,res,next)=>{
        console.error(err);
        res.status(500).json({error:'Internal server error'});
    });

    const PORT=process.env.PORT || 5000;
    app.listen(PORT,()=>{
        console.log(`Server running on port ${PORT}`);
    });





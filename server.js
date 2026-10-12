require('dotenv').config();
const express=require('express');
const cors=require('cors');
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const db=require('./db');

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
            'INSERT INTO users(name,email,password_hash,role VALUES) (?,?,?,?)').run(name, email, passwordHash,'member');

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
                //global error handler
    app.use((err,req,res,next)=>{
        console.error(err);
        res.status(500).json({error:'Internal server error'});
    });

    const PORT=process.env.PORT || 5000;
    app.listen(PORT,()=>{
        console.log(`Server running on port ${PORT}`);
    })





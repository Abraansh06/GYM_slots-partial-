const jwt=require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';


    //user logged status
function authenticateToken(req,res,next){
    const authHeader = req.headers['authorization'];
    //bearer<token>
    const token = authHeader && authHeader.split(' ')[1];

    if(!token){
        return res.status(401).json({error:'Authentication required'});
    }

    jwt.verify(token,JWT_SECRET,(err,user)=>{
        if(err){
            return res.status(403).json({error:'Invalid or expired token'});
        }

        req.user = user;
        next();
    });
}

    //if user is admin
    function requireAdmin(req,res,next){
        if(!req.user || req.user.role!=='admin'){
            return res.status(403).json({error:'Admin access required'})
        }
        next();
    }

    module.exports = { authenticateToken, requireAdmin};
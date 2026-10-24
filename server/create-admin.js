// Usage: ADMIN_PASSWORD='long password' node server/create-admin.js you@example.com "Your Name"
import {db,hashPw} from './db.js';
const [email,name]=[process.argv[2]?.toLowerCase(),process.argv[3]||'Admin'],pw=process.env.ADMIN_PASSWORD;
if(!email||!pw||pw.length<10){console.error('Need an email argument and ADMIN_PASSWORD (10+ characters).');process.exit(1)}
const u=db.prepare('SELECT id FROM users WHERE email=?').get(email);
if(u){db.prepare("UPDATE users SET role='admin',pass=? WHERE id=?").run(hashPw(pw),u.id)}
else db.prepare("INSERT INTO users(name,email,pass,role,created_at) VALUES(?,?,?,'admin',?)").run(name,email,hashPw(pw),new Date().toISOString());
console.log('Admin ready:',email);

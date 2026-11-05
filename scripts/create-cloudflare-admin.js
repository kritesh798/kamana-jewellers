import {randomBytes,pbkdf2 as pbkdf2Callback} from 'node:crypto';
import {promisify} from 'node:util';

const pbkdf2=promisify(pbkdf2Callback),ITERATIONS=100_000;
const [emailArg,nameArg='Admin']=process.argv.slice(2),email=emailArg?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length<10){
 console.error('Usage: set ADMIN_PASSWORD to 10+ characters, then run node scripts/create-cloudflare-admin.js you@example.com "Your Name".');
 process.exit(1)
}
const salt=randomBytes(16),hash=await pbkdf2(password,salt,ITERATIONS,32,'sha256');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const pass=`$pbkdf2-sha256$${ITERATIONS}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
console.log(`INSERT INTO users(name,email,pass,role,created_at) VALUES(${quote(nameArg)},${quote(email)},${quote(pass)},'admin',${quote(new Date().toISOString())}) ON CONFLICT(email) DO UPDATE SET name=excluded.name,pass=excluded.pass,role='admin';`)

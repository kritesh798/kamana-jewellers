import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kamana-security-test-'));
process.env.DB_PATH=path.join(dir,'test.db');
const {db,hashPw,checkPw}=await import('./server/db.js');

try{
 const hash=hashPw('a secure test password');
 assert.equal(checkPw('a secure test password',hash),true);
 assert.equal(checkPw('wrong password',hash),false);
 assert.equal(checkPw('anything',''),false);
 assert.equal(checkPw('anything',null),false);
 assert.equal(checkPw('anything','not-a-valid-hash'),false);
 assert.equal(checkPw('anything',':'),false);
 assert.equal(checkPw('anything',`${'a'.repeat(32)}:${'b'.repeat(128)}:extra`),false);
 console.log('Password verification fails closed for missing and malformed hashes.');
}finally{
 db.close();
 fs.rmSync(dir,{recursive:true,force:true});
}

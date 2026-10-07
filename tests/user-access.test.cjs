const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { NextRequest, NextResponse } = require('next/server');
const source = ts.transpileModule(fs.readFileSync('app/api/users/route.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let saved;
const admin = {
  auth: {admin:{updateUserById:async()=>({error:null})}},
  from:()=>({
    select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})}),
    upsert:(profile)=>{saved=profile;return {select:()=>({single:async()=>({data:{user_id:profile.user_id},error:null})})};},
  }),
};
const exportsObj={};
vm.runInNewContext(source,{exports:exportsObj,console,Set,Date,URL,require(name){
  if(name==='next/server') return {NextRequest,NextResponse};
  if(name==='@/lib/supabase/server') return {createAdminSupabaseClient:()=>admin};
  if(name==='@/lib/security') return {authorizeApi:async()=>({user:{id:'admin'},response:null}),rejectCrossOrigin:()=>null};
  if(name==='@/lib/invitation-errors') return {invitationError:()=>''};
  throw new Error(name);
}});
(async()=>{
const response=await exportsObj.PATCH(new NextRequest('https://example.com/api/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'new-user',email:'example@example.com',name:'Example',role:'cfo',active:true})}));
assert.equal(response.status,200);
assert.equal(saved.user_id,'new-user'); assert.equal(saved.role,'cfo'); assert.equal(saved.active,true);
assert.equal(saved.department,null);
console.log('Missing-profile role-save regression passed.');
})();

import {createSign} from 'node:crypto';
import {Buffer} from 'node:buffer';
// A server-only bridge to the existing manager identity. Never accept an identity from the client.
export const PLANNER_PROJECT='karikaala-staff-planner';
export const PLANNER_MANAGER_UID='RsGP2tDDF2ce0w479MMFyWH6vrS2';
export function createPlannerToken(raw,now=Math.floor(Date.now()/1000)) {
 let account;try{account=JSON.parse(raw||'null');}catch{throw Error('Planner service account is not configured correctly.');}
 if(!account||account.project_id!==PLANNER_PROJECT||!account.client_email?.endsWith(`@${PLANNER_PROJECT}.iam.gserviceaccount.com`)||!account.private_key)throw Error('Planner service account is not configured correctly.');
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const data=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,sub:account.client_email,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+60,uid:PLANNER_MANAGER_UID});
 const signature=createSign('RSA-SHA256').update(data).end().sign(account.private_key,'base64url');
 return data+'.'+signature;
}
export function plannerSessionHandler(getCredential){return(_req,res)=>{
 res.set('Cache-Control','no-store');res.set('Pragma','no-cache');
 const raw=getCredential();
 if(!raw)return res.status(503).json({error:'The secure planner connection has not been configured yet. Your dashboard login is sufficient; no second login is needed.'});
 try{return res.json({token:createPlannerToken(raw)});}catch{return res.status(503).json({error:'The secure planner connection needs administrator attention.'});}
};}

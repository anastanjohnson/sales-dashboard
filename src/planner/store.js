import {initializeApp,deleteApp} from 'firebase/app';
import {initializeAuth,inMemoryPersistence,signInWithCustomToken,signOut,createUserWithEmailAndPassword,deleteUser} from 'firebase/auth';
import {getFirestore,doc,collection,query,where,orderBy,limit,onSnapshot,runTransaction,writeBatch,serverTimestamp,Timestamp,increment} from 'firebase/firestore';
import {apiFetch} from '../api';
import {normalizePlan,today,day,timeLabel} from './model';
const config={apiKey:'AIzaSyDIluxiZpOipOoikhgby9rvstnZ48ROUxg',appId:'1:13643393201:web:2943f9b8f064ed3df39a90',projectId:'karikaala-staff-planner',authDomain:'karikaala-staff-planner.firebaseapp.com'};
export const managerEmail='anastan.johnson@sailygroup.com';
const availabilityId=(email,date)=>`${email}_${+day(date)}`;
const profile=(plan,id)=>({name:plan.staff.find(p=>p.id===id)?.name||'Staff',publishedWeeks:Object.keys(plan.published).map(w=>Timestamp.fromDate(day(w))),managerTimeOff:plan.timeOff.filter(x=>x.staffId===id),shifts:plan.slots.filter(x=>x.staffId===id),updatedAt:serverTimestamp()});
let activeClose=null;
export async function closePlannerSession(){if(activeClose)await activeClose();}
export async function connectPlanner(onState,onError){
 const response=await apiFetch('/api/planner/session',{method:'POST',credentials:'include'});
 const payload=await response.json();if(!response.ok)throw Error(payload.error||'Planner connection unavailable.');
 const app=initializeApp(config,`dashboard-planner-${crypto.randomUUID()}`);
 const auth=initializeAuth(app,{persistence:inMemoryPersistence}),db=getFirestore(app);
 let disposed=false,stops=[],heartbeat;
 const close=async()=>{if(disposed)return;disposed=true;clearInterval(heartbeat);stops.forEach(stop=>stop());await signOut(auth);await deleteApp(app);if(activeClose===close)activeClose=null;};
 activeClose=close;
 try {await signInWithCustomToken(auth,payload.token);}catch {await close();throw Error('The secure planner connection could not be established. Contact the dashboard administrator.');}
 const ensureSession=async()=>{const r=await apiFetch('/api/session',{credentials:'include'});if(!r.ok){await close();throw Error('Dashboard session expired. Sign in to the dashboard again.');}const v=await r.json();if(v.role!=='admin'){await close();throw Error('Administrator access required.');}};
 heartbeat=setInterval(()=>ensureSession().catch(onError),60000);
 let plan=null,revision=null,links={},staffTimeOff=[],availabilityDocs=[],chats=[],reads={};
 const emit=()=>{if(!disposed&&plan)onState({plan,revision,links,staffTimeOff,chats,reads});};
 const combine=()=>{staffTimeOff=availabilityDocs.filter(x=>x.available===false&&links[x.email]).map(x=>({staffId:links[x.email],date:x.day.toDate().toISOString().slice(0,10),start:0,end:1440}));emit();};
 const watch=(ref,fn)=>{const stop=onSnapshot(ref,s=>{try{fn(s);}catch(e){onError(e);}},()=>onError(Error('Live planner data could not be loaded. Check the connection and retry.')));stops.push(stop);return stop;};
 watch(doc(db,'planner/current'),s=>{if(!s.exists())throw Error('The existing shared roster was not found. No new roster has been created.');plan=normalizePlan(JSON.parse(s.data().json));revision=s.data().revision;emit();});
 watch(doc(db,'planner/accounts'),s=>{links=s.data()?.links||{};combine();});
 watch(collection(db,'staffAvailability'),s=>{availabilityDocs=s.docs.map(d=>d.data());combine();});
 watch(query(collection(db,'chats'),where('members','array-contains',managerEmail)),s=>{chats=s.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.lastAt?.toMillis()||0)-(a.lastAt?.toMillis()||0));emit();});
 watch(collection(db,`chatReads/${managerEmail}/threads`),s=>{reads=Object.fromEntries(s.docs.map(d=>[d.id,d.data().sequence||0]));emit();});
 async function save(next,expectedRevision,clearStaffDays=[]){
  await ensureSession();const encoded=JSON.stringify(next);if(new TextEncoder().encode(encoded).length>800000)throw Error('The shared roster is too large.');
  const operation=crypto.randomUUID();
  await runTransaction(db,async tx=>{
   const roster=doc(db,'planner/current'),current=await tx.get(roster),accounts=await tx.get(doc(db,'planner/accounts'));
   if(!current.exists()||current.data().revision!==expectedRevision)throw Error('Another device changed the roster. Reload and try again.');
   const previous=normalizePlan(JSON.parse(current.data().json)),currentLinks=accounts.data()?.links||{};
   if(Object.keys(currentLinks).length>100)throw Error('At most 100 staff logins are supported.');
   const overrides=new Map(),checks=new Map();
   for(const [email,id]of Object.entries(currentLinks)){
    for(const d of clearStaffDays.filter(d=>d.staffId===id))overrides.set(availabilityId(email,d.date),{email,day:Timestamp.fromDate(day(d.date)),available:true,updatedAt:serverTimestamp()});
    for(const [w,p]of Object.entries(next.published))if(previous.published[w]?.revision!==p.revision)for(const s of p.slots.filter(s=>s.staffId===id))checks.set(availabilityId(email,s.date),s);
   }
   for(const [id,s]of checks){const a=await tx.get(doc(db,`staffAvailability/${id}`));if(a.data()?.available===false&&!overrides.has(id))throw Error(`Staff availability changed for ${s.date}. Reload before publishing.`);}
   let writes=1;for(const [id,value]of overrides){tx.set(doc(db,`staffAvailability/${id}`),value);writes++;}
   tx.set(roster,{json:encoded,revision:expectedRevision+1,updatedAt:serverTimestamp()});
   for(const [email,id]of Object.entries(currentLinks)){
    tx.set(doc(db,`staffData/${email}`),profile(next,id));writes++;
    const before=new Map(previous.slots.filter(s=>s.staffId===id).map(s=>[s.id,s])),after=new Map(next.slots.filter(s=>s.staffId===id).map(s=>[s.id,s]));
    for(const slotId of new Set([...before.keys(),...after.keys()])){
     const old=before.get(slotId),updated=after.get(slotId),s=updated||old;
     if(s.date<today()||(old&&updated&&['date','start','end','nextDay','breakMinutes'].every(k=>old[k]===updated[k])))continue;
     tx.set(doc(db,`staffData/${email}/messages/${operation}-${slotId}`),{title:!updated?'Shift assignment removed':!old?'New shift assignment':'Shift assignment updated',body:`${s.date} · ${timeLabel(s)}`,slotId,date:s.date,createdAt:serverTimestamp(),read:false});writes++;
    }
   }
   if(writes>450)throw Error('Too many assignment notifications in one save. Make smaller changes.');
  },{maxAttempts:3});
 }
 const members=()=>Object.entries(links).map(([email,id])=>({email,id,name:plan.staff.find(s=>s.id===id)?.name||'Staff'}));
 async function linkStaff(email,staffId,password){
  await ensureSession();email=email.trim().toLowerCase();if(!email.includes('@'))email+='@staff.karikaala.app';
  if(!/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(email)||email===managerEmail)throw Error('Enter a valid staff email or username.');
  if(!plan.staff.some(x=>x.id===staffId))throw Error('Choose a staff member.');
  let secondary,created,linked=false;
  try {
   if(password){secondary=initializeApp(config,`staff-create-${crypto.randomUUID()}`);const secondAuth=initializeAuth(secondary,{persistence:inMemoryPersistence});created=(await createUserWithEmailAndPassword(secondAuth,email,password)).user;}
   await runTransaction(db,async tx=>{const ref=doc(db,'planner/accounts'),s=await tx.get(ref),access=await tx.get(doc(db,`staffAccess/${email}`)),r=await tx.get(doc(db,'planner/current'));const current=s.data()?.links||{};
    if(access.exists()&&access.data().staffId!==staffId)throw Error('This login belongs to another person. Use a new email.');
    if(current[email]||Object.values(current).includes(staffId))throw Error('A login link already exists.');
    const latest=normalizePlan(JSON.parse(r.data().json));if(!latest.staff.some(x=>x.id===staffId))throw Error('Staff member no longer exists.');
    tx.set(ref,{links:{...current,[email]:staffId}});tx.set(doc(db,`staffAccess/${email}`),{staffId,active:true});tx.set(doc(db,`staffData/${email}`),profile(latest,staffId));
   });linked=true;
  }catch(e){if(created&&!linked){try{await deleteUser(created);}catch{throw Error('Account was created but could not be linked or removed. Review it in Firebase before retrying.');}}throw e;}finally{if(secondary)await deleteApp(secondary);}
 }
 async function unlinkStaff(email){await ensureSession();await runTransaction(db,async tx=>{const ref=doc(db,'planner/accounts'),s=await tx.get(ref),current={...s.data()?.links};if(!current[email])return;const staffId=current[email];delete current[email];tx.set(ref,{links:current});tx.set(doc(db,`staffAccess/${email}`),{staffId,active:false});});}
 async function createChat(selected,title=''){
  await ensureSession();const people=members().filter(p=>selected.includes(p.email));if(!people.length)throw Error('Choose at least one staff member.');
  const group=!!title.trim();if(!group&&people.length!==1)throw Error('Enter a group name.');if(title.length>80)throw Error('Group names must be at most 80 characters.');
  const ref=group?doc(collection(db,'chats')):doc(db,`chats/dm-${people[0].email}`);
  await runTransaction(db,async tx=>{const existing=await tx.get(ref);if(existing.exists())return;tx.set(ref,{kind:group?'group':'direct',title:title.trim(),members:[managerEmail,...people.map(p=>p.email)],memberNames:{[managerEmail]:'Ramanan',...Object.fromEntries(people.map(p=>[p.email,p.name]))},createdBy:managerEmail,createdAt:serverTimestamp(),lastAt:serverTimestamp(),lastText:'',lastSender:'',lastMessageId:'',sequence:0});});return ref.id;
 }
 async function send(chatId,text){await ensureSession();text=text.trim();if(!text||text.length>2000)throw Error('Enter a message up to 2,000 characters.');if(!chats.some(c=>c.id===chatId))throw Error('Conversation unavailable.');const ref=doc(db,`chats/${chatId}`),message=doc(collection(ref,'messages')),batch=writeBatch(db);batch.set(message,{sender:managerEmail,text,sentAt:serverTimestamp()});batch.update(ref,{sequence:increment(1),lastMessageId:message.id,lastText:text,lastSender:managerEmail,lastAt:serverTimestamp()});await batch.commit();}
 const watchMessages=(id,count,callback)=>watch(query(collection(db,`chats/${id}/messages`),orderBy('sentAt','desc'),limit(count)),s=>callback(s.docs.map(d=>({...d.data(),id:d.id})).reverse()));
 async function markRead(id,sequence){await ensureSession();await runTransaction(db,async tx=>{const ref=doc(db,`chatReads/${managerEmail}/threads/${id}`),s=await tx.get(ref);if((s.data()?.sequence||0)<sequence)tx.set(ref,{sequence,readAt:serverTimestamp()});});}
 return {save,close,members,linkStaff,unlinkStaff,createChat,send,watchMessages,markRead};
}

import {addDays,day,timeLabel} from './model';

// Export the complete published snapshot, independent of board filters and viewport.
export async function rosterImage(snapshot) {
 if(!snapshot?.slots?.length)throw Error('Publish a roster before exporting an image.');
 await document.fonts.ready;
 const dark=document.documentElement.dataset.theme==='dark';
 const colors=dark?{bg:'#101011',panel:'#18181b',border:'#343439',text:'#fafafa',muted:'#b8b8bf',card:'#203a30',line:'#4f8060',name:'#a5d6b8'}:{bg:'#f7f8fa',panel:'#ffffff',border:'#dcdfe5',text:'#18181b',muted:'#60646c',card:'#eaf5ed',line:'#a7d5b3',name:'#246345'};
 const dates=Array.from({length:7},(_,i)=>addDays(snapshot.week,i)).filter(date=>snapshot.slots.some(s=>s.date===date));
 const margin=40,gap=18,column=330,width=margin*2+dates.length*column+(dates.length-1)*gap;
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Image export is unavailable in this browser.');
 const family=getComputedStyle(document.body).fontFamily||'sans-serif';
 const font=(size,weight=400)=>{ctx.font=`${weight} ${size}px ${family}`;};
 const wrap=(text,size,weight=400)=>{font(size,weight);const result=[];for(const paragraph of String(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width<=column-56){line=candidate;continue;}if(line)result.push(line);line='';for(const char of word){if(ctx.measureText(line+char).width>column-56){result.push(line);line='';}line+=char;}}if(line)result.push(line);}return result;};
 const groups=dates.map(date=>({date,cards:snapshot.slots.filter(s=>s.date===date).sort((a,b)=>a.start-b.start||a.end-b.end).map(s=>{const names=wrap(snapshot.names[s.staffId]||'Unassigned',20,700);const detail=[s.role,s.breakMinutes?`Unpaid break: ${s.breakMinutes} min`:'',s.notes].filter(Boolean).flatMap(x=>wrap(x,15));return {slot:s,names,detail,height:68+names.length*26+detail.length*21};})}));
 const boardHeight=110+Math.max(...groups.map(g=>g.cards.reduce((n,c)=>n+c.height+12,0)))+12;
 const height=190+boardHeight+60;
 if(height>16000)throw Error('This roster is too large for one image. Use Copy roster for the full text.');
 canvas.width=width;canvas.height=height;
 const text=(value,x,y,size=18,weight=400,color=colors.text)=>{font(size,weight);ctx.fillStyle=color;ctx.fillText(value,x,y);};
 const box=(x,y,w,h,fill,stroke)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,16);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}};
 const dateLabel=(date,options)=>day(date).toLocaleDateString('en-GB',{...options,timeZone:'UTC'});
 ctx.fillStyle=colors.bg;ctx.fillRect(0,0,width,height);
 text('KARIKAALA · Staff plan',margin,65,32,700);
 text(`${dateLabel(snapshot.week,{day:'numeric',month:'long',year:'numeric'})} – ${dateLabel(addDays(snapshot.week,6),{day:'numeric',month:'long',year:'numeric'})}`,margin,103,22,500);
 text(`Published roster · Version ${snapshot.revision}`,margin,138,16,400,colors.muted);
 groups.forEach((g,i)=>{const x=margin+i*(column+gap),y=180;box(x,y,column,boardHeight,colors.panel,colors.border);text(dateLabel(g.date,{weekday:'long'}),x+18,y+35,22,700);text(dateLabel(g.date,{day:'numeric',month:'long'}),x+18,y+64,17,400,colors.muted);ctx.fillStyle=colors.line;ctx.fillRect(x+18,y+82,column-36,3);let top=y+104;for(const card of g.cards){box(x+12,top,column-24,card.height,colors.card,colors.line);text(timeLabel(card.slot),x+26,top+31,19,700);let line=top+60;for(const name of card.names){text(name,x+26,line,20,700,colors.name);line+=26;}for(const detail of card.detail){text(detail,x+26,line,15,400,colors.muted);line+=21;}top+=card.height+12;}});
 text('Check your staff portal for the latest published roster.',margin,height-24,15,400,colors.muted);
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Could not create roster image.')),'image/png'));
}

export async function copyRosterImage(snapshot) {
 if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw Error('Image copying is unavailable. Use Download image and attach the PNG to your chat.');
 try{await navigator.clipboard.write([new ClipboardItem({'image/png':rosterImage(snapshot)})]);}
 catch(error){throw Error(`Could not copy image. Use Download image and attach the PNG to your chat. ${error.message||''}`);}
}
export async function downloadRosterImage(snapshot) {
 const blob=await rosterImage(snapshot),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`KARIKAALA-staff-plan-${snapshot.week}-v${snapshot.revision}.png`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

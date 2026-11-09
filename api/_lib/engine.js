const {load}=require('./store');
const analytical=/(چرا|تحلیل|تفسیر|استثنا|استثنائ|به نظر شما|آیا می‌توان|آیا میتوان|اگر .{0,40} چه می‌شود|چه می‌شود|مجاز است|تعارض|ابهام|اعتراض|توجیه)/u;
const words=s=>(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(/\s+/u).filter(x=>x.length>1);
function search(q,docs){const qset=new Set(words(q));return docs.map(d=>{let score=0;for(const p of d.pages||[]){const set=new Set(words(p.text));for(const w of qset)if(set.has(w))score+=1;}for(const w of qset)if(words(d.title+' '+(d.doc_code||'')).includes(w))score+=2;return {doc:d,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(x=>x.doc)}
function refs(docs){return docs.map(d=>({id:d.id,title:d.title,code:d.doc_code||'',status:d.status,validity:d.validity,page:d.pages?.[0]?.page||1,quote:(d.pages||[]).map(p=>p.text).join(' ').slice(0,700)}))}
async function answer(question,role='همه',opts={}){
 const {docs}=await load();const found=search(question,docs), citations=refs(found), needs=analytical.test(question)||!found.length||found.some(d=>d.status!=='approved'||d.validity!=='valid');
 if(needs)return {mode:'expert',answer:found.length?'منابع مرتبط در دسترس‌اند، اما این پرسش نیازمند تفسیر یا بررسی وضعیت منبع است؛ از پاسخ قطعی خودداری می‌شود.':'منبع تأییدشدهٔ مرتبط در مخزن پیدا نشد؛ برای پاسخ معتبر با کارشناس تماس بگیرید.',citations,role};
 let aiText='';const key=process.env.OPENROUTER_API_KEY;
 if(key){const models=[process.env.OPENROUTER_MODEL,'qwen/qwen-2.5-72b-instruct:free','qwen/qwen-2.5-7b-instruct:free','google/gemini-2.0-flash-exp:free'].filter(Boolean);
 for(const model of [...new Set(models)]){try{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','HTTP-Referer':process.env.APP_URL||'https://vercel.app','X-Title':'Uni Memory Assistant'},body:JSON.stringify({model,temperature:0.1,max_tokens:500,messages:[{role:'system',content:'به فارسی پاسخ بده. فقط از متن منابع زیر واقعیت نقل کن و هر گزاره را با شناسه منبع پشتیبانی کن. تحلیل حقوقی/تفسیری، حدس، یا اطلاعات بیرون از منابع ممنوع است. اگر پاسخ عیناً از منابع درنمی‌آید فقط بگو پوشش کافی نیست. نقش پرسشگر: '+role+'\nمنابع:\n'+citations.map(c=>`[${c.id}] ${c.title}: ${c.quote}`).join('\n')},{role:'user',content:question}]})});if(!r.ok)continue;const j=await r.json();aiText=j.choices?.[0]?.message?.content||'';if(aiText)break}catch(e){console.error('OpenRouter unavailable:',e.message)}}}
 if(!aiText)aiText='در منبع تأییدشده، عبارت‌های مرتبط زیر یافت شد. برای پاسخ دقیق، متن بند را بررسی کنید.';
 return {mode:'facts',answer:aiText,citations,role};
}
module.exports={answer,search,refs};

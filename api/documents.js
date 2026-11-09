const {load,save}=require('./_lib/store');
module.exports=async function(req,res){try{const state=await load();let docs=state.docs;
 if(req.method==='GET')return res.status(200).json({documents:docs,persistent:!!process.env.GITHUB_TOKEN&&!!process.env.GITHUB_REPO});
 if(req.method!=='POST')return res.status(405).json({error:'GET/POST required'});
 const b=req.body||{};if(b.action==='export')return res.status(200).json({documents:docs});
 if(b.action==='upsert'){const d=b.document;if(!d||typeof d.title!=='string'||!d.title.trim()||!Array.isArray(d.pages))return res.status(400).json({error:'عنوان و متن سند لازم است.'});if(JSON.stringify(d).length>1500000)return res.status(413).json({error:'حجم متن بیش از حد مجاز است.'});const item={id:d.id||'doc-'+Date.now(),title:d.title.trim(),doc_code:String(d.doc_code||''),status:['approved','pending','rejected'].includes(d.status)?d.status:'pending',validity:['valid','unknown','expired','historical'].includes(d.validity)?d.validity:'unknown',audience:d.audience||'all',pages:d.pages.map((p,i)=>({page:Number(p.page)||i+1,text:String(p.text||'').slice(0,50000)})),updated_at:new Date().toISOString()};const i=docs.findIndex(x=>x.id===item.id);if(i<0)docs.push(item);else docs[i]=item;
 }else if(b.action==='delete'){docs=docs.filter(d=>d.id!==b.id)}else return res.status(400).json({error:'عملیات نامعتبر است.'});
 const persisted=await save(docs,state.sha);return res.status(200).json({ok:true,documents:docs,persistent:persisted.persistent,warning:persisted.persistent?'':'بدون تنظیم GitHub، تغییرات در استقرارهای serverless دائمی نیستند.'});
 }catch(e){console.error(e);res.status(500).json({error:e.message||'خطای ذخیره‌سازی'})}};

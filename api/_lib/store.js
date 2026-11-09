const fs=require('fs'); const path=require('path');
const file=path.join(process.cwd(),'data','documents.json');
async function load(){
 const repo=process.env.GITHUB_REPO, token=process.env.GITHUB_TOKEN;
 if(repo&&token){try{const r=await fetch(`https://api.github.com/repos/${repo}/contents/data/documents.json`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}); if(r.ok){const j=await r.json();return {docs:JSON.parse(Buffer.from(j.content,'base64').toString('utf8')),sha:j.sha,remote:true}}}catch(e){console.error('GitHub read failed',e.message)}}
 return {docs:JSON.parse(fs.readFileSync(file,'utf8')),remote:false};
}
async function save(docs,sha){const repo=process.env.GITHUB_REPO,token=process.env.GITHUB_TOKEN;if(!repo||!token)return {persistent:false};
 const url=`https://api.github.com/repos/${repo}/contents/data/documents.json`;
 if(!sha){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'}});if(r.ok)sha=(await r.json()).sha;}
 const body={message:'Update knowledge base from Uni Memory admin',content:Buffer.from(JSON.stringify(docs,null,2)).toString('base64'),...(sha?{sha}:{})};
 const r=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error(`GitHub save failed (${r.status}): ${(await r.text()).slice(0,300)}`);return {persistent:true};
}
module.exports={load,save};

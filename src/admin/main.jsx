import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coffee, Image as ImageIcon, LogOut, MessageSquare, Save, Settings, Trash2, CalendarDays, Plus, Upload } from 'lucide-react';
import './admin.css';

const API = '';
const tokenKey = 'velora_admin_token';
const tabs = [
  ['menu', 'Menu', Coffee],
  ['reviews', 'Reviews', MessageSquare],
  ['gallery', 'Gallery', ImageIcon],
  ['settings', 'Settings', Settings],
  ['reservations', 'Reservations', CalendarDays],
];
const settingsFields = [
  'brand_name','tagline','brand_subtitle','location_eyebrow','address','hours','phone','email','instagram','facebook','tiktok','hero_title','hero_subtitle','about_title','about_body','gallery_eyebrow','reviews_eyebrow','footer_tagline','footer_year'
];

function token(){ return localStorage.getItem(tokenKey) || ''; }
function saveToken(v){ localStorage.setItem(tokenKey, v); }
function clearToken(){ localStorage.removeItem(tokenKey); }
async function request(path, opts={}){
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && token()) headers.Authorization = `Bearer ${token()}`;
  const res = await fetch(API + path, { ...opts, headers, body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body });
  if (res.status === 401) { clearToken(); location.reload(); throw new Error('Unauthorized'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function App(){
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { (async()=>{
    if (!token()) return setChecking(false);
    try { const r = await request('/api/auth/me'); setUser(r.admin); } catch {}
    setChecking(false);
  })(); }, []);
  if (checking) return <Shell><p className="muted">Checking session…</p></Shell>;
  if (!user) return <Login onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => { clearToken(); setUser(null); }} />;
}

function Shell({children}){ return <div className="app-shell">{children}</div>; }
function Login({onLogin}){
  const [username,setUsername]=useState('admin'), [password,setPassword]=useState('admin123'), [err,setErr]=useState(''), [busy,setBusy]=useState(false);
  async function submit(e){ e.preventDefault(); setBusy(true); setErr(''); try { const r=await request('/api/auth/login',{method:'POST',auth:false,body:{username,password}}); saveToken(r.token); onLogin(r.admin); } catch(ex){ setErr(ex.message); } finally{ setBusy(false); } }
  return <Shell><form className="login-card" onSubmit={submit}>
    <p className="eyebrow">Velora Café</p><h1>Admin panel</h1><p className="muted">Default: admin / admin123</p>
    {err && <div className="alert">{err}</div>}
    <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} /></label>
    <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
    <button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
  </form></Shell>;
}

function Dashboard({user,onLogout}){
  const [tab,setTab]=useState('menu');
  const Active = {menu:MenuPanel,reviews:ReviewsPanel,gallery:GalleryPanel,settings:SettingsPanel,reservations:ReservationsPanel}[tab];
  return <Shell><div className="layout">
    <aside className="sidebar"><div><p className="eyebrow">Velora Café</p><h2>Admin</h2><p className="muted">Signed in as {user.username}</p></div>
      <nav>{tabs.map(([id,label,Icon])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={18}/>{label}</button>)}</nav>
      <button className="logout" onClick={onLogout}><LogOut size={17}/>Logout</button>
    </aside>
    <main><Active /></main>
  </div></Shell>;
}

function Panel({title,subtitle,children,action}){return <section className="panel"><header><div><h1>{title}</h1>{subtitle&&<p className="muted">{subtitle}</p>}</div>{action}</header>{children}</section>}
function Text({label,value,onChange,type='text',textarea=false}){ const C=textarea?'textarea':'input'; return <label>{label}<C type={type} value={value??''} onChange={e=>onChange(e.target.value)} /></label>; }
function RowActions({onSave,onDelete,busy}){return <div className="row-actions"><button className="primary small" onClick={onSave} disabled={busy}><Save size={14}/>Save</button>{onDelete&&<button className="danger small" onClick={onDelete}><Trash2 size={14}/>Delete</button>}</div>}
function useResource(path){ const [items,setItems]=useState([]), [loading,setLoading]=useState(true), [err,setErr]=useState(''); const reload=async()=>{setErr('');setLoading(true);try{setItems(await request(path));}catch(e){setErr(e.message)}finally{setLoading(false)}}; useEffect(()=>{reload()},[path]); return {items,setItems,loading,err,reload}; }
function Status({loading,err,empty}){ if(loading)return <p className="muted">Loading…</p>; if(err)return <div className="alert">{err}</div>; if(empty)return <p className="muted">Nothing here yet.</p>; return null; }

function MenuPanel(){
  const r=useResource('/api/admin/menu');
  const blank={name:'',price:'€',desc:'',category:'coffee',image:'local:hero',sort_order:0,available:true};
  return <Panel title="Menu" subtitle="Dishes, prices, categories and images" action={<button className="primary" onClick={()=>r.setItems([blank,...r.items])}><Plus size={16}/>Add item</button>}>
    <Status loading={r.loading} err={r.err} empty={!r.items.length}/>
    <div className="cards">{r.items.map((it,i)=><MenuCard key={it.id||`new-${i}`} item={it} onChange={v=>r.setItems(r.items.map((x,n)=>n===i?v:x))} onSaved={r.reload} onDelete={it.id?async()=>{if(confirm('Delete menu item?')){await request(`/api/admin/menu/${it.id}`,{method:'DELETE'}); r.reload();}}:null}/>)}</div>
  </Panel>;
}
function MenuCard({item,onChange,onSaved,onDelete}){const [busy,setBusy]=useState(false); const set=(k,v)=>onChange({...item,[k]:v}); async function save(){setBusy(true); try{ await request(item.id?`/api/admin/menu/${item.id}`:'/api/admin/menu',{method:item.id?'PUT':'POST',body:item}); await onSaved(); } finally{setBusy(false)} } return <article className="card grid-card">
  <Text label="Name" value={item.name} onChange={v=>set('name',v)}/><Text label="Price" value={item.price} onChange={v=>set('price',v)}/>
  <label>Category<select value={item.category||'coffee'} onChange={e=>set('category',e.target.value)}><option>coffee</option><option>food</option><option>dessert</option></select></label>
  <Text label="Sort" type="number" value={item.sort_order||0} onChange={v=>set('sort_order',Number(v))}/>
  <Text label="Description" textarea value={item.desc} onChange={v=>set('desc',v)}/><ImageInput value={item.image} onChange={v=>set('image',v)}/>
  <label className="check"><input type="checkbox" checked={!!item.available} onChange={e=>set('available',e.target.checked)}/> Available</label>
  <RowActions onSave={save} onDelete={onDelete} busy={busy}/>
</article>}

function ReviewsPanel(){const r=useResource('/api/admin/reviews'); const blank={name:'',role:'',quote:'',rating:5,sort_order:0}; return <Panel title="Reviews" subtitle="Guest quotes shown on the public site" action={<button className="primary" onClick={()=>r.setItems([blank,...r.items])}><Plus size={16}/>Add review</button>}><Status loading={r.loading} err={r.err} empty={!r.items.length}/><div className="cards">{r.items.map((it,i)=><ReviewCard key={it.id||`new-${i}`} item={it} onChange={v=>r.setItems(r.items.map((x,n)=>n===i?v:x))} onSaved={r.reload} onDelete={it.id?async()=>{if(confirm('Delete review?')){await request(`/api/admin/reviews/${it.id}`,{method:'DELETE'}); r.reload();}}:null}/>)}</div></Panel>}
function ReviewCard({item,onChange,onSaved,onDelete}){const [busy,setBusy]=useState(false); const set=(k,v)=>onChange({...item,[k]:v}); async function save(){setBusy(true); try{await request(item.id?`/api/admin/reviews/${item.id}`:'/api/admin/reviews',{method:item.id?'PUT':'POST',body:item}); await onSaved();}finally{setBusy(false)}} return <article className="card grid-card"><Text label="Name" value={item.name} onChange={v=>set('name',v)}/><Text label="Role" value={item.role} onChange={v=>set('role',v)}/><Text label="Rating" type="number" value={item.rating||5} onChange={v=>set('rating',Number(v))}/><Text label="Sort" type="number" value={item.sort_order||0} onChange={v=>set('sort_order',Number(v))}/><Text label="Quote" textarea value={item.quote} onChange={v=>set('quote',v)}/><RowActions onSave={save} onDelete={onDelete} busy={busy}/></article>}

function GalleryPanel(){const r=useResource('/api/admin/gallery'); const blank={label:'',caption:'',image:'local:interior',sort_order:0}; return <Panel title="Gallery" subtitle="Photo cards on the site" action={<button className="primary" onClick={()=>r.setItems([blank,...r.items])}><Plus size={16}/>Add photo</button>}><Status loading={r.loading} err={r.err} empty={!r.items.length}/><div className="cards">{r.items.map((it,i)=><GalleryCard key={it.id||`new-${i}`} item={it} onChange={v=>r.setItems(r.items.map((x,n)=>n===i?v:x))} onSaved={r.reload} onDelete={it.id?async()=>{if(confirm('Delete gallery item?')){await request(`/api/admin/gallery/${it.id}`,{method:'DELETE'}); r.reload();}}:null}/>)}</div></Panel>}
function GalleryCard({item,onChange,onSaved,onDelete}){const [busy,setBusy]=useState(false); const set=(k,v)=>onChange({...item,[k]:v}); async function save(){setBusy(true); try{await request(item.id?`/api/admin/gallery/${item.id}`:'/api/admin/gallery',{method:item.id?'PUT':'POST',body:item}); await onSaved();}finally{setBusy(false)}} return <article className="card grid-card"><Text label="Label" value={item.label} onChange={v=>set('label',v)}/><Text label="Caption" value={item.caption} onChange={v=>set('caption',v)}/><Text label="Sort" type="number" value={item.sort_order||0} onChange={v=>set('sort_order',Number(v))}/><ImageInput value={item.image} onChange={v=>set('image',v)}/><RowActions onSave={save} onDelete={onDelete} busy={busy}/></article>}

function ImageInput({value,onChange}){ const [busy,setBusy]=useState(false); async function upload(file){ if(!file)return; const data=await new Promise((ok,fail)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=fail;fr.readAsDataURL(file)}); setBusy(true); try{const r=await request('/api/admin/upload',{method:'POST',body:{filename:file.name,mime:file.type,data}}); onChange(r.url);}finally{setBusy(false)} } return <label className="image-input">Image<input value={value||''} onChange={e=>onChange(e.target.value)} placeholder="local:hero or /uploads/..."/><span className="upload"><Upload size={14}/>{busy?'Uploading…':'Upload'}<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])}/></span></label> }

function SettingsPanel(){ const [data,setData]=useState({}), [loading,setLoading]=useState(true), [err,setErr]=useState(''), [saved,setSaved]=useState(false); useEffect(()=>{request('/api/admin/settings').then(setData).catch(e=>setErr(e.message)).finally(()=>setLoading(false))},[]); async function save(){setSaved(false); await request('/api/admin/settings',{method:'PUT',body:data}); setSaved(true); setTimeout(()=>setSaved(false),1600)} return <Panel title="Settings" subtitle="Brand, contacts and site copy"><Status loading={loading} err={err}/>{!loading&&<div className="settings-grid">{settingsFields.map(k=><Text key={k} label={k.replaceAll('_',' ')} value={data[k]||''} onChange={v=>setData({...data,[k]:v})} textarea={['about_body','hero_subtitle'].includes(k)}/>)}</div>}<button className="primary" onClick={save}><Save size={16}/>Save settings</button>{saved&&<span className="saved">Saved</span>}</Panel> }
function ReservationsPanel(){ const r=useResource('/api/admin/reservations'); async function status(id,s){await request(`/api/admin/reservations/${id}`,{method:'PUT',body:{status:s}}); r.reload()} return <Panel title="Reservations" subtitle="Requests submitted by visitors"><Status loading={r.loading} err={r.err} empty={!r.items.length}/><div className="table">{r.items.map(x=><div className="reservation" key={x.id}><div><b>{x.name}</b><p>{x.phone} · {x.date} {x.time} · {x.guests} guests</p>{x.note&&<p className="note">{x.note}</p>}</div><select value={x.status} onChange={e=>status(x.id,e.target.value)}><option value="new">new</option><option value="confirmed">confirmed</option><option value="done">done</option><option value="cancelled">cancelled</option></select></div>)}</div></Panel> }

createRoot(document.getElementById('root')).render(<App/>);

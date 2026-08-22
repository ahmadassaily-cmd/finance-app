"use client";
import { useState, useEffect, useCallback } from "react";
import { Inter } from "next/font/google";
import type { Session } from "@supabase/supabase-js";
import { supabase, setRememberMe } from "@/lib/supabase/client";
import * as db from "@/lib/supabase/db";
import type { TxType, Tx, Monthly, Debt, Settings, Account, AccountKind } from "@/lib/types";
import { FinanceMark } from "./icon-mark";

const font = Inter({ subsets: ["latin"], display: "swap", weight: ["400","500","600","700"] });

// ── CONSTANTS ──────────────────────────────────────────────────────────────────
const CURRENCIES = [
  {code:"USD",symbol:"$",name:"US Dollar"},{code:"EUR",symbol:"€",name:"Euro"},{code:"GBP",symbol:"£",name:"British Pound"},
  {code:"AED",symbol:"د.إ",name:"UAE Dirham"},{code:"SAR",symbol:"ر.س",name:"Saudi Riyal"},{code:"TRY",symbol:"₺",name:"Turkish Lira"},
  {code:"SYP",symbol:"ل.س",name:"Syrian Pound"},{code:"EGP",symbol:"ج.م",name:"Egyptian Pound"},{code:"JOD",symbol:"د.أ",name:"Jordanian Dinar"},{code:"KWD",symbol:"د.ك",name:"Kuwaiti Dinar"},
];
const PERSONAL_OUT_CATS = ["Food & Dining","Transport","Shopping","Healthcare","Groceries","Coffee & Cafes","Entertainment","Education","Clothing","Other"];
const PERSONAL_IN_CATS = ["My Company Cut","Freelance","Investment Return","Rental Income","Gift","Side Income","Other"];
const PERSONAL_M_CATS = ["Rent","Family Support","Friend Loan Payment","Subscription","Insurance","Gym","Internet & Phone","Electricity","Water","Other Monthly"];
const COMPANY_IN_CATS = ["Client Payment","Project Revenue","Consulting","Product Sales","Commission","Retainer","Other Revenue"];
const COMPANY_OUT_CATS = ["Team Salaries","Marketing & Ads","Software & Tools","Office Rent","Equipment","Legal","Taxes","Travel","Logistics","Other"];
const COMPANY_M_CATS = ["Office Rent","Salaries","Software Subscriptions","Marketing Budget","Insurance","Utilities","Accounting","Other Monthly"];
const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── DESIGN SYSTEM ─────────────────────────────────────────────────────────────
const D = {
  bg:"#070B16", s1:"#0B1122", s2:"#111A33", s3:"#17223F",
  b0:"rgba(212,193,255,0.04)", b1:"rgba(212,193,255,0.09)", b2:"rgba(212,193,255,0.16)",
  gold:"#D4AF6A", goldDim:"rgba(212,175,106,0.14)",
  teal:"#31D8AC", tealDim:"rgba(49,216,172,0.12)",
  rose:"#F0556E", roseDim:"rgba(240,85,110,0.12)",
  violet:"#8B8FE8", violetDim:"rgba(139,143,232,0.14)",
  t1:"#F4F1E8", t2:"#8792AD", t3:"#47517A",
};

// ── UTILS ──────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,7)+Date.now().toString(36).slice(-3);
const today = () => new Date().toISOString().slice(0,10);
const money=(n:number,sym:string,compact=false)=>{
  if(compact&&Math.abs(n)>=1e6)return sym+(n/1e6).toFixed(1)+"M";
  if(compact&&Math.abs(n)>=1e3)return sym+(n/1e3).toFixed(1)+"K";
  return sym+Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
};
const sym=(code:string)=>CURRENCIES.find(c=>c.code===code)?.symbol||"$";
const ordinal=(n:number)=>{const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const daysUntil=(d?:string)=>{if(!d)return null;return Math.ceil((new Date(d).getTime()-Date.now())/86400000);};
const daysUntilDueDay=(dueDay:number)=>{
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let candidate=new Date(now.getFullYear(),now.getMonth(),dueDay);
  if(candidate<today)candidate=new Date(now.getFullYear(),now.getMonth()+1,dueDay);
  return Math.round((candidate.getTime()-today.getTime())/86400000);
};

const LoadingScreen=({fontFamily}:{fontFamily?:string})=>(
  <div style={{background:D.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,fontFamily}}>
    <div className="fin-loading-mark"><FinanceMark size={64}/></div>
    <div style={{color:D.t2,fontSize:13,fontWeight:600,letterSpacing:"0.04em"}}>Finance OS</div>
  </div>
);

type DateFilter={mode:"all"|"today"|"week"|"month"|"custom";date:string};
const matchesDateFilter=(dateStr:string,f:DateFilter)=>{
  if(f.mode==="all")return true;
  if(f.mode==="custom")return f.date?dateStr===f.date:true;
  const d=new Date(dateStr+"T00:00:00");
  const now=new Date();
  if(f.mode==="today")return d.toDateString()===now.toDateString();
  if(f.mode==="month")return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  if(f.mode==="week"){
    const start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-now.getDay());
    const end=new Date(start.getFullYear(),start.getMonth(),start.getDate()+7);
    return d>=start&&d<end;
  }
  return true;
};

// ── SVG ICONS ─────────────────────────────────────────────────────────────────
const G=({d,s=20,c="currentColor",sw=1.7}:{d:string|string[];s?:number;c?:string;sw?:number})=>(
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
  </svg>
);
const IC={
  home:["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z","M9 22V12h6v10"],
  company:"M2 20h20M4 20V10l8-6 8 6v10M10 20v-5h4v5",
  personal:"M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  debt:"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  cog:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  plus:"M12 5v14M5 12h14",
  x:"M18 6 6 18M6 6l12 12",
  trash:["M3 6h18","M8 6V4h8v2","M19 6l-1 14H6L5 6"],
  check:"M20 6 9 17l-5-5",
  arUp:"M12 19V5M5 12l7-7 7 7",
  arDn:"M12 5v14M19 12l-7 7-7-7",
  cal:"M3 4h18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M1 10h22",
  repeat:"M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
  bank:["M3 6l9-3 9 3v2H3V6z","M3 8h18v2H3z","M5 10v8","M9 10v8","M15 10v8","M19 10v8","M2 18h20"],
  clock:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  warn:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  trend:"M23 6l-9.5 9.5-5-5L1 18",
  card:["M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z","M2 10h20"],
  coin:["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z","M12 6.5v11","M14.8 9a2.6 2.6 0 0 0-2.6-2H11a2.3 2.3 0 0 0 0 4.6h2a2.3 2.3 0 0 1 0 4.6h-1.4a2.6 2.6 0 0 1-2.6-2"],
  eye:["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z","M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
  eyeOff:["M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.7 18.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24","M1 1l22 22"],
  bell:["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9","M13.73 21a2 2 0 0 1-3.46 0"],
  pencil:["M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z","M15 5l4 4"],
  lock:["M5 11h14v10H5z","M8 11V7a4 4 0 0 1 8 0v4"],
  mail:["M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z","m2 6 10 7 10-7"],
  user:["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  tag:["M20.59 13.41 12 22l-9-9L11.59 4.41A2 2 0 0 1 13 3.83h6.17A1.83 1.83 0 0 1 21 5.66v6.17a2 2 0 0 1-.41.99z","M15.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"],
  refresh:["M23 4v6h-6","M1 20v-6h6","M3.51 9a9 9 0 0 1 14.85-3.36L23 10","M1 14l4.64 4.36A9 9 0 0 0 20.49 15"],
  filter:["M22 3H2l8 9.46V19l4 2v-8.54z"],
  chevron:"M9 18l6-6-6-6",

};

// ── SHARED UI ──────────────────────────────────────────────────────────────────
const Prog=({val,col,h=4}:{val:number;col:string;h?:number})=>(
  <div style={{width:"100%",height:h,background:D.b1,borderRadius:h,overflow:"hidden"}}>
    <div style={{width:`${Math.min(100,Math.max(0,val))}%`,height:"100%",background:col,borderRadius:h,transition:"width .5s cubic-bezier(.4,0,.2,1)"}}/>
  </div>
);

const Badge=({label,color}:{label:string;color:string})=>(
  <span style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color,background:color+"22",padding:"3px 8px",borderRadius:100,textTransform:"uppercase" as const,border:`1px solid ${color}33`}}>{label}</span>
);

const Lbl=({children}:{children:string})=>(
  <div style={{fontSize:11,fontWeight:700,color:D.t2,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:8}}>{children}</div>
);

const EmptyState=({icon,title,sub,color}:{icon:string|string[];title:string;sub:string;color:string})=>(
  <div style={{padding:"48px 20px",textAlign:"center" as const}}>
    <div style={{width:52,height:52,borderRadius:16,background:color+"14",border:`1px solid ${color}33`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
      <G d={icon} s={22} c={color}/>
    </div>
    <div style={{fontSize:16,fontWeight:700,color:D.t1,marginBottom:6}}>{title}</div>
    <div style={{fontSize:13,color:D.t2}}>{sub}</div>
  </div>
);

// ── SHARED LAYOUT ──────────────────────────────────────────────────────────────
const PageHeader=({title,sub}:{title:string;sub:string})=>(
  <div>
    <div style={{fontSize:28,fontWeight:800,color:D.t1,letterSpacing:"-0.03em",marginBottom:4}}>{title}</div>
    <div style={{fontSize:13,color:D.t2}}>{sub}</div>
  </div>
);

const StatRow=({stats}:{stats:{l:string;v:string;c:string}[]})=>(
  <div style={{display:"flex",background:D.s2,border:`1px solid ${D.b1}`,borderRadius:18,overflow:"hidden"}}>
    {stats.map((s,i)=>(
      <div key={s.l} style={{flex:1,padding:"16px 12px",textAlign:"center" as const,borderLeft:i>0?`1px solid ${D.b0}`:"none"}}>
        <div style={{fontSize:11,color:D.t2,marginBottom:8}}>{s.l}</div>
        <div style={{fontSize:16,fontWeight:800,color:s.c,fontVariantNumeric:"tabular-nums"}}>{s.v}</div>
      </div>
    ))}
  </div>
);

const SectionCard=({icon,title,children}:{icon:string|string[];title:string;children:React.ReactNode})=>(
  <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:18,padding:20,display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:30,height:30,borderRadius:9,background:D.goldDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <G d={icon} s={15} c={D.gold}/>
      </div>
      <div style={{fontSize:14,fontWeight:700,color:D.t1}}>{title}</div>
    </div>
    {children}
  </div>
);

const AccountCard=({account,usage,onDelete,onEdit}:{account:Account;usage?:{used:number;available?:number};onDelete?:()=>void;onEdit?:()=>void})=>{
  const isCredit=account.kind==="credit_card"&&account.creditLimit!=null;
  const pct=isCredit?Math.min(100,((usage?.used||0)/account.creditLimit!)*100):0;
  return(
    <div onClick={onEdit} style={{minWidth:210,width:210,borderRadius:18,padding:"18px 18px 16px",flexShrink:0,position:"relative",overflow:"hidden",background:`linear-gradient(135deg, ${D.s3} 0%, ${D.s2} 65%, ${D.s1} 100%)`,border:`1px solid ${D.b2}`,cursor:onEdit?"pointer":"default"}}>
      <div style={{position:"absolute",top:-30,right:-30,width:110,height:110,borderRadius:"50%",background:`radial-gradient(circle, ${D.gold}22 0%, transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,position:"relative"}}>
        <G d={accountKindIcon(account.kind)} s={20} c={D.gold}/>
        <div style={{display:"flex",gap:10}}>
          {onEdit&&<button onClick={e=>{e.stopPropagation();onEdit();}} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:0}}><G d={IC.pencil} s={13}/></button>}
          {onDelete&&<button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:0}}><G d={IC.trash} s={13}/></button>}
        </div>
      </div>
      <div style={{fontSize:15,fontWeight:700,color:D.t1,marginBottom:3,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{account.name}</div>
      <div style={{fontSize:11,color:D.t2,marginBottom:isCredit||account.balance!=null?14:0}}>{accountKindLabel(account.kind)}</div>
      {isCredit&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:800,color:D.t1}}>{money(usage?.used||0,sym(account.currency),true)}</span>
            <span style={{fontSize:11,color:D.t3}}>of {money(account.creditLimit!,sym(account.currency),true)}</span>
          </div>
          <Prog val={pct} col={pct>85?D.rose:D.gold} h={4}/>
        </div>
      )}
      {!isCredit&&account.balance!=null&&(
        <div>
          <div style={{fontSize:20,fontWeight:800,color:account.balance<0?D.rose:D.t1,fontVariantNumeric:"tabular-nums"}}>{money(account.balance,sym(account.currency),true)}</div>
          {account.creditLimit!=null&&(
            <div style={{fontSize:11,color:D.t3,marginTop:4}}>Limit {money(account.creditLimit,sym(account.currency),true)}</div>
          )}
        </div>
      )}
    </div>
  );
};

// ── BOTTOM SHEET ───────────────────────────────────────────────────────────────
const Sheet=({open,onClose,title,children,tall}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;tall?:boolean})=>{
  const [mounted,setMounted]=useState(false);
  const [entered,setEntered]=useState(false);
  useEffect(()=>{
    if(open){
      setMounted(true);
      const raf=requestAnimationFrame(()=>setEntered(true));
      return ()=>cancelAnimationFrame(raf);
    }else{
      setEntered(false);
      const t=setTimeout(()=>setMounted(false),220);
      return ()=>clearTimeout(t);
    }
  },[open]);
  if(!mounted)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",opacity:entered?1:0,transition:"opacity .22s ease"}} onClick={onClose}/>
      <div style={{position:"relative",background:D.s2,borderRadius:"28px 28px 0 0",maxHeight:tall?"95vh":"85vh",display:"flex",flexDirection:"column",border:`1px solid ${D.b2}`,borderBottom:"none",boxShadow:"0 -20px 60px rgba(0,0,0,0.5)",transform:entered?"translateY(0)":"translateY(100%)",transition:"transform .28s cubic-bezier(.32,.72,0,1)"}}>
        <div style={{display:"flex",justifyContent:"center",padding:"14px 0 0"}}>
          <div style={{width:44,height:4,background:D.b2,borderRadius:4}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 22px 18px"}}>
          <div style={{fontSize:20,fontWeight:800,color:D.t1}}>{title}</div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:12,background:D.s3,border:`1px solid ${D.b1}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:D.t2}}>
            <G d={IC.x} s={15}/>
          </button>
        </div>
        <div style={{overflowY:"auto",padding:"0 22px 48px",flex:1,display:"flex",flexDirection:"column",gap:16}}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ── FORM FIELDS ────────────────────────────────────────────────────────────────
const Inp=({label,type="text",val,onChange,placeholder,min,max,autoFocus}:{label:string;type?:string;val:string;onChange:(v:string)=>void;placeholder?:string;min?:string;max?:string;autoFocus?:boolean})=>{
  const [reveal,setReveal]=useState(false);
  const isPw=type==="password";
  return(
    <div>
      <Lbl>{label}</Lbl>
      <div style={{position:"relative"}}>
        <input type={isPw&&reveal?"text":type} value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} autoFocus={autoFocus}
          style={{width:"100%",boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:14,padding:isPw?"14px 46px 14px 16px":"14px 16px",color:D.t1,fontSize:16,fontWeight:500,outline:"none",fontFamily:"inherit",transition:"border-color .2s"}}
          onFocus={e=>{e.target.style.borderColor=D.gold;e.target.style.boxShadow=`0 0 0 3px ${D.goldDim}`;}}
          onBlur={e=>{e.target.style.borderColor=D.b1;e.target.style.boxShadow="none";}}
        />
        {isPw&&(
          <button type="button" onClick={()=>setReveal(r=>!r)} aria-label={reveal?"Hide password":"Show password"}
            style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:D.t2,padding:4,display:"flex"}}>
            <G d={reveal?IC.eyeOff:IC.eye} s={18}/>
          </button>
        )}
      </div>
    </div>
  );
};

const Sel=({label,val,onChange,opts}:{label:string;val:string;onChange:(v:string)=>void;opts:{v:string;l:string}[]})=>(
  <div>
    <Lbl>{label}</Lbl>
    <select value={val} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:14,padding:"14px 16px",color:val?D.t1:D.t2,fontSize:16,fontWeight:500,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
      <option value="">Select…</option>
      {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const PrimaryBtn=({label,onClick,color,disabled,icon}:{label:string;onClick:()=>void;color?:string;disabled?:boolean;icon?:string})=>{
  const c=color||D.gold;
  return(
    <button onClick={onClick} disabled={disabled}
      style={{width:"100%",padding:"15px",background:disabled?D.s3:c,border:disabled?`1px solid ${D.b1}`:"none",borderRadius:12,color:disabled?D.t3:"#fff",fontSize:15,fontWeight:700,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity .15s",fontFamily:"inherit"}}>
      {icon&&<G d={icon} s={17} c={disabled?D.t3:"#fff"}/>}{label}
    </button>
  );
};

const GhostBtn=({label,onClick,color}:{label:string;onClick:()=>void;color?:string})=>{
  const c=color||D.t2;
  return(
    <button onClick={onClick} style={{width:"100%",padding:"15px",background:"transparent",border:`1px solid ${D.b1}`,borderRadius:16,color:c,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
      {label}
    </button>
  );
};

const Chip=({label,active,onClick,color}:{label:string;active:boolean;onClick:()=>void;color:string})=>(
  <button type="button" onClick={onClick}
    style={{padding:"10px 14px",borderRadius:10,background:active?color+"22":D.s3,border:`1px solid ${active?color:D.b1}`,color:active?color:D.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}>
    {label}
  </button>
);

const ChipGroup=({label,val,onChange,opts,color}:{label:string;val:string;onChange:(v:string)=>void;opts:string[];color:string})=>(
  <div>
    <Lbl>{label}</Lbl>
    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
      {opts.map(o=><Chip key={o} label={o} active={val===o} onClick={()=>onChange(o)} color={color}/>)}
    </div>
  </div>
);

const ACCOUNT_KINDS:{v:AccountKind;l:string;icon:string|string[]}[]=[
  {v:"bank",l:"Bank Account",icon:IC.bank},{v:"credit_card",l:"Credit Card",icon:IC.card},{v:"crypto",l:"Crypto Wallet",icon:IC.coin},
];
const accountKindLabel=(k:AccountKind)=>ACCOUNT_KINDS.find(a=>a.v===k)?.l||k;
const accountKindIcon=(k:AccountKind)=>ACCOUNT_KINDS.find(a=>a.v===k)?.icon||IC.bank;

const AccountPicker=({label,val,onChange,accounts,color}:{label:string;val:string|undefined;onChange:(v:string|undefined)=>void;accounts:Account[];color:string})=>(
  <div>
    <Lbl>{label}</Lbl>
    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
      <Chip label="Cash" active={!val} color={color} onClick={()=>onChange(undefined)}/>
      {accounts.map(a=><Chip key={a.id} label={a.name} active={val===a.id} color={color} onClick={()=>onChange(a.id)}/>)}
    </div>
  </div>
);

const DATE_FILTER_OPTS:{v:DateFilter["mode"];l:string}[]=[{v:"all",l:"All Time"},{v:"today",l:"Today"},{v:"week",l:"This Week"},{v:"month",l:"This Month"},{v:"custom",l:"Pick a Date"}];
const DateFilterBar=({value,onChange,color}:{value:DateFilter;onChange:(v:DateFilter)=>void;color:string})=>(
  <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <G d={IC.filter} s={12} c={D.t3}/>
      <span style={{fontSize:11,color:D.t3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Filter</span>
    </div>
    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
      {DATE_FILTER_OPTS.map(o=>(
        <Chip key={o.v} label={o.l} active={value.mode===o.v} color={color} onClick={()=>onChange({mode:o.v,date:o.v==="custom"?(value.date||today()):value.date})}/>
      ))}
    </div>
    {value.mode==="custom"&&(
      <input type="date" value={value.date} onChange={e=>onChange({mode:"custom",date:e.target.value})}
        style={{boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:12,padding:"11px 14px",color:D.t1,fontSize:15,outline:"none",fontFamily:"inherit"}}/>
    )}
  </div>
);

// ── TRANSACTION ROW ────────────────────────────────────────────────────────────
const TxRow=({tx,accounts,onDel,onEdit}:{tx:Tx;accounts:Account[];onDel:()=>void;onEdit:()=>void})=>{
  const isIn=tx.type==="company_in"||tx.type==="personal_in";
  const isCompany=tx.type==="company_in"||tx.type==="company_out";
  const c=isIn?D.teal:D.rose;
  const account=tx.accountId?accounts.find(a=>a.id===tx.accountId):undefined;
  return(
    <div onClick={onEdit} style={{display:"flex",alignItems:"center",padding:"15px 0",borderBottom:`1px solid ${D.b0}`,gap:14,cursor:"pointer"}}>
      <div style={{width:44,height:44,borderRadius:14,background:isIn?D.tealDim:D.roseDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${c}22`}}>
        <G d={isIn?IC.arUp:IC.arDn} s={18} c={c}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{tx.description}</div>
        <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap" as const}}>
          <span style={{fontSize:11,color:D.t2}}>{tx.category}</span>
          <span style={{fontSize:11,color:D.b2}}>·</span>
          <span style={{fontSize:11,color:D.t3}}>{tx.date}</span>
          {account&&(
            <span style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:D.gold}}>
              <span style={{color:D.b2}}>·</span><G d={accountKindIcon(account.kind)} s={11} c={D.gold}/>{account.name}
            </span>
          )}
          {isCompany&&!!tx.myShare&&(
            <span style={{fontSize:11,color:D.gold}}>· {money(tx.myShare,sym(tx.currency))} yours</span>
          )}
        </div>
      </div>
      <div style={{flexShrink:0,textAlign:"right" as const}}>
        <div style={{fontSize:15,fontWeight:800,color:c,fontVariantNumeric:"tabular-nums"}}>{isIn?"+":"-"}{money(tx.amount,sym(tx.currency))}</div>
        <button onClick={e=>{e.stopPropagation();onDel();}} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"3px 0",marginTop:2}}><G d={IC.trash} s={13}/></button>
      </div>
      <G d={IC.chevron} s={15} c={D.t3} sw={2}/>
    </div>
  );
};

// ── MONTHLY ROW ────────────────────────────────────────────────────────────────
const MonthlyRow=({m,accounts,onDel,onToggle,onEdit}:{m:Monthly;accounts:Account[];onDel:()=>void;onToggle:()=>void;onEdit:()=>void})=>{
  const c=m.scope==="company"?D.gold:D.violet;
  const account=m.accountId?accounts.find(a=>a.id===m.accountId):undefined;
  return(
    <div onClick={onEdit} style={{display:"flex",alignItems:"center",padding:"14px 0",borderBottom:`1px solid ${D.b0}`,gap:12,cursor:"pointer"}}>
      <div style={{width:42,height:42,borderRadius:13,background:c+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${c}22`}}>
        <G d={IC.repeat} s={16} c={c}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:m.active?D.t1:D.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{m.name}</div>
        <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center",flexWrap:"wrap" as const}}>
          <span style={{fontSize:11,color:D.t2}}>Due {ordinal(m.dueDay)}</span>
          <span style={{fontSize:11,color:D.b2}}>·</span>
          <span style={{fontSize:11,color:D.t2}}>{m.category}</span>
          {account&&(
            <span style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:D.t2}}>
              <span style={{color:D.b2}}>·</span><G d={accountKindIcon(account.kind)} s={11} c={D.t2}/>{account.name}
            </span>
          )}
          {!m.active&&<Badge label="Paused" color={D.t3}/>}
        </div>
      </div>
      <div style={{flexShrink:0,textAlign:"right" as const}}>
        <div style={{fontSize:15,fontWeight:800,color:m.active?c:D.t3,fontVariantNumeric:"tabular-nums"}}>-{money(m.amount,sym(m.currency))}</div>
        <div style={{display:"flex",gap:6,marginTop:4,justifyContent:"flex-end"}}>
          <button onClick={e=>{e.stopPropagation();onToggle();}} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"2px"}}><G d={IC.repeat} s={12}/></button>
          <button onClick={e=>{e.stopPropagation();onDel();}} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"2px"}}><G d={IC.trash} s={12}/></button>
        </div>
      </div>
      <G d={IC.chevron} s={14} c={D.t3} sw={2}/>
    </div>
  );
};

// ── ADD FORMS ──────────────────────────────────────────────────────────────────
const AddTxForm=({type,editing,onAdd,onEdit,onClose,defCur,accounts,companyCategories}:{type:TxType;editing?:Tx;onAdd:(t:Tx)=>void;onEdit?:(original:Tx,edited:Tx)=>void;onClose:()=>void;defCur:string;accounts:Account[];companyCategories:string[]})=>{
  const [amt,setAmt]=useState(editing?String(editing.amount):"");const [desc,setDesc]=useState(editing?.description||"");const [cat,setCat]=useState(editing?.category||"");
  const [date,setDate]=useState(editing?.date||today());const [notes,setNotes]=useState(editing?.notes||"");const [cur,setCur]=useState(editing?.currency||defCur);
  const [myShare,setMyShare]=useState(editing?.myShare!=null?String(editing.myShare):"");
  const [accountId,setAccountId]=useState<string|undefined>(editing?.accountId);
  const [more,setMore]=useState(!!editing);
  const isIn=type==="company_in"||type==="personal_in";
  const isCompany=type==="company_in"||type==="company_out";
  const showAccountPicker=type==="personal_out"||type==="company_out";
  const baseCats=type==="company_in"?COMPANY_IN_CATS:type==="company_out"?COMPANY_OUT_CATS:type==="personal_in"?PERSONAL_IN_CATS:PERSONAL_OUT_CATS;
  const cats=isCompany?[...baseCats,...companyCategories.filter(c=>!baseCats.includes(c))]:baseCats;
  const c=isIn?D.teal:D.rose;
  const ok=!!amt&&!!cat;
  const handle=()=>{
    if(!ok)return;
    const tx:Tx={id:editing?.id||uid(),type,amount:parseFloat(amt),description:desc||cat,category:cat,date,notes,currency:cur,createdAt:editing?.createdAt||new Date().toISOString()};
    if(isCompany&&myShare)tx.myShare=parseFloat(myShare)||0;
    if(showAccountPicker&&accountId)tx.accountId=accountId;
    if(editing&&onEdit)onEdit(editing,tx);else onAdd(tx);
    onClose();
  };
  return(<>
    <Inp label="Amount" type="number" val={amt} onChange={setAmt} placeholder={`${sym(cur)} 0.00`} autoFocus/>
    <ChipGroup label="Category" val={cat} onChange={setCat} opts={cats} color={c}/>
    {isCompany&&(
      <Inp label={type==="company_in"?"How much of this is yours? (optional)":"How much are you personally paying? (optional)"} type="number" val={myShare} onChange={setMyShare} placeholder={`${sym(cur)} 0.00`}/>
    )}
    {showAccountPicker&&<AccountPicker label="Paid With" val={accountId} onChange={setAccountId} accounts={accounts} color={c}/>}
    <Inp label="Description (optional)" val={desc} onChange={setDesc} placeholder={cat||"What is this for?"}/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    {!more
      ?<button type="button" onClick={()=>setMore(true)} style={{background:"none",border:"none",color:D.t2,fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"left" as const,padding:"2px 0",fontFamily:"inherit"}}>+ Date &amp; notes</button>
      :<>
        <Inp label="Date" type="date" val={date} onChange={setDate}/>
        <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="Add any note…"/>
      </>}
    <PrimaryBtn label={editing?"Save Changes":isIn?"Add Income":"Add Expense"} onClick={handle} color={c} disabled={!ok}/>
  </>);
};

const SUBSCRIPTION_PRESETS = ["Netflix","Spotify","YouTube Premium","iCloud+","Amazon Prime","Disney+","Gym Membership","Internet & Phone"];

const AddMonthlyForm=({scope,editing,onAdd,onEdit,onClose,defCur,accounts,companyCategories}:{scope:"personal"|"company";editing?:Monthly;onAdd:(m:Monthly)=>void;onEdit?:(original:Monthly,edited:Monthly)=>void;onClose:()=>void;defCur:string;accounts:Account[];companyCategories:string[]})=>{
  const [name,setName]=useState(editing?.name||"");const [amt,setAmt]=useState(editing?String(editing.amount):"");const [cat,setCat]=useState(editing?.category||"");
  const [day,setDay]=useState(editing?String(editing.dueDay):"1");const [cur,setCur]=useState(editing?.currency||defCur);const [notes,setNotes]=useState(editing?.notes||"");
  const [accountId,setAccountId]=useState<string|undefined>(editing?.accountId);
  const baseCats=scope==="company"?COMPANY_M_CATS:PERSONAL_M_CATS;
  const cats=scope==="company"?[...baseCats,...companyCategories.filter(c=>!baseCats.includes(c))]:baseCats;
  const ok=!!name&&!!amt&&!!cat;
  const col=scope==="company"?D.gold:D.violet;
  const handle=()=>{
    if(!ok)return;
    const m:Monthly={id:editing?.id||uid(),scope,name,amount:parseFloat(amt),currency:cur,dueDay:parseInt(day)||1,category:cat,notes,active:editing?.active??true,createdAt:editing?.createdAt||new Date().toISOString(),accountId};
    if(editing&&onEdit)onEdit(editing,m);else onAdd(m);
    onClose();
  };
  return(<>
    {scope==="personal"&&!editing&&(
      <div>
        <Lbl>Quick Add — Subscribed To</Lbl>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
          {SUBSCRIPTION_PRESETS.map(p=>(
            <Chip key={p} label={p} active={name===p} color={col} onClick={()=>{setName(p);setCat("Subscription");}}/>
          ))}
        </div>
      </div>
    )}
    <Inp label="Expense Name" val={name} onChange={setName} placeholder="e.g. Netflix, Rent, Family Support…"/>
    <Inp label="Amount" type="number" val={amt} onChange={setAmt} placeholder={`${sym(cur)} 0.00`}/>
    <ChipGroup label="Category" val={cat} onChange={setCat} opts={cats} color={col}/>
    <AccountPicker label={scope==="company"?"Paid With":"Billed To"} val={accountId} onChange={setAccountId} accounts={accounts} color={col}/>
    <Inp label="Due Day of Month (1–31)" type="number" val={day} onChange={setDay} min="1" max="31"/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="e.g. for the house on Al-Thawra street…"/>
    <PrimaryBtn label={editing?"Save Changes":"Add Monthly Expense"} onClick={handle} color={col} disabled={!ok}/>
  </>);
};

const AddDebtForm=({editing,onAdd,onEdit,onClose,defCur}:{editing?:Debt;onAdd:(d:Debt)=>void;onEdit?:(original:Debt,edited:Debt)=>void;onClose:()=>void;defCur:string})=>{
  const [person,setPerson]=useState(editing?.personBank||"");const [total,setTotal]=useState(editing?String(editing.totalAmount):"");const [cur,setCur]=useState(editing?.currency||defCur);
  const [desc,setDesc]=useState(editing?.description||"");const [due,setDue]=useState(editing?.dueDate||"");const [notes,setNotes]=useState(editing?.notes||"");
  const ok=!!person&&!!total&&!!desc;
  const handle=()=>{
    if(!ok)return;
    const d:Debt={id:editing?.id||uid(),personBank:person,totalAmount:parseFloat(total),currency:cur,description:desc,dueDate:due||undefined,notes,payments:editing?.payments||[],createdAt:editing?.createdAt||new Date().toISOString()};
    if(editing&&onEdit)onEdit(editing,d);else onAdd(d);
    onClose();
  };
  return(<>
    <Inp label="Who do you owe? (Bank / Person name)" val={person} onChange={setPerson} placeholder="e.g. Ahmad, Chase Bank, loan from a friend…"/>
    <Inp label="Total Debt Amount" type="number" val={total} onChange={setTotal} placeholder={`${sym(cur)} 0.00`}/>
    <Inp label="What is this debt for?" val={desc} onChange={setDesc} placeholder="e.g. Business loan, Car purchase…"/>
    <Inp label="Final Due Date (optional)" type="date" val={due} onChange={setDue}/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="Any extra details…"/>
    <PrimaryBtn label={editing?"Save Changes":"Add Debt"} onClick={handle} color={D.rose} disabled={!ok}/>
  </>);
};

const PayForm=({debt,onPay,onClose}:{debt:Debt;onPay:(n:number,note:string,date:string)=>void;onClose:()=>void})=>{
  const [amt,setAmt]=useState("");const [note,setNote]=useState("");const [date,setDate]=useState(today());
  const remaining=debt.totalAmount-debt.payments.reduce((s,p)=>s+p.amount,0);
  const s=sym(debt.currency);const ok=!!amt&&parseFloat(amt)>0;
  return(<>
    <div style={{background:D.roseDim,border:`1px solid ${D.rose}33`,borderRadius:16,padding:18,textAlign:"center" as const}}>
      <div style={{fontSize:12,color:D.t2,marginBottom:6}}>Remaining on this debt</div>
      <div style={{fontSize:32,fontWeight:900,color:D.rose,fontVariantNumeric:"tabular-nums"}}>{money(remaining,s)}</div>
      <div style={{fontSize:12,color:D.t2,marginTop:6}}>{debt.description} — {debt.personBank}</div>
    </div>
    <Inp label="Payment Amount" type="number" val={amt} onChange={setAmt} placeholder={`${s} 0.00`}/>
    <Inp label="Date of Payment" type="date" val={date} onChange={setDate}/>
    <Inp label="Note (optional)" val={note} onChange={setNote} placeholder="e.g. Bank transfer…"/>
    <PrimaryBtn label="Record Payment" onClick={()=>{if(ok){onPay(parseFloat(amt),note,date);onClose();}}} color={D.teal} disabled={!ok}/>
  </>);
};

const AddAccountForm=({editing,onAdd,onEdit,onClose,defCur}:{editing?:Account;onAdd:(a:Account)=>void;onEdit?:(original:Account,edited:Account)=>void;onClose:()=>void;defCur:string})=>{
  const [name,setName]=useState(editing?.name||"");const [kind,setKind]=useState<AccountKind>(editing?.kind||"bank");
  const [limit,setLimit]=useState(editing?.creditLimit!=null?String(editing.creditLimit):"");
  const [balance,setBalance]=useState(editing?.balance!=null?String(editing.balance):"");const [cur,setCur]=useState(editing?.currency||defCur);
  const ok=!!name;
  const handle=()=>{
    if(!ok)return;
    const a:Account={id:editing?.id||uid(),name,kind,currency:cur,createdAt:editing?.createdAt||new Date().toISOString()};
    if(kind==="credit_card"){
      if(limit)a.creditLimit=parseFloat(limit)||undefined;
    }else{
      a.balance=balance?parseFloat(balance)||0:0;
      if(limit)a.creditLimit=parseFloat(limit)||undefined;
    }
    if(editing&&onEdit)onEdit(editing,a);else onAdd(a);
    onClose();
  };
  return(<>
    <Inp label="Account Name" val={name} onChange={setName} placeholder="e.g. CIB Visa, Chase Checking, Binance…" autoFocus/>
    <div>
      <Lbl>Type</Lbl>
      <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
        {ACCOUNT_KINDS.map(k=><Chip key={k.v} label={k.l} active={kind===k.v} color={D.gold} onClick={()=>setKind(k.v)}/>)}
      </div>
    </div>
    {kind==="credit_card"
      ?<Inp label="Credit Limit (optional)" type="number" val={limit} onChange={setLimit} placeholder={`${sym(cur)} 0.00`}/>
      :<>
        <Inp label="Current Balance" type="number" val={balance} onChange={setBalance} placeholder={`${sym(cur)} 0.00`}/>
        <Inp label="Limit (optional)" type="number" val={limit} onChange={setLimit} placeholder={`${sym(cur)} 0.00`}/>
      </>}
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    <PrimaryBtn label={editing?"Save Changes":"Add Account"} onClick={handle} color={D.gold} disabled={!ok}/>
  </>);
};

// ── MAIN APP ───────────────────────────────────────────────────────────────────
function FinanceApp({userId,onSignOut}:{userId:string;onSignOut:()=>void}){
  const [tab,setTab]=useState("home");
  const [txs,setTxs]=useState<Tx[]>([]);
  const [monthly,setMonthly]=useState<Monthly[]>([]);
  const [debts,setDebts]=useState<Debt[]>([]);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [settings,setSettings]=useState<Settings>({currency:"USD",name:"",savings:0,companyCategories:[]});
  const [sheet,setSheet]=useState<{open:boolean;key:string;debt?:Debt;editTx?:Tx;editMonthly?:Monthly;editDebt?:Debt;editAccount?:Account}>({open:false,key:""});
  const [ready,setReady]=useState(false);
  const [toast,setToast]=useState("");
  const showToast=useCallback((msg:string)=>{
    setToast(msg);
    setTimeout(()=>setToast(t=>t===msg?"":t),2200);
  },[]);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const data=await db.fetchAll(userId);
        if(cancelled)return;
        setTxs(data.txs);setMonthly(data.monthly);setDebts(data.debts);setSettings(data.settings);setAccounts(data.accounts);
      }catch(err){
        console.error(err);
        window.alert("Couldn't load your data. Please refresh the page.");
      }finally{
        if(!cancelled)setReady(true);
      }
    })();
    return ()=>{cancelled=true;};
  },[userId]);

  // Keep the auth session/token fresh in the background
  useEffect(()=>{
    const id=setInterval(()=>{supabase.auth.getSession().catch(()=>{});},4*60*1000);
    return ()=>clearInterval(id);
  },[]);

  const S=sym(settings.currency);

  // Mutations
  // Adjusts a credit-card-linked debt's total by `delta` (creates the debt if it doesn't exist and delta>0)
  const adjustCardDebt=useCallback(async(account:Account,delta:number,currency:string)=>{
    if(delta===0)return;
    const existing=debts.find(d=>d.description==="Credit Card Spending"&&d.personBank.toLowerCase()===account.name.toLowerCase());
    if(existing){
      const newTotal=existing.totalAmount+delta;
      await db.setDebtTotal(existing.id,newTotal);
      setDebts(p=>p.map(d=>d.id===existing.id?{...d,totalAmount:newTotal}:d));
    }else if(delta>0){
      const newDebt=await db.insertDebt(userId,{personBank:account.name,totalAmount:delta,currency,description:"Credit Card Spending"});
      setDebts(p=>[newDebt,...p]);
    }
  },[userId,debts]);
  // Adjusts a bank/crypto account's balance by `delta`
  const adjustAccountBalance=useCallback(async(account:Account,delta:number)=>{
    if(delta===0)return;
    const newBalance=(account.balance||0)+delta;
    await db.setAccountBalance(account.id,newBalance);
    setAccounts(p=>p.map(a=>a.id===account.id?{...a,balance:newBalance}:a));
  },[]);
  // Applies the balance/debt effect of an expense tx being added (amount is positive spend)
  const applyExpenseEffect=useCallback(async(account:Account|undefined,amount:number,currency:string)=>{
    if(!account)return;
    if(account.kind==="credit_card")await adjustCardDebt(account,amount,currency);
    else if(account.balance!=null)await adjustAccountBalance(account,-amount);
  },[adjustCardDebt,adjustAccountBalance]);

  const addTx=useCallback(async(t:Tx)=>{
    try{
      const saved=await db.insertTx(userId,{type:t.type,amount:t.amount,description:t.description,category:t.category,date:t.date,notes:t.notes,currency:t.currency,myShare:t.myShare,accountId:t.accountId});
      setTxs(p=>[saved,...p]);
      const isExpense=saved.type==="personal_out"||saved.type==="company_out";
      const account=saved.accountId?accounts.find(a=>a.id===saved.accountId):undefined;
      if(isExpense)await applyExpenseEffect(account,saved.amount,saved.currency);
      showToast(saved.type.endsWith("_in")?"Income added":"Expense added");
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId,accounts,applyExpenseEffect,showToast]);

  const updateTx=useCallback(async(original:Tx,edited:Tx)=>{
    try{
      const saved=await db.updateTx(original.id,{type:edited.type,amount:edited.amount,description:edited.description,category:edited.category,date:edited.date,notes:edited.notes,currency:edited.currency,myShare:edited.myShare,accountId:edited.accountId});
      setTxs(p=>p.map(t=>t.id===saved.id?saved:t));
      const isExpense=saved.type==="personal_out"||saved.type==="company_out";
      if(isExpense){
        const oldAccount=original.accountId?accounts.find(a=>a.id===original.accountId):undefined;
        const newAccount=saved.accountId?accounts.find(a=>a.id===saved.accountId):undefined;
        if(oldAccount&&newAccount&&oldAccount.id===newAccount.id){
          const delta=saved.amount-original.amount;
          if(oldAccount.kind==="credit_card")await adjustCardDebt(oldAccount,delta,saved.currency);
          else if(oldAccount.balance!=null)await adjustAccountBalance(oldAccount,-delta);
        }else{
          if(oldAccount){
            if(oldAccount.kind==="credit_card")await adjustCardDebt(oldAccount,-original.amount,original.currency);
            else if(oldAccount.balance!=null)await adjustAccountBalance(oldAccount,original.amount);
          }
          await applyExpenseEffect(newAccount,saved.amount,saved.currency);
        }
      }
      showToast("Changes saved");
    }catch(err){console.error(err);window.alert("Couldn't save changes. Please try again.");}
  },[accounts,adjustCardDebt,adjustAccountBalance,applyExpenseEffect,showToast]);

  const delTx=useCallback((tx:Tx)=>{
    setTxs(p=>p.filter(t=>t.id!==tx.id));
    db.deleteTx(tx.id).catch(err=>console.error(err));
    const isExpense=tx.type==="personal_out"||tx.type==="company_out";
    const account=tx.accountId?accounts.find(a=>a.id===tx.accountId):undefined;
    if(isExpense&&account){
      if(account.kind==="credit_card")adjustCardDebt(account,-tx.amount,tx.currency).catch(err=>console.error(err));
      else if(account.balance!=null)adjustAccountBalance(account,tx.amount).catch(err=>console.error(err));
    }
    showToast("Deleted");
  },[accounts,adjustCardDebt,adjustAccountBalance,showToast]);

  const addMonthly=useCallback(async(m:Monthly)=>{
    try{
      const saved=await db.insertMonthly(userId,{scope:m.scope,name:m.name,amount:m.amount,currency:m.currency,dueDay:m.dueDay,category:m.category,notes:m.notes,active:m.active,accountId:m.accountId});
      setMonthly(p=>[saved,...p]);
      showToast("Monthly expense added");
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId,showToast]);
  const updateMonthly=useCallback(async(original:Monthly,edited:Monthly)=>{
    try{
      const saved=await db.updateMonthly(original.id,{scope:edited.scope,name:edited.name,amount:edited.amount,currency:edited.currency,dueDay:edited.dueDay,category:edited.category,notes:edited.notes,active:edited.active,accountId:edited.accountId});
      setMonthly(p=>p.map(m=>m.id===saved.id?saved:m));
      showToast("Changes saved");
    }catch(err){console.error(err);window.alert("Couldn't save changes. Please try again.");}
  },[showToast]);
  const delMonthly=useCallback((id:string)=>{
    setMonthly(p=>p.filter(m=>m.id!==id));
    db.deleteMonthly(id).catch(err=>console.error(err));
    showToast("Deleted");
  },[showToast]);
  const toggleMonthly=useCallback((id:string)=>{
    setMonthly(p=>{
      const target=p.find(m=>m.id===id);
      if(target)db.setMonthlyActive(id,!target.active).catch(err=>console.error(err));
      return p.map(m=>m.id===id?{...m,active:!m.active}:m);
    });
  },[]);

  const addAccount=useCallback(async(a:Account)=>{
    try{
      const saved=await db.insertAccount(userId,{name:a.name,kind:a.kind,creditLimit:a.creditLimit,balance:a.balance,currency:a.currency});
      setAccounts(p=>[saved,...p]);
      showToast("Account added");
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId,showToast]);
  const updateAccount=useCallback(async(original:Account,edited:Account)=>{
    try{
      const saved=await db.updateAccount(original.id,{name:edited.name,kind:edited.kind,creditLimit:edited.creditLimit,balance:edited.balance,currency:edited.currency});
      setAccounts(p=>p.map(a=>a.id===saved.id?saved:a));
      showToast("Changes saved");
    }catch(err){console.error(err);window.alert("Couldn't save changes. Please try again.");}
  },[showToast]);
  const delAccount=useCallback((id:string)=>{
    setAccounts(p=>p.filter(a=>a.id!==id));
    db.deleteAccount(id).catch(err=>console.error(err));
    showToast("Deleted");
  },[showToast]);

  const addDebt=useCallback(async(d:Debt)=>{
    try{
      const saved=await db.insertDebt(userId,{personBank:d.personBank,totalAmount:d.totalAmount,currency:d.currency,description:d.description,dueDate:d.dueDate,notes:d.notes});
      setDebts(p=>[saved,...p]);
      showToast("Debt added");
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId,showToast]);
  const updateDebt=useCallback(async(original:Debt,edited:Debt)=>{
    try{
      await db.updateDebt(original.id,{personBank:edited.personBank,totalAmount:edited.totalAmount,currency:edited.currency,description:edited.description,dueDate:edited.dueDate,notes:edited.notes});
      setDebts(p=>p.map(d=>d.id===original.id?{...edited,payments:d.payments}:d));
      showToast("Changes saved");
    }catch(err){console.error(err);window.alert("Couldn't save changes. Please try again.");}
  },[showToast]);
  const delDebt=useCallback((id:string)=>{
    setDebts(p=>p.filter(d=>d.id!==id));
    db.deleteDebt(id).catch(err=>console.error(err));
    showToast("Deleted");
  },[showToast]);
  const payDebt=useCallback(async(id:string,amount:number,note:string,date:string)=>{
    try{
      const payment=await db.insertDebtPayment(userId,id,amount,note,date);
      setDebts(p=>p.map(d=>d.id===id?{...d,payments:[...d.payments,payment]}:d));
      showToast("Payment recorded");
    }catch(err){console.error(err);window.alert("Couldn't save that payment. Please try again.");}
  },[userId,showToast]);

  // ── Derived numbers
  // Converts an amount in `currency` into the account's base currency (settings.currency),
  // using the manual USD/TRY rate from Settings. Any other currency pair is left unconverted.
  const toBase=(amount:number,currency:string)=>{
    if(currency===settings.currency)return amount;
    if(currency==="USD"&&settings.currency==="TRY")return settings.usdTryRate?amount*settings.usdTryRate:amount;
    if(currency==="TRY"&&settings.currency==="USD")return settings.usdTryRate?amount/settings.usdTryRate:amount;
    return amount;
  };
  const compIn=txs.filter(t=>t.type==="company_in").reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const compOut=txs.filter(t=>t.type==="company_out").reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const compMonthlyActive=monthly.filter(m=>m.scope==="company"&&m.active);
  const compMonthlyTotal=compMonthlyActive.reduce((s,m)=>s+toBase(m.amount,m.currency),0);
  const compProfit=compIn-compOut;
  const myCutIn=txs.filter(t=>t.type==="company_in").reduce((s,t)=>s+toBase(t.myShare||0,t.currency),0);
  const myCutOut=txs.filter(t=>t.type==="company_out").reduce((s,t)=>s+toBase(t.myShare||0,t.currency),0);
  const myCut=myCutIn-myCutOut;
  const isCreditTx=(t:Tx)=>accounts.find(a=>a.id===t.accountId)?.kind==="credit_card";
  const perIn=txs.filter(t=>t.type==="personal_in").reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const perOut=txs.filter(t=>t.type==="personal_out"&&!isCreditTx(t)).reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const perMonthlyActive=monthly.filter(m=>m.scope==="personal"&&m.active);
  const perMonthlyTotal=perMonthlyActive.reduce((s,m)=>s+toBase(m.amount,m.currency),0);
  const perMonthly=monthly.filter(m=>m.scope==="personal");
  const debtRemaining=(d:Debt)=>d.totalAmount-d.payments.reduce((s,p)=>s+p.amount,0);
  const totalDebtLeft=debts.reduce((s,d)=>s+toBase(Math.max(0,debtRemaining(d)),d.currency),0);
  const totalDebtPaid=debts.reduce((s,d)=>s+toBase(d.payments.reduce((ss,p)=>ss+p.amount,0),d.currency),0);
  const totalDebtOrig=debts.reduce((s,d)=>s+toBase(d.totalAmount,d.currency),0);
  const netPos=myCut+perIn-perOut-totalDebtLeft+(settings.savings||0);

  // This month
  const now=new Date();const cm=now.getMonth(),cy=now.getFullYear();
  const mTxs=txs.filter(t=>{const d=new Date(t.date);return d.getMonth()===cm&&d.getFullYear()===cy;});
  const mCompIn=mTxs.filter(t=>t.type==="company_in").reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const mCompOut=mTxs.filter(t=>t.type==="company_out").reduce((s,t)=>s+toBase(t.amount,t.currency),0);
  const mMyCut=mTxs.filter(t=>t.type==="company_in").reduce((s,t)=>s+toBase(t.myShare||0,t.currency),0)-mTxs.filter(t=>t.type==="company_out").reduce((s,t)=>s+toBase(t.myShare||0,t.currency),0);
  const mPerOut=mTxs.filter(t=>t.type==="personal_out"&&!isCreditTx(t)).reduce((s,t)=>s+toBase(t.amount,t.currency),0);

  const upcomingMonthly=monthly.filter(m=>m.active).map(m=>({...m,daysUntil:daysUntilDueDay(m.dueDay)})).sort((a,b)=>a.daysUntil-b.daysUntil);
  const dueSoonCount=upcomingMonthly.filter(m=>m.daysUntil<=7).length;
  const [notifOpen,setNotifOpen]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const doRefresh=()=>{
    setRefreshing(true);
    setTimeout(()=>window.location.reload(),150);
  };

  const openSheet=(key:string,opts?:{debt?:Debt;editTx?:Tx;editMonthly?:Monthly;editDebt?:Debt;editAccount?:Account})=>setSheet({open:true,key,...opts});
  const closeSheet=()=>setSheet({open:false,key:""});

  if(!ready)return<LoadingScreen fontFamily={font.style.fontFamily}/>;

  // ── HOME ───────────────────────────────────────────────────────
  const HomeTab=()=>(
    <div>
      {/* Hero */}
      <div style={{padding:"40px 22px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{fontSize:13,color:D.t2,marginBottom:12}}>
          {settings.name?`Welcome back, ${settings.name}`:"Total net position"}
        </div>
        <div style={{fontSize:48,fontWeight:800,letterSpacing:"-0.03em",lineHeight:1,marginBottom:22,fontVariantNumeric:"tabular-nums",color:D.t1}}>
          {netPos>=0?"+":"-"}{money(Math.abs(netPos),S,true)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",rowGap:16,columnGap:24}}>
          {[{l:"My Cut",v:money(myCut,S,true),c:D.gold},{l:"Savings",v:money(settings.savings||0,S,true),c:D.gold},{l:"Personal",v:money(perIn-perOut,S,true),c:perIn-perOut>=0?D.teal:D.rose},{l:"Debts Left",v:money(totalDebtLeft,S,true),c:D.rose}].map(s=>(
            <div key={s.l}><div style={{fontSize:11,color:D.t3,marginBottom:4}}>{s.l}</div><div style={{fontSize:15,fontWeight:800,color:s.c,fontVariantNumeric:"tabular-nums"}}>{s.v}</div></div>
          ))}
        </div>
      </div>

      {/* Accounts */}
      {accounts.length>0&&(
        <div style={{marginBottom:8}}>
          <div style={{fontSize:15,fontWeight:700,color:D.t1,padding:"0 16px 12px"}}>Your Accounts</div>
          <div style={{display:"flex",gap:12,overflowX:"auto" as const,padding:"0 16px 6px"}}>
            {accounts.map(a=>{
              const debt=debts.find(d=>d.description==="Credit Card Spending"&&d.personBank.toLowerCase()===a.name.toLowerCase());
              const used=debt?debt.totalAmount-debt.payments.reduce((s,p)=>s+p.amount,0):0;
              return<AccountCard key={a.id} account={a} usage={{used}} onEdit={()=>openSheet("add_account",{editAccount:a})}/>;
            })}
          </div>
        </div>
      )}

      <div style={{padding:"22px 16px 20px",display:"flex",flexDirection:"column",gap:20}}>
        {/* This month */}
        <div style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:"0.1em",textTransform:"uppercase" as const}}>{MO[cm]} {cy}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:"18px 16px"}}>
            <div style={{fontSize:10,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10}}>Company Revenue</div>
            <div style={{fontSize:24,fontWeight:900,color:D.teal,fontVariantNumeric:"tabular-nums",marginBottom:6}}>{money(mCompIn,S,true)}</div>
            <div style={{fontSize:11,color:D.gold}}>My cut: {money(mMyCut,S,true)}</div>
          </div>
          <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:"18px 16px"}}>
            <div style={{fontSize:10,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10}}>Company Expenses</div>
            <div style={{fontSize:24,fontWeight:900,color:D.rose,fontVariantNumeric:"tabular-nums",marginBottom:6}}>{money(mCompOut,S,true)}</div>
            <div style={{fontSize:11,color:D.t2}}>Personal: {money(mPerOut,S,true)}</div>
          </div>
        </div>

        {/* Company snapshot */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20}}>
          <div style={{fontSize:11,fontWeight:700,color:D.t2,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:16}}>Company — All Time</div>
          {[
            {l:"Total Revenue In",v:compIn,c:D.teal},
            {l:"Total Expenses Out",v:compOut,c:D.rose},
            {l:"Company Net Profit",v:compProfit,c:compProfit>=0?D.teal:D.rose},
            {l:"My Cut",v:myCut,c:D.gold},
            {l:"Monthly Fixed Costs",v:compMonthlyTotal,c:D.gold,sub:"/mo"},
          ].map((row,i)=>(
            <div key={row.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<4?`1px solid ${D.b0}`:"none"}}>
              <span style={{fontSize:13,color:D.t2}}>{row.l}</span>
              <span style={{fontSize:14,fontWeight:800,color:row.c,fontVariantNumeric:"tabular-nums"}}>{money(row.v,S,true)}{row.sub||""}</span>
            </div>
          ))}
        </div>

        {/* Debt progress */}
        {debts.length>0&&(
          <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:D.t2,letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Debt Progress</div>
              <div style={{fontSize:13,fontWeight:700,color:D.rose,fontVariantNumeric:"tabular-nums"}}>{money(totalDebtLeft,S,true)} left</div>
            </div>
            <Prog val={totalDebtOrig>0?(totalDebtPaid/totalDebtOrig)*100:0} col={D.teal} h={6}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
              <span style={{fontSize:12,color:D.teal}}>Paid {money(totalDebtPaid,S,true)}</span>
              <span style={{fontSize:12,color:D.t3}}>{totalDebtOrig>0?Math.round((totalDebtPaid/totalDebtOrig)*100):0}% done</span>
            </div>
          </div>
        )}

        {/* Recent */}
        <div style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:"0.1em",textTransform:"uppercase" as const}}>Recent Transactions</div>
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,overflow:"hidden"}}>
          {txs.length>0
            ?<div style={{padding:"0 18px"}}>{txs.slice(0,6).map(tx=><TxRow key={tx.id} tx={tx} accounts={accounts} onDel={()=>delTx(tx)} onEdit={()=>openSheet(tx.type,{editTx:tx})}/>)}</div>
            :<EmptyState icon={IC.trend} color={D.gold} title="No transactions yet" sub="Start by adding company revenue or a personal expense."/>}
        </div>

        {/* Quick add */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[{l:"Revenue In",k:"company_in",c:D.teal},{l:"Personal Expense",k:"personal_out",c:D.rose}].map(b=>(
            <button key={b.k} onClick={()=>openSheet(b.k)} style={{padding:"15px 10px",background:b.c+"14",border:`1px solid ${b.c}33`,borderRadius:16,color:b.c,fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
              <G d={IC.plus} s={14} c={b.c}/>{b.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── COMPANY ────────────────────────────────────────────────────
  const CompanyTab=()=>{
    const [view,setView]=useState<"in"|"out"|"monthly">("in");
    const [dateFilter,setDateFilter]=useState<DateFilter>({mode:"all",date:today()});
    const list=txs.filter(t=>t.type===(view==="in"?"company_in":"company_out")&&matchesDateFilter(t.date,dateFilter));
    const compMonthly=monthly.filter(m=>m.scope==="company");
    const col=view==="in"?D.teal:view==="out"?D.rose:D.gold;
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <PageHeader title="Company" sub={`${txs.filter(t=>t.type.startsWith("company")).length} transactions · ${compMonthly.length} monthly`}/>

        <StatRow stats={[{l:"Revenue",v:money(compIn,S,true),c:D.teal},{l:"Expenses",v:money(compOut,S,true),c:D.rose},{l:"My Cut",v:money(myCut,S,true),c:D.gold}]}/>

        {/* Profit card */}
        <div style={{background:D.s2,border:`1px solid ${compProfit>=0?D.teal+"33":D.rose+"33"}`,borderRadius:20,padding:"18px 20px"}}>
          <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:8}}>Company Net Profit</div>
          <div style={{fontSize:32,fontWeight:900,color:compProfit>=0?D.teal:D.rose,fontVariantNumeric:"tabular-nums",marginBottom:12}}>{compProfit>=0?"+":""}{money(compProfit,S)}</div>
          {compIn>0&&<Prog val={compIn>0?Math.max(0,(compProfit/compIn)*100):0} col={compProfit>=0?D.teal:D.rose} h={5}/>}
          {compIn>0&&<div style={{fontSize:12,color:D.t2,marginTop:8}}>{compIn>0?Math.round((compProfit/compIn)*100):0}% profit margin</div>}
        </div>

        {/* Monthly fixed costs summary */}
        {compMonthlyActive.length>0&&(
          <div style={{background:D.goldDim,border:`1px solid ${D.gold}33`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:D.gold,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Monthly Fixed Costs</div>
              <div style={{fontSize:12,color:D.t2}}>{compMonthlyActive.length} recurring expenses</div>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:D.gold,fontVariantNumeric:"tabular-nums"}}>{money(compMonthlyTotal,S)}<span style={{fontSize:13,fontWeight:500}}>/mo</span></div>
          </div>
        )}

        {/* View toggle */}
        <div style={{display:"flex",gap:6,background:D.s1,padding:5,borderRadius:16,border:`1px solid ${D.b0}`}}>
          {[{id:"in",l:"Revenue In",c:D.teal},{id:"out",l:"Expenses Out",c:D.rose},{id:"monthly",l:"Monthly Fixed",c:D.gold}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id as typeof view)} style={{flex:1,padding:"10px 4px",borderRadius:12,background:view===v.id?v.c+"22":"transparent",border:`1px solid ${view===v.id?v.c+"55":"transparent"}`,color:view===v.id?v.c:D.t2,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {v.l}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={()=>openSheet(view==="monthly"?"company_monthly":view==="in"?"company_in":"company_out")}
          style={{padding:"15px",background:col+"18",border:`1px solid ${col}44`,borderRadius:16,color:col,fontSize:14,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
          <G d={IC.plus} s={16} c={col}/>Add {view==="in"?"Revenue":view==="out"?"Expense":"Monthly Fixed Cost"}
        </button>

        {view!=="monthly"&&<DateFilterBar value={dateFilter} onChange={setDateFilter} color={col}/>}

        {/* List */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,overflow:"hidden"}}>
          {view==="monthly"?(
            compMonthly.length>0
              ?<div style={{padding:"0 18px"}}>{compMonthly.map(m=><MonthlyRow key={m.id} m={m} accounts={accounts} onDel={()=>delMonthly(m.id)} onToggle={()=>toggleMonthly(m.id)} onEdit={()=>openSheet("company_monthly",{editMonthly:m})}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No monthly costs added yet. Add recurring expenses like rent, salaries, or software.</div>
          ):(
            list.length>0
              ?<div style={{padding:"0 18px"}}>{list.map(tx=><TxRow key={tx.id} tx={tx} accounts={accounts} onDel={()=>delTx(tx)} onEdit={()=>openSheet(tx.type,{editTx:tx})}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>{dateFilter.mode==="all"?`No ${view==="in"?"revenue":"expenses"} recorded yet.`:"Nothing in this period."}</div>
          )}
        </div>
      </div>
    );
  };

  // ── PERSONAL ───────────────────────────────────────────────────
  const PersonalTab=()=>{
    const [view,setView]=useState<"daily"|"monthly"|"income">("daily");
    const [editingSavings,setEditingSavings]=useState(false);
    const [savingsInput,setSavingsInput]=useState(String(settings.savings||0));
    const [dateFilter,setDateFilter]=useState<DateFilter>({mode:"all",date:today()});
    const daily=txs.filter(t=>t.type==="personal_out");
    const income=txs.filter(t=>t.type==="personal_in");
    const filteredDaily=daily.filter(t=>matchesDateFilter(t.date,dateFilter));
    const filteredIncome=income.filter(t=>matchesDateFilter(t.date,dateFilter));
    const col=view==="income"?D.teal:view==="monthly"?D.violet:D.rose;
    // Category breakdown for daily
    const cats:{[k:string]:number}={};
    daily.forEach(t=>{cats[t.category]=(cats[t.category]||0)+t.amount;});
    const topCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const maxCat=topCats[0]?.[1]||1;
    const saveSavings=async()=>{
      const val=parseFloat(savingsInput)||0;
      const next={...settings,savings:val};
      setSettings(next);
      setEditingSavings(false);
      try{await db.upsertSettings(userId,next);}catch(err){console.error(err);window.alert("Couldn't save. Please try again.");}
    };
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <PageHeader title="Personal" sub={`${txs.filter(t=>t.type.startsWith("personal")).length} transactions · ${perMonthly.length} monthly`}/>

        <StatRow stats={[{l:"Income",v:money(perIn,S,true),c:D.teal},{l:"Spent",v:money(perOut,S,true),c:D.rose},{l:"Available",v:money(perIn-perOut,S,true),c:(perIn-perOut)>=0?D.teal:D.rose}]}/>

        {/* Savings */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:18,padding:"16px 18px"}}>
          {editingSavings?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Lbl>Total Savings</Lbl>
              <input type="number" value={savingsInput} onChange={e=>setSavingsInput(e.target.value)} autoFocus placeholder={`${S} 0.00`}
                style={{width:"100%",boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:12,padding:"12px 14px",color:D.t1,fontSize:16,fontWeight:600,outline:"none",fontFamily:"inherit"}}/>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setEditingSavings(false)} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${D.b1}`,borderRadius:10,color:D.t2,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                <button onClick={saveSavings} style={{flex:1,padding:"11px",background:D.gold,border:"none",borderRadius:10,color:D.bg,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:D.t2,marginBottom:6}}>Savings</div>
                <div style={{fontSize:22,fontWeight:800,color:D.t1,fontVariantNumeric:"tabular-nums"}}>{money(settings.savings||0,S,true)}</div>
              </div>
              <button onClick={()=>{setSavingsInput(String(settings.savings||0));setEditingSavings(true);}}
                style={{background:D.goldDim,border:`1px solid ${D.gold}44`,borderRadius:10,padding:"9px 14px",color:D.gold,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Monthly fixed */}
        {perMonthly.length>0&&(
          <div style={{background:D.violetDim,border:`1px solid ${D.violet}33`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:D.violet,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Monthly Commitments</div>
              <div style={{fontSize:12,color:D.t2}}>{perMonthly.length} recurring · rent, support, loans…</div>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:D.violet,fontVariantNumeric:"tabular-nums"}}>{money(perMonthlyTotal,S)}<span style={{fontSize:13,fontWeight:500}}>/mo</span></div>
          </div>
        )}

        {/* My company cut */}
        <div style={{background:D.goldDim,border:`1px solid ${D.gold}33`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:D.gold,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Company Cut</div>
            <div style={{fontSize:12,color:D.t2}}>Your share of income, minus what you covered</div>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:D.gold,fontVariantNumeric:"tabular-nums"}}>{money(myCut,S,true)}</div>
        </div>

        {/* Spending breakdown */}
        {view==="daily"&&topCats.length>0&&(
          <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20}}>
            <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:16}}>Spending Breakdown</div>
            {topCats.map(([cat,amount])=>(
              <div key={cat} style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                  <span style={{fontSize:13,color:D.t1}}>{cat}</span>
                  <span style={{fontSize:13,fontWeight:700,color:D.rose,fontVariantNumeric:"tabular-nums"}}>{money(amount,S,true)}</span>
                </div>
                <Prog val={(amount/maxCat)*100} col={D.violet} h={4}/>
              </div>
            ))}
          </div>
        )}

        {/* View toggle */}
        <div style={{display:"flex",gap:6,background:D.s1,padding:5,borderRadius:16,border:`1px solid ${D.b0}`}}>
          {[{id:"daily",l:"Daily Expenses",c:D.rose},{id:"monthly",l:"Monthly Fixed",c:D.violet},{id:"income",l:"Income",c:D.teal}].map(v=>(
            <button key={v.id} onClick={()=>setView(v.id as typeof view)} style={{flex:1,padding:"10px 4px",borderRadius:12,background:view===v.id?v.c+"22":"transparent",border:`1px solid ${view===v.id?v.c+"55":"transparent"}`,color:view===v.id?v.c:D.t2,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
              {v.l}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={()=>openSheet(view==="monthly"?"personal_monthly":view==="income"?"personal_in":"personal_out")}
          style={{padding:"15px",background:col+"18",border:`1px solid ${col}44`,borderRadius:16,color:col,fontSize:14,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
          <G d={IC.plus} s={16} c={col}/>Add {view==="daily"?"Expense":view==="monthly"?"Monthly Expense":"Income"}
        </button>

        {view!=="monthly"&&<DateFilterBar value={dateFilter} onChange={setDateFilter} color={col}/>}

        {/* List */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,overflow:"hidden"}}>
          {view==="monthly"?(
            perMonthly.length>0
              ?<div style={{padding:"0 18px"}}>{perMonthly.map(m=><MonthlyRow key={m.id} m={m} accounts={accounts} onDel={()=>delMonthly(m.id)} onToggle={()=>toggleMonthly(m.id)} onEdit={()=>openSheet("personal_monthly",{editMonthly:m})}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No monthly expenses. Add rent, family support, subscriptions, or friend loans.</div>
          ):view==="daily"?(
            filteredDaily.length>0
              ?<div style={{padding:"0 18px"}}>{filteredDaily.map(tx=><TxRow key={tx.id} tx={tx} accounts={accounts} onDel={()=>delTx(tx)} onEdit={()=>openSheet(tx.type,{editTx:tx})}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>{dateFilter.mode==="all"?"No daily expenses yet. Start tracking food, transport, shopping…":"Nothing in this period."}</div>
          ):(
            filteredIncome.length>0
              ?<div style={{padding:"0 18px"}}>{filteredIncome.map(tx=><TxRow key={tx.id} tx={tx} accounts={accounts} onDel={()=>delTx(tx)} onEdit={()=>openSheet(tx.type,{editTx:tx})}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>{dateFilter.mode==="all"?"No personal income recorded.":"Nothing in this period."}</div>
          )}
        </div>
      </div>
    );
  };

  // ── DEBTS ──────────────────────────────────────────────────────
  const DebtsTab=()=>(
    <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
      <PageHeader title="Debts" sub={`${debts.length} debts tracked`}/>

      {/* Summary */}
      <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:22,textAlign:"center" as const}}>
        <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase" as const,marginBottom:10}}>Total Remaining</div>
        <div style={{fontSize:44,fontWeight:900,color:totalDebtLeft>0?D.rose:D.teal,letterSpacing:"-0.04em",fontVariantNumeric:"tabular-nums",marginBottom:16}}>
          {totalDebtLeft>0?"-":""}{money(totalDebtLeft,S)}
        </div>
        {totalDebtOrig>0&&<>
          <Prog val={(totalDebtPaid/totalDebtOrig)*100} col={D.teal} h={6}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
            <span style={{fontSize:12,color:D.teal}}>Paid: {money(totalDebtPaid,S,true)}</span>
            <span style={{fontSize:12,color:D.t3}}>{Math.round((totalDebtPaid/totalDebtOrig)*100)}% done</span>
          </div>
        </>}
      </div>

      <button onClick={()=>openSheet("add_debt")} style={{padding:"15px",background:D.roseDim,border:`1px solid ${D.rose}44`,borderRadius:16,color:D.rose,fontSize:14,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
        <G d={IC.plus} s={16} c={D.rose}/>Add Debt / Loan
      </button>

      {/* Debt cards */}
      {debts.map(debt=>{
        const paid=debt.payments.reduce((s,p)=>s+p.amount,0);
        const left=Math.max(0,debt.totalAmount-paid);
        const pct=debt.totalAmount>0?(paid/debt.totalAmount)*100:0;
        const ds=sym(debt.currency);
        const linkedAccount=debt.description==="Credit Card Spending"?accounts.find(a=>a.kind==="credit_card"&&a.name.toLowerCase()===debt.personBank.toLowerCase()):undefined;
        const due=daysUntil(debt.dueDate);
        const dueBadge=due!==null?(due<0?{l:"Overdue",c:D.rose}:due<=7?{l:`${due}d left`,c:D.gold}:{l:`${due}d left`,c:D.teal}):null;
        return(
          <div key={debt.id} style={{background:D.s2,border:`1px solid ${left===0?D.teal+"44":D.b1}`,borderRadius:20,overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"18px 18px 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,marginRight:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <div style={{width:36,height:36,borderRadius:11,background:D.goldDim,border:`1px solid ${D.gold}33`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <G d={IC.bank} s={16} c={D.gold}/>
                    </div>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,color:D.t1}}>{debt.personBank}</div>
                      <div style={{fontSize:12,color:D.t2}}>{debt.description}</div>
                    </div>
                  </div>
                  {dueBadge&&<Badge label={dueBadge.l} color={dueBadge.c}/>}
                  {debt.dueDate&&<span style={{fontSize:11,color:D.t3,marginLeft:8}}>Due {debt.dueDate}</span>}
                </div>
                <div style={{display:"flex",gap:10,flexShrink:0}}>
                  <button onClick={()=>openSheet("add_debt",{editDebt:debt})} style={{background:"none",border:"none",cursor:"pointer",color:D.t3}}><G d={IC.pencil} s={14}/></button>
                  <button onClick={()=>delDebt(debt.id)} style={{background:"none",border:"none",cursor:"pointer",color:D.t3}}><G d={IC.trash} s={15}/></button>
                </div>
              </div>
              <div style={{display:"flex",gap:20,marginBottom:16,marginTop:12}}>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Total</div><div style={{fontSize:16,fontWeight:800,color:D.t1,fontVariantNumeric:"tabular-nums"}}>{money(debt.totalAmount,ds)}</div></div>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Paid</div><div style={{fontSize:16,fontWeight:800,color:D.teal,fontVariantNumeric:"tabular-nums"}}>{money(paid,ds)}</div></div>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Remaining</div><div style={{fontSize:16,fontWeight:800,color:left>0?D.rose:D.teal,fontVariantNumeric:"tabular-nums"}}>{money(left,ds)}</div></div>
              </div>
              <Prog val={pct} col={pct>=100?D.teal:D.gold} h={5}/>
              {linkedAccount&&linkedAccount.creditLimit!=null&&(
                <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:`1px solid ${D.b0}`,marginBottom:4}}>
                  <span style={{fontSize:12,color:D.t2}}>Limit {money(linkedAccount.creditLimit,ds,true)}</span>
                  <span style={{fontSize:12,fontWeight:700,color:D.gold}}>{money(Math.max(0,linkedAccount.creditLimit-left),ds,true)} available</span>
                </div>
              )}
            </div>
            {/* Payment history */}
            {debt.payments.length>0&&(
              <div style={{padding:"12px 18px 0",marginTop:12,borderTop:`1px solid ${D.b0}`}}>
                <div style={{fontSize:10,color:D.t3,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:8}}>Payment History</div>
                {debt.payments.slice(-3).reverse().map(p=>(
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${D.b0}`}}>
                    <div style={{fontSize:12,color:D.t2}}>{p.date}{p.note&&<span style={{color:D.t3}}> · {p.note}</span>}</div>
                    <div style={{fontSize:13,fontWeight:700,color:D.teal,fontVariantNumeric:"tabular-nums"}}>{money(p.amount,ds)}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Pay button */}
            <div style={{padding:16}}>
              {left>0
                ?<button onClick={()=>openSheet("pay_debt",{debt})} style={{width:"100%",padding:"13px",background:D.tealDim,border:`1px solid ${D.teal}44`,borderRadius:14,color:D.teal,fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                  Record Payment
                </button>
                :<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"10px",background:D.tealDim,borderRadius:14,fontSize:14,fontWeight:800,color:D.teal}}><G d={IC.check} s={15} c={D.teal}/>Fully Paid Off</div>}
            </div>
          </div>
        );
      })}

      {debts.length===0&&(
        <EmptyState icon={IC.bank} color={D.rose} title="No debts recorded" sub="Track loans, bank debts, or money you owe to friends."/>
      )}
    </div>
  );

  // ── SETTINGS ───────────────────────────────────────────────────
  const SettingsTab=()=>{
    const [name,setName]=useState(settings.name);
    const [username,setUsername]=useState(settings.username||"");
    const [cur,setCur]=useState(settings.currency);
    const [rate,setRate]=useState(settings.usdTryRate!=null?String(settings.usdTryRate):"");
    const [saved,setSaved]=useState(false);
    const [saveErr,setSaveErr]=useState("");
    const [email,setEmail]=useState("");
    const [emailBusy,setEmailBusy]=useState(false);
    const [emailMsg,setEmailMsg]=useState<{ok:boolean;text:string}|null>(null);
    const [newPw,setNewPw]=useState("");
    const [pwBusy,setPwBusy]=useState(false);
    const [pwMsg,setPwMsg]=useState<{ok:boolean;text:string}|null>(null);
    useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(data.user?.email)setEmail(data.user.email);});},[]);
    const changeEmail=async()=>{
      if(!email.includes("@")){setEmailMsg({ok:false,text:"Enter a valid email address."});return;}
      setEmailBusy(true);setEmailMsg(null);
      try{
        const {error}=await supabase.auth.updateUser({email});
        if(error)throw error;
        setEmailMsg({ok:true,text:"Check your inbox to confirm the new email."});
      }catch(err){
        setEmailMsg({ok:false,text:err instanceof Error?err.message:"Couldn't update email."});
      }finally{
        setEmailBusy(false);
      }
    };
    const [newCat,setNewCat]=useState("");
    const addCategory=async()=>{
      const clean=newCat.trim();
      if(!clean||settings.companyCategories.includes(clean))return;
      const next={...settings,companyCategories:[...settings.companyCategories,clean]};
      setSettings(next);setNewCat("");
      try{await db.upsertSettings(userId,next);}catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
    };
    const removeCategory=async(cat:string)=>{
      const next={...settings,companyCategories:settings.companyCategories.filter(c=>c!==cat)};
      setSettings(next);
      try{await db.upsertSettings(userId,next);}catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
    };
    const save=async()=>{
      setSaveErr("");
      const cleanUsername=username.trim().toLowerCase().replace(/[^a-z0-9_.]/g,"");
      const next={...settings,currency:cur,name,username:cleanUsername||undefined,usdTryRate:rate?parseFloat(rate)||undefined:undefined};
      try{
        await db.upsertSettings(userId,next);
        setSettings(next);
        setUsername(cleanUsername);
        setSaved(true);setTimeout(()=>setSaved(false),2500);
        showToast("Settings saved");
      }catch(err){
        console.error(err);
        setSaveErr(err instanceof Error&&err.message.includes("duplicate")?"That username is already taken.":"Couldn't save settings. Please try again.");
      }
    };
    const changePassword=async()=>{
      if(newPw.length<6){setPwMsg({ok:false,text:"Password must be at least 6 characters."});return;}
      setPwBusy(true);setPwMsg(null);
      try{
        const {error}=await supabase.auth.updateUser({password:newPw});
        if(error)throw error;
        setPwMsg({ok:true,text:"Password updated."});
        setNewPw("");
      }catch(err){
        setPwMsg({ok:false,text:err instanceof Error?err.message:"Couldn't update password."});
      }finally{
        setPwBusy(false);
      }
    };
    const clearAllData=async()=>{
      if(!window.confirm("Delete ALL data? This cannot be undone."))return;
      try{
        await Promise.all([
          ...txs.map(t=>db.deleteTx(t.id)),
          ...monthly.map(m=>db.deleteMonthly(m.id)),
          ...debts.map(d=>db.deleteDebt(d.id)),
          ...accounts.map(a=>db.deleteAccount(a.id)),
        ]);
        setTxs([]);setMonthly([]);setDebts([]);setAccounts([]);
        showToast("All data deleted");
      }catch(err){console.error(err);window.alert("Couldn't delete everything. Please try again.");}
    };
    const accountUsage=(a:Account)=>{
      const debt=debts.find(d=>d.description==="Credit Card Spending"&&d.personBank.toLowerCase()===a.name.toLowerCase());
      const used=debt?debt.totalAmount-debt.payments.reduce((s,p)=>s+p.amount,0):0;
      return {used,available:a.creditLimit!=null?a.creditLimit-used:undefined};
    };
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <PageHeader title="Settings" sub="Manage your profile and accounts"/>

        {/* Avatar header */}
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:56,height:56,borderRadius:16,background:"#000",border:`1px solid ${D.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:22,fontWeight:800,color:D.gold}}>{(name||username||"?").charAt(0).toUpperCase()}</span>
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:17,fontWeight:800,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{name||"Your Account"}</div>
            <div style={{fontSize:13,color:D.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{email||"…"}</div>
          </div>
        </div>

        {/* Profile */}
        <SectionCard icon={IC.user} title="Profile">
          <Inp label="Your Name" val={name} onChange={setName} placeholder="Ahmad"/>
          <Inp label="Username (sign in with this instead of email)" val={username} onChange={setUsername} placeholder="e.g. ahmad"/>
          <Sel label="Default Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
          <div style={{fontSize:12,color:D.t3,lineHeight:1.6}}>Your Company Cut is set per-transaction, not a fixed %. Adjust it when adding company income or an expense you covered.</div>
          {saveErr&&<div style={{fontSize:13,color:D.rose,background:D.roseDim,border:`1px solid ${D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{saveErr}</div>}
          <PrimaryBtn label={saved?"Saved":"Save Settings"} onClick={save} color={saved?D.teal:D.gold} icon={saved?IC.check:undefined}/>
        </SectionCard>

        {/* Exchange Rate */}
        <SectionCard icon={IC.coin} title="Exchange Rate">
          <div style={{fontSize:12,color:D.t3,lineHeight:1.6}}>Your default currency is {settings.currency}. Set how many Turkish Lira one US Dollar is worth, so totals mixing USD and TRY add up correctly. Update it anytime rates change.</div>
          <div style={{fontSize:11,color:D.t3}}>
            Currently saved: {settings.usdTryRate!=null?`1 USD = ${settings.usdTryRate} TRY`:"not set yet"}
          </div>
          <Inp label="1 USD = ? TRY" type="number" val={rate} onChange={setRate} placeholder="e.g. 34.50"/>
          {!!rate&&parseFloat(rate)>0&&(
            <div style={{padding:"12px 16px",background:D.goldDim,border:`1px solid ${D.gold}33`,borderRadius:12}}>
              <div style={{fontSize:13,color:D.gold,fontWeight:700}}>Preview: $1 = ₺{parseFloat(rate).toFixed(2)}</div>
              <div style={{fontSize:12,color:D.t2,marginTop:2}}>e.g. $100 = ₺{(parseFloat(rate)*100).toFixed(2)}</div>
            </div>
          )}
          {saveErr&&<div style={{fontSize:13,color:D.rose,background:D.roseDim,border:`1px solid ${D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{saveErr}</div>}
          <PrimaryBtn label={saved?"Saved":"Save Settings"} onClick={save} color={saved?D.teal:D.gold} icon={saved?IC.check:undefined}/>
        </SectionCard>

        {/* Payment Accounts */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:9,background:D.goldDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <G d={IC.card} s={14} c={D.gold}/>
              </div>
              <div style={{fontSize:14,fontWeight:700,color:D.t1}}>Payment Accounts</div>
            </div>
            <button onClick={()=>openSheet("add_account")} style={{background:"none",border:"none",cursor:"pointer",color:D.gold,display:"flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,fontFamily:"inherit"}}>
              <G d={IC.plus} s={13} c={D.gold}/>Add
            </button>
          </div>
          {accounts.length===0
            ?<div style={{fontSize:13,color:D.t2,background:D.s2,border:`1px solid ${D.b1}`,borderRadius:18,padding:20}}>Add your banks, credit cards, or crypto wallets to pick them fast when logging expenses.</div>
            :<div style={{display:"flex",gap:12,overflowX:"auto" as const,paddingBottom:4}}>
              {accounts.map(a=><AccountCard key={a.id} account={a} usage={accountUsage(a)} onDelete={()=>delAccount(a.id)} onEdit={()=>openSheet("add_account",{editAccount:a})}/>)}
            </div>}
        </div>

        {/* Company Categories */}
        <SectionCard icon={IC.tag} title="Company Categories">
          <div style={{fontSize:12,color:D.t3,lineHeight:1.6}}>Add your own categories — e.g. Ads, Software, Client Withdraw, Transfer, Commission — for company income and expenses.</div>
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
            {settings.companyCategories.length===0&&<div style={{fontSize:13,color:D.t2}}>No custom categories yet.</div>}
            {settings.companyCategories.map(cat=>(
              <div key={cat} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 8px 8px 14px",borderRadius:10,background:D.s3,border:`1px solid ${D.b1}`}}>
                <span style={{fontSize:13,color:D.t1,fontWeight:600}}>{cat}</span>
                <button onClick={()=>removeCategory(cat)} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:2,display:"flex"}}><G d={IC.x} s={12}/></button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={newCat} onChange={e=>setNewCat(e.target.value)} placeholder="e.g. Ads"
              style={{flex:1,minWidth:0,boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:12,padding:"12px 14px",color:D.t1,fontSize:16,outline:"none",fontFamily:"inherit"}}
              onKeyDown={e=>{if(e.key==="Enter")addCategory();}}/>
            <button onClick={addCategory} style={{padding:"0 18px",background:D.goldDim,border:`1px solid ${D.gold}44`,borderRadius:12,color:D.gold,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Add</button>
          </div>
        </SectionCard>

        {/* Security */}
        <SectionCard icon={IC.lock} title="Security">
          <Inp label="Email Address" type="email" val={email} onChange={setEmail} placeholder="you@example.com"/>
          {emailMsg&&<div style={{fontSize:13,color:emailMsg.ok?D.teal:D.rose,background:emailMsg.ok?D.tealDim:D.roseDim,border:`1px solid ${emailMsg.ok?D.teal:D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{emailMsg.text}</div>}
          <GhostBtn label={emailBusy?"Updating…":"Update Email"} onClick={changeEmail}/>
          <div style={{height:1,background:D.b0,margin:"4px 0"}}/>
          <Inp label="New Password" type="password" val={newPw} onChange={setNewPw} placeholder="At least 6 characters"/>
          {pwMsg&&<div style={{fontSize:13,color:pwMsg.ok?D.teal:D.rose,background:pwMsg.ok?D.tealDim:D.roseDim,border:`1px solid ${pwMsg.ok?D.teal:D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{pwMsg.text}</div>}
          <GhostBtn label={pwBusy?"Updating…":"Update Password"} onClick={changePassword}/>
        </SectionCard>

        {/* Data */}
        <SectionCard icon={IC.trash} title="Your Data">
          <div style={{fontSize:13,color:D.t2}}>{txs.length} transactions · {monthly.length} monthly · {debts.length} debts</div>
          <GhostBtn label="Clear All Data" onClick={clearAllData} color={D.rose}/>
        </SectionCard>

        <button onClick={onSignOut} style={{width:"100%",padding:"15px",background:"transparent",border:`1px solid ${D.b1}`,borderRadius:12,color:D.t2,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          Sign Out
        </button>
        <div style={{textAlign:"center" as const,fontSize:12,color:D.t3,paddingBottom:12}}>Finance OS · Synced to your account</div>
      </div>
    );
  };

  // ── BOTTOM NAV ─────────────────────────────────────────────────
  const navItems=[
    {id:"home",l:"Home",icon:IC.home,c:D.gold},
    {id:"company",l:"Company",icon:IC.company,c:D.teal},
    {id:"personal",l:"Personal",icon:IC.personal,c:D.violet},
    {id:"debts",l:"Debts",icon:IC.debt,c:D.rose},
    {id:"settings",l:"Settings",icon:IC.cog,c:D.t2},
  ];

  // ── SHEETS ─────────────────────────────────────────────────────
  const sheetConfig:{[k:string]:{title:string;tall?:boolean}}={
    company_in:{title:sheet.editTx?"Edit Company Revenue":"Add Company Revenue"},
    company_out:{title:sheet.editTx?"Edit Company Expense":"Add Company Expense"},
    company_monthly:{title:sheet.editMonthly?"Edit Monthly Company Cost":"Add Monthly Company Cost"},
    personal_in:{title:sheet.editTx?"Edit Personal Income":"Add Personal Income"},
    personal_out:{title:sheet.editTx?"Edit Daily Expense":"Add Daily Expense"},
    personal_monthly:{title:sheet.editMonthly?"Edit Monthly Personal Expense":"Add Monthly Personal Expense"},
    add_debt:{title:sheet.editDebt?"Edit Debt / Loan":"Add Debt / Loan",tall:true},
    pay_debt:{title:`Pay — ${sheet.debt?.personBank||""}`},
    add_account:{title:sheet.editAccount?"Edit Payment Account":"Add Payment Account"},
  };

  const sheetBody=()=>{
    const k=sheet.key;
    if(!sheet.open)return null;
    if(k==="add_debt")return<AddDebtForm editing={sheet.editDebt} onAdd={addDebt} onEdit={updateDebt} onClose={closeSheet} defCur={settings.currency}/>;
    if(k==="pay_debt"&&sheet.debt)return<PayForm debt={sheet.debt} onPay={(n,note,date)=>payDebt(sheet.debt!.id,n,note,date)} onClose={closeSheet}/>;
    if(k==="add_account")return<AddAccountForm editing={sheet.editAccount} onAdd={addAccount} onEdit={updateAccount} onClose={closeSheet} defCur={settings.currency}/>;
    if(k==="company_monthly")return<AddMonthlyForm scope="company" editing={sheet.editMonthly} onAdd={addMonthly} onEdit={updateMonthly} onClose={closeSheet} defCur={settings.currency} accounts={accounts} companyCategories={settings.companyCategories}/>;
    if(k==="personal_monthly")return<AddMonthlyForm scope="personal" editing={sheet.editMonthly} onAdd={addMonthly} onEdit={updateMonthly} onClose={closeSheet} defCur={settings.currency} accounts={accounts} companyCategories={settings.companyCategories}/>;
    if(["company_in","company_out","personal_in","personal_out"].includes(k))return<AddTxForm type={k as TxType} editing={sheet.editTx} onAdd={addTx} onEdit={updateTx} onClose={closeSheet} defCur={settings.currency} accounts={accounts} companyCategories={settings.companyCategories}/>;
    return null;
  };

  const cfg=sheetConfig[sheet.key];

  return(
    <div className={font.className} style={{background:D.bg,minHeight:"100vh",width:"100%",maxWidth:480,margin:"0 auto",color:D.t1,overflowX:"hidden" as const,boxSizing:"border-box" as const}}>
      <div style={{paddingBottom:88}}>
        {tab==="home"&&<HomeTab/>}
        {tab==="company"&&<CompanyTab/>}
        {tab==="personal"&&<PersonalTab/>}
        {tab==="debts"&&<DebtsTab/>}
        {tab==="settings"&&<SettingsTab/>}
      </div>

      {/* Refresh + Notifications */}
      <button onClick={doRefresh} aria-label="Refresh" disabled={refreshing}
        style={{position:"fixed",top:16,right:"max(66px, calc(50vw - 176px))",width:42,height:42,borderRadius:14,background:"rgba(17,26,51,0.9)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:`1px solid ${D.b2}`,cursor:refreshing?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
        <G d={IC.refresh} s={17} c={D.t2} sw={2}/>
      </button>
      <button onClick={()=>setNotifOpen(true)} aria-label="Notifications"
        style={{position:"fixed",top:16,right:"max(16px, calc(50vw - 224px))",width:42,height:42,borderRadius:14,background:"rgba(17,26,51,0.9)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:`1px solid ${D.b2}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
        <G d={IC.bell} s={19} c={dueSoonCount>0?D.gold:D.t2}/>
        {dueSoonCount>0&&(
          <span style={{position:"absolute",top:5,right:5,minWidth:16,height:16,borderRadius:8,background:D.rose,color:"#fff",fontSize:10,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{dueSoonCount}</span>
        )}
      </button>

      {/* Quick add — daily expense, reachable from any tab */}
      {tab!=="settings"&&!sheet.open&&(
        <button onClick={()=>openSheet("personal_out")} aria-label="Add expense"
          style={{position:"fixed",bottom:96,right:"max(18px, calc(50vw - 222px))",width:54,height:54,borderRadius:14,background:D.rose,border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:99}}>
          <G d={IC.plus} s={24} c="#fff"/>
        </button>
      )}

      {/* Floating pill nav */}
      <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",width:"calc(100% - 32px)",maxWidth:448,background:"rgba(13,15,26,0.92)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${D.b2}`,borderRadius:100,display:"flex",zIndex:100,padding:"4px",boxShadow:"0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)"}}>
        {navItems.map(n=>{
          const active=tab===n.id;
          return(
            <button key={n.id} onClick={()=>setTab(n.id)} style={{flex:1,padding:"10px 4px 8px",background:active?n.c+"22":"transparent",border:`1px solid ${active?n.c+"44":"transparent"}`,borderRadius:100,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all .2s",fontFamily:"inherit"}}>
              <G d={n.icon} s={20} c={active?n.c:D.t3}/>
              <span style={{fontSize:9,fontWeight:active?800:600,color:active?n.c:D.t3,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>{n.l}</span>
            </button>
          );
        })}
      </div>

      {/* Sheet */}
      {cfg&&(
        <Sheet open={sheet.open} onClose={closeSheet} title={cfg.title} tall={cfg.tall}>
          {sheetBody()}
        </Sheet>
      )}

      {/* Notifications panel */}
      <Sheet open={notifOpen} onClose={()=>setNotifOpen(false)} title="Upcoming Payments">
        {upcomingMonthly.length===0
          ?<div style={{textAlign:"center" as const,padding:"32px 0",color:D.t2,fontSize:14}}>No recurring payments set up yet.</div>
          :upcomingMonthly.map(m=>{
            const c=m.daysUntil<=3?D.rose:m.daysUntil<=7?D.gold:D.t2;
            return(
              <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${D.b0}`}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:D.t1}}>{m.name}</div>
                  <div style={{fontSize:12,color:D.t2,marginTop:2}}>{m.scope==="company"?"Company":"Personal"} · Due {ordinal(m.dueDay)}</div>
                </div>
                <div style={{textAlign:"right" as const}}>
                  <div style={{fontSize:14,fontWeight:700,color:D.t1}}>{money(m.amount,sym(m.currency))}</div>
                  <div style={{fontSize:11,fontWeight:700,color:c,marginTop:2}}>{m.daysUntil===0?"Today":m.daysUntil===1?"Tomorrow":`${m.daysUntil}d`}</div>
                </div>
              </div>
            );
          })}
      </Sheet>

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"rgba(17,26,51,0.96)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",border:`1px solid ${D.b2}`,borderRadius:100,padding:"11px 20px",display:"flex",alignItems:"center",gap:8,zIndex:600,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>
          <G d={IC.check} s={14} c={D.teal}/>
          <span style={{fontSize:13,fontWeight:600,color:D.t1}}>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ── AUTH ───────────────────────────────────────────────────────────────────────
const LoginScreen=()=>{
  const [identifier,setIdentifier]=useState("");
  const [password,setPassword]=useState("");
  const [remember,setRemember]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const ok=!!identifier&&!!password;

  const submit=async()=>{
    if(!ok||busy)return;
    setBusy(true);setError("");
    try{
      let email=identifier.trim();
      if(!email.includes("@")){
        const resolved=await db.resolveUsernameEmail(email);
        if(!resolved)throw new Error("Invalid login credentials");
        email=resolved;
      }
      setRememberMe(remember);
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;
    }catch(err){
      setError(err instanceof Error?err.message:"Something went wrong. Please try again.");
    }finally{
      setBusy(false);
    }
  };

  return(
    <div className={font.className} style={{background:D.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,color:D.t1}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{textAlign:"center" as const,marginBottom:32}}>
          <div style={{width:56,height:56,borderRadius:16,background:"#000",border:`1px solid ${D.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <G d={IC.trend} s={26} c={D.gold}/>
          </div>
          <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>Finance OS</div>
          <div style={{fontSize:13,color:D.t2,marginTop:4}}>Sign in to your account</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Inp label="Username" val={identifier} onChange={setIdentifier} placeholder="ahmad" autoFocus/>
          <Inp label="Password" type="password" val={password} onChange={setPassword} placeholder="Your password"/>
          <button type="button" onClick={()=>setRemember(r=>!r)} style={{display:"flex",alignItems:"center",gap:9,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit"}}>
            <div style={{width:19,height:19,borderRadius:6,background:remember?D.gold:"transparent",border:`1.5px solid ${remember?D.gold:D.b2}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {remember&&<G d={IC.check} s={12} c={D.bg} sw={3}/>}
            </div>
            <span style={{fontSize:13,color:D.t2,fontWeight:500}}>Remember me</span>
          </button>
          {error&&<div style={{fontSize:13,color:D.rose,background:D.roseDim,border:`1px solid ${D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{error}</div>}
          <PrimaryBtn label={busy?"Please wait…":"Sign In"} onClick={submit} disabled={!ok||busy}/>
        </div>
      </div>
    </div>
  );
};

export default function Page(){
  const [session,setSession]=useState<Session|null|undefined>(undefined);

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,sess)=>setSession(sess));
    return ()=>listener.subscription.unsubscribe();
  },[]);

  if(session===undefined)return<LoadingScreen/>;
  if(!session)return<LoginScreen/>;
  return<FinanceApp userId={session.user.id} onSignOut={()=>supabase.auth.signOut()}/>;
}
"use client";
import { useState, useEffect, useCallback } from "react";
import { Inter } from "next/font/google";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import * as db from "@/lib/supabase/db";
import type { TxType, Tx, Monthly, DebtPayment, Debt, Settings } from "@/lib/types";

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
  bg:"#06080F", s1:"#0B0E19", s2:"#101420", s3:"#161B2C",
  b0:"rgba(255,255,255,0.04)", b1:"rgba(255,255,255,0.08)", b2:"rgba(255,255,255,0.14)",
  indigo:"#6366F1", indigoDim:"rgba(99,102,241,0.14)",
  teal:"#2DD4A0", tealDim:"rgba(45,212,160,0.12)",
  rose:"#FF4D72", roseDim:"rgba(255,77,114,0.12)",
  amber:"#FBBF24", amberDim:"rgba(251,191,36,0.12)",
  violet:"#A78BFA", violetDim:"rgba(167,139,250,0.12)",
  t1:"#ECF0FA", t2:"#7C88A2", t3:"#3D4558",
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

// ── BOTTOM SHEET ───────────────────────────────────────────────────────────────
const Sheet=({open,onClose,title,children,tall}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;tall?:boolean})=>{
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}} onClick={onClose}/>
      <div style={{position:"relative",background:D.s2,borderRadius:"28px 28px 0 0",maxHeight:tall?"95vh":"85vh",display:"flex",flexDirection:"column",border:`1px solid ${D.b2}`,borderBottom:"none",boxShadow:"0 -20px 60px rgba(0,0,0,0.5)"}}>
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
const Inp=({label,type="text",val,onChange,placeholder,min,max,autoFocus}:{label:string;type?:string;val:string;onChange:(v:string)=>void;placeholder?:string;min?:string;max?:string;autoFocus?:boolean})=>(
  <div>
    <Lbl>{label}</Lbl>
    <input type={type} value={val} onChange={e=>onChange(e.target.value)} placeholder={placeholder} min={min} max={max} autoFocus={autoFocus}
      style={{width:"100%",boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:14,padding:"14px 16px",color:D.t1,fontSize:15,fontWeight:500,outline:"none",fontFamily:"inherit",transition:"border-color .2s"}}
      onFocus={e=>{e.target.style.borderColor=D.indigo;e.target.style.boxShadow=`0 0 0 3px ${D.indigoDim}`;}}
      onBlur={e=>{e.target.style.borderColor=D.b1;e.target.style.boxShadow="none";}}
    />
  </div>
);

const Sel=({label,val,onChange,opts}:{label:string;val:string;onChange:(v:string)=>void;opts:{v:string;l:string}[]})=>(
  <div>
    <Lbl>{label}</Lbl>
    <select value={val} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",boxSizing:"border-box" as const,background:D.s3,border:`1px solid ${D.b1}`,borderRadius:14,padding:"14px 16px",color:val?D.t1:D.t2,fontSize:15,fontWeight:500,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
      <option value="">Select…</option>
      {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>
);

const Toggler=({on,toggle,label,sub}:{on:boolean;toggle:()=>void;label:string;sub?:string})=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:D.s3,border:`1px solid ${D.b1}`,borderRadius:14,padding:"14px 16px"}}>
    <div><div style={{fontSize:14,fontWeight:600,color:D.t1}}>{label}</div>{sub&&<div style={{fontSize:12,color:D.t2,marginTop:3}}>{sub}</div>}</div>
    <button onClick={toggle} style={{width:50,height:28,borderRadius:14,background:on?D.indigo:D.b2,border:"none",cursor:"pointer",position:"relative",transition:"background .25s",flexShrink:0}}>
      <div style={{position:"absolute",top:4,left:on?26:4,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .25s",boxShadow:"0 2px 6px rgba(0,0,0,0.3)"}}/>
    </button>
  </div>
);

const PrimaryBtn=({label,onClick,color,disabled,icon}:{label:string;onClick:()=>void;color?:string;disabled?:boolean;icon?:string})=>{
  const c=color||D.indigo;
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

// ── TRANSACTION ROW ────────────────────────────────────────────────────────────
const TxRow=({tx,onDel}:{tx:Tx;onDel:()=>void})=>{
  const isIn=tx.type==="company_in"||tx.type==="personal_in";
  const isCompany=tx.type==="company_in"||tx.type==="company_out";
  const c=isIn?D.teal:D.rose;
  return(
    <div style={{display:"flex",alignItems:"center",padding:"15px 0",borderBottom:`1px solid ${D.b0}`,gap:14}}>
      <div style={{width:44,height:44,borderRadius:14,background:isIn?D.tealDim:D.roseDim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${c}22`}}>
        <G d={isIn?IC.arUp:IC.arDn} s={18} c={c}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:D.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{tx.description}</div>
        <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
          <span style={{fontSize:11,color:D.t2}}>{tx.category}</span>
          <span style={{fontSize:11,color:D.b2}}>·</span>
          <span style={{fontSize:11,color:D.t3}}>{tx.date}</span>
          {tx.payment==="credit"&&(
            <span style={{display:"flex",alignItems:"center",gap:3,fontSize:11,color:D.amber}}>
              <span style={{color:D.b2}}>·</span><G d={IC.card} s={11} c={D.amber}/>{tx.card}
            </span>
          )}
          {isCompany&&!!tx.myShare&&(
            <span style={{fontSize:11,color:D.amber}}>· {money(tx.myShare,sym(tx.currency))} yours</span>
          )}
        </div>
      </div>
      <div style={{flexShrink:0,textAlign:"right" as const}}>
        <div style={{fontSize:15,fontWeight:800,color:c,fontVariantNumeric:"tabular-nums"}}>{isIn?"+":"-"}{money(tx.amount,sym(tx.currency))}</div>
        <button onClick={onDel} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"3px 0",marginTop:2}}><G d={IC.trash} s={13}/></button>
      </div>
    </div>
  );
};

// ── MONTHLY ROW ────────────────────────────────────────────────────────────────
const MonthlyRow=({m,onDel,onToggle}:{m:Monthly;onDel:()=>void;onToggle:()=>void})=>{
  const c=m.scope==="company"?D.amber:D.violet;
  return(
    <div style={{display:"flex",alignItems:"center",padding:"14px 0",borderBottom:`1px solid ${D.b0}`,gap:12}}>
      <div style={{width:42,height:42,borderRadius:13,background:c+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${c}22`}}>
        <G d={IC.repeat} s={16} c={c}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:m.active?D.t1:D.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{m.name}</div>
        <div style={{display:"flex",gap:8,marginTop:4,alignItems:"center"}}>
          <span style={{fontSize:11,color:D.t2}}>Due {ordinal(m.dueDay)}</span>
          <span style={{fontSize:11,color:D.b2}}>·</span>
          <span style={{fontSize:11,color:D.t2}}>{m.category}</span>
          {!m.active&&<Badge label="Paused" color={D.t3}/>}
        </div>
      </div>
      <div style={{flexShrink:0,textAlign:"right" as const}}>
        <div style={{fontSize:15,fontWeight:800,color:m.active?c:D.t3,fontVariantNumeric:"tabular-nums"}}>-{money(m.amount,sym(m.currency))}</div>
        <div style={{display:"flex",gap:6,marginTop:4,justifyContent:"flex-end"}}>
          <button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"2px"}}><G d={IC.repeat} s={12}/></button>
          <button onClick={onDel} style={{background:"none",border:"none",cursor:"pointer",color:D.t3,padding:"2px"}}><G d={IC.trash} s={12}/></button>
        </div>
      </div>
    </div>
  );
};

// ── ADD FORMS ──────────────────────────────────────────────────────────────────
const PAID_WITH:{v:"cash"|"debit"|"credit";l:string}[]=[{v:"cash",l:"Cash"},{v:"debit",l:"Debit Card"},{v:"credit",l:"Credit Card"}];

const AddTxForm=({type,onAdd,onClose,defCur}:{type:TxType;onAdd:(t:Tx)=>void;onClose:()=>void;defCur:string})=>{
  const [amt,setAmt]=useState("");const [desc,setDesc]=useState("");const [cat,setCat]=useState("");
  const [date,setDate]=useState(today());const [notes,setNotes]=useState("");const [cur,setCur]=useState(defCur);
  const [myShare,setMyShare]=useState("");
  const [payment,setPayment]=useState<"cash"|"debit"|"credit">("debit");
  const [card,setCard]=useState("");
  const [more,setMore]=useState(false);
  const isIn=type==="company_in"||type==="personal_in";
  const isCompany=type==="company_in"||type==="company_out";
  const cats=type==="company_in"?COMPANY_IN_CATS:type==="company_out"?COMPANY_OUT_CATS:type==="personal_in"?PERSONAL_IN_CATS:PERSONAL_OUT_CATS;
  const c=isIn?D.teal:D.rose;
  const needsCard=type==="personal_out"&&payment==="credit";
  const ok=!!amt&&!!cat&&(!needsCard||!!card);
  const handle=()=>{
    if(!ok)return;
    const tx:Tx={id:uid(),type,amount:parseFloat(amt),description:desc||cat,category:cat,date,notes,currency:cur,createdAt:new Date().toISOString()};
    if(isCompany&&myShare)tx.myShare=parseFloat(myShare)||0;
    if(type==="personal_out"){tx.payment=payment;if(payment==="credit")tx.card=card;}
    onAdd(tx);onClose();
  };
  return(<>
    <Inp label="Amount" type="number" val={amt} onChange={setAmt} placeholder={`${sym(cur)} 0.00`} autoFocus/>
    <ChipGroup label="Category" val={cat} onChange={setCat} opts={cats} color={c}/>
    {isCompany&&(
      <Inp label={type==="company_in"?"How much of this is yours? (optional)":"How much are you personally paying? (optional)"} type="number" val={myShare} onChange={setMyShare} placeholder={`${sym(cur)} 0.00`}/>
    )}
    {type==="personal_out"&&(
      <div>
        <Lbl>Paid With</Lbl>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:8}}>
          {PAID_WITH.map(p=><Chip key={p.v} label={p.l} active={payment===p.v} color={c} onClick={()=>setPayment(p.v)}/>)}
        </div>
      </div>
    )}
    {needsCard&&<Inp label="Which card / bank?" val={card} onChange={setCard} placeholder="e.g. CIB Visa, Chase Sapphire…"/>}
    <Inp label="Description (optional)" val={desc} onChange={setDesc} placeholder={cat||"What is this for?"}/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    {!more
      ?<button type="button" onClick={()=>setMore(true)} style={{background:"none",border:"none",color:D.t2,fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"left" as const,padding:"2px 0",fontFamily:"inherit"}}>+ Date &amp; notes</button>
      :<>
        <Inp label="Date" type="date" val={date} onChange={setDate}/>
        <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="Add any note…"/>
      </>}
    <PrimaryBtn label={isIn?"Add Income":"Add Expense"} onClick={handle} color={c} disabled={!ok}/>
  </>);
};

const SUBSCRIPTION_PRESETS = ["Netflix","Spotify","YouTube Premium","iCloud+","Amazon Prime","Disney+","Gym Membership","Internet & Phone"];

const AddMonthlyForm=({scope,onAdd,onClose,defCur}:{scope:"personal"|"company";onAdd:(m:Monthly)=>void;onClose:()=>void;defCur:string})=>{
  const [name,setName]=useState("");const [amt,setAmt]=useState("");const [cat,setCat]=useState("");
  const [day,setDay]=useState("1");const [cur,setCur]=useState(defCur);const [notes,setNotes]=useState("");
  const cats=scope==="company"?COMPANY_M_CATS:PERSONAL_M_CATS;const ok=!!name&&!!amt&&!!cat;
  const col=scope==="company"?D.amber:D.violet;
  const handle=()=>{if(!ok)return;onAdd({id:uid(),scope,name,amount:parseFloat(amt),currency:cur,dueDay:parseInt(day)||1,category:cat,notes,active:true,createdAt:new Date().toISOString()});onClose();};
  return(<>
    {scope==="personal"&&(
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
    <Inp label="Due Day of Month (1–31)" type="number" val={day} onChange={setDay} min="1" max="31"/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="e.g. for the house on Al-Thawra street…"/>
    <PrimaryBtn label="Add Monthly Expense" onClick={handle} color={col} disabled={!ok}/>
  </>);
};

const AddDebtForm=({onAdd,onClose,defCur}:{onAdd:(d:Debt)=>void;onClose:()=>void;defCur:string})=>{
  const [person,setPerson]=useState("");const [total,setTotal]=useState("");const [cur,setCur]=useState(defCur);
  const [desc,setDesc]=useState("");const [due,setDue]=useState("");const [notes,setNotes]=useState("");
  const ok=!!person&&!!total&&!!desc;
  const handle=()=>{if(!ok)return;onAdd({id:uid(),personBank:person,totalAmount:parseFloat(total),currency:cur,description:desc,dueDate:due||undefined,notes,payments:[],createdAt:new Date().toISOString()});onClose();};
  return(<>
    <Inp label="Who do you owe? (Bank / Person name)" val={person} onChange={setPerson} placeholder="e.g. Ahmad, Chase Bank, دين لصديق…"/>
    <Inp label="Total Debt Amount" type="number" val={total} onChange={setTotal} placeholder={`${sym(cur)} 0.00`}/>
    <Inp label="What is this debt for?" val={desc} onChange={setDesc} placeholder="e.g. Business loan, Car purchase…"/>
    <Inp label="Final Due Date (optional)" type="date" val={due} onChange={setDue}/>
    <Sel label="Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
    <Inp label="Notes (optional)" val={notes} onChange={setNotes} placeholder="Any extra details…"/>
    <PrimaryBtn label="Add Debt" onClick={handle} color={D.rose} disabled={!ok}/>
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

// ── MAIN APP ───────────────────────────────────────────────────────────────────
function FinanceApp({userId,onSignOut}:{userId:string;onSignOut:()=>void}){
  const [tab,setTab]=useState("home");
  const [txs,setTxs]=useState<Tx[]>([]);
  const [monthly,setMonthly]=useState<Monthly[]>([]);
  const [debts,setDebts]=useState<Debt[]>([]);
  const [settings,setSettings]=useState<Settings>({currency:"USD",name:""});
  const [sheet,setSheet]=useState<{open:boolean;key:string;debt?:Debt}>({open:false,key:""});
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const data=await db.fetchAll(userId);
        if(cancelled)return;
        setTxs(data.txs);setMonthly(data.monthly);setDebts(data.debts);setSettings(data.settings);
      }catch(err){
        console.error(err);
        window.alert("Couldn't load your data. Please refresh the page.");
      }finally{
        if(!cancelled)setReady(true);
      }
    })();
    return ()=>{cancelled=true;};
  },[userId]);

  const S=sym(settings.currency);

  // Mutations
  const addTx=useCallback(async(t:Tx)=>{
    try{
      const saved=await db.insertTx(userId,{type:t.type,amount:t.amount,description:t.description,category:t.category,date:t.date,notes:t.notes,currency:t.currency,myShare:t.myShare,payment:t.payment,card:t.card});
      setTxs(p=>[saved,...p]);
      if(saved.type==="personal_out"&&saved.payment==="credit"&&saved.card){
        const existing=debts.find(d=>d.description==="Credit Card Spending"&&d.personBank.toLowerCase()===saved.card!.toLowerCase());
        if(existing){
          const newTotal=existing.totalAmount+saved.amount;
          await db.setDebtTotal(existing.id,newTotal);
          setDebts(p=>p.map(d=>d.id===existing.id?{...d,totalAmount:newTotal}:d));
        }else{
          const newDebt=await db.insertDebt(userId,{personBank:saved.card,totalAmount:saved.amount,currency:saved.currency,description:"Credit Card Spending"});
          setDebts(p=>[newDebt,...p]);
        }
      }
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId,debts]);
  const delTx=useCallback((id:string)=>{
    setTxs(p=>p.filter(t=>t.id!==id));
    db.deleteTx(id).catch(err=>console.error(err));
  },[]);
  const addMonthly=useCallback(async(m:Monthly)=>{
    try{
      const saved=await db.insertMonthly(userId,{scope:m.scope,name:m.name,amount:m.amount,currency:m.currency,dueDay:m.dueDay,category:m.category,notes:m.notes,active:m.active});
      setMonthly(p=>[saved,...p]);
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId]);
  const delMonthly=useCallback((id:string)=>{
    setMonthly(p=>p.filter(m=>m.id!==id));
    db.deleteMonthly(id).catch(err=>console.error(err));
  },[]);
  const toggleMonthly=useCallback((id:string)=>{
    setMonthly(p=>{
      const target=p.find(m=>m.id===id);
      if(target)db.setMonthlyActive(id,!target.active).catch(err=>console.error(err));
      return p.map(m=>m.id===id?{...m,active:!m.active}:m);
    });
  },[]);
  const addDebt=useCallback(async(d:Debt)=>{
    try{
      const saved=await db.insertDebt(userId,{personBank:d.personBank,totalAmount:d.totalAmount,currency:d.currency,description:d.description,dueDate:d.dueDate,notes:d.notes});
      setDebts(p=>[saved,...p]);
    }catch(err){console.error(err);window.alert("Couldn't save that. Please try again.");}
  },[userId]);
  const delDebt=useCallback((id:string)=>{
    setDebts(p=>p.filter(d=>d.id!==id));
    db.deleteDebt(id).catch(err=>console.error(err));
  },[]);
  const payDebt=useCallback(async(id:string,amount:number,note:string,date:string)=>{
    try{
      const payment=await db.insertDebtPayment(userId,id,amount,note,date);
      setDebts(p=>p.map(d=>d.id===id?{...d,payments:[...d.payments,payment]}:d));
    }catch(err){console.error(err);window.alert("Couldn't save that payment. Please try again.");}
  },[userId]);

  // ── Derived numbers
  const compIn=txs.filter(t=>t.type==="company_in").reduce((s,t)=>s+t.amount,0);
  const compOut=txs.filter(t=>t.type==="company_out").reduce((s,t)=>s+t.amount,0);
  const compMonthlyActive=monthly.filter(m=>m.scope==="company"&&m.active);
  const compMonthlyTotal=compMonthlyActive.reduce((s,m)=>s+m.amount,0);
  const compProfit=compIn-compOut;
  const myCutIn=txs.filter(t=>t.type==="company_in").reduce((s,t)=>s+(t.myShare||0),0);
  const myCutOut=txs.filter(t=>t.type==="company_out").reduce((s,t)=>s+(t.myShare||0),0);
  const myCut=myCutIn-myCutOut;
  const perIn=txs.filter(t=>t.type==="personal_in").reduce((s,t)=>s+t.amount,0);
  const perOut=txs.filter(t=>t.type==="personal_out"&&t.payment!=="credit").reduce((s,t)=>s+t.amount,0);
  const perMonthly=monthly.filter(m=>m.scope==="personal"&&m.active);
  const perMonthlyTotal=perMonthly.reduce((s,m)=>s+m.amount,0);
  const debtRemaining=(d:Debt)=>d.totalAmount-d.payments.reduce((s,p)=>s+p.amount,0);
  const totalDebtLeft=debts.reduce((s,d)=>s+Math.max(0,debtRemaining(d)),0);
  const totalDebtPaid=debts.reduce((s,d)=>s+d.payments.reduce((ss,p)=>ss+p.amount,0),0);
  const totalDebtOrig=debts.reduce((s,d)=>s+d.totalAmount,0);
  const netPos=myCut+perIn-perOut-totalDebtLeft;

  // This month
  const now=new Date();const cm=now.getMonth(),cy=now.getFullYear();
  const mTxs=txs.filter(t=>{const d=new Date(t.date);return d.getMonth()===cm&&d.getFullYear()===cy;});
  const mCompIn=mTxs.filter(t=>t.type==="company_in").reduce((s,t)=>s+t.amount,0);
  const mCompOut=mTxs.filter(t=>t.type==="company_out").reduce((s,t)=>s+t.amount,0);
  const mMyCut=mTxs.filter(t=>t.type==="company_in").reduce((s,t)=>s+(t.myShare||0),0)-mTxs.filter(t=>t.type==="company_out").reduce((s,t)=>s+(t.myShare||0),0);
  const mPerOut=mTxs.filter(t=>t.type==="personal_out"&&t.payment!=="credit").reduce((s,t)=>s+t.amount,0);

  const openSheet=(key:string,debt?:Debt)=>setSheet({open:true,key,debt});
  const closeSheet=()=>setSheet({open:false,key:""});

  if(!ready)return<div style={{background:D.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:font.style.fontFamily}}><div style={{color:D.t2}}>Loading…</div></div>;

  // ── HOME ───────────────────────────────────────────────────────
  const HomeTab=()=>(
    <div>
      {/* Hero */}
      <div style={{padding:"44px 22px 36px",background:`radial-gradient(ellipse at 60% 0%, ${D.indigoDim} 0%, transparent 70%)`,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle, ${D.indigo}18 0%, transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{fontSize:12,fontWeight:700,color:D.t2,letterSpacing:"0.12em",textTransform:"uppercase" as const,marginBottom:10}}>
          {settings.name?`${settings.name}'s `:""}Finance OS
        </div>
        <div style={{fontSize:11,color:D.t3,marginBottom:14}}>Total net position</div>
        <div style={{fontSize:52,fontWeight:900,letterSpacing:"-0.04em",lineHeight:1,marginBottom:20,fontVariantNumeric:"tabular-nums",
          background:netPos>=0?`linear-gradient(135deg, ${D.teal}, #20E3B2)`:`linear-gradient(135deg, ${D.rose}, #FF8FA3)`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          {netPos>=0?"+":""}{money(netPos,S,true)}
        </div>
        <div style={{display:"flex",gap:24}}>
          {[{l:"My Cut",v:money(myCut,S,true),c:D.amber},{l:"Personal",v:money(perIn-perOut,S,true),c:perIn-perOut>=0?D.teal:D.rose},{l:"Debts Left",v:money(totalDebtLeft,S,true),c:D.rose}].map(s=>(
            <div key={s.l}><div style={{fontSize:11,color:D.t3,marginBottom:4}}>{s.l}</div><div style={{fontSize:15,fontWeight:800,color:s.c,fontVariantNumeric:"tabular-nums"}}>{s.v}</div></div>
          ))}
        </div>
      </div>

      <div style={{padding:"22px 16px 20px",display:"flex",flexDirection:"column",gap:20}}>
        {/* This month */}
        <div style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:"0.1em",textTransform:"uppercase" as const}}>{MO[cm]} {cy}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:"18px 16px"}}>
            <div style={{fontSize:10,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:10}}>Company Revenue</div>
            <div style={{fontSize:24,fontWeight:900,color:D.teal,fontVariantNumeric:"tabular-nums",marginBottom:6}}>{money(mCompIn,S,true)}</div>
            <div style={{fontSize:11,color:D.amber}}>My cut: {money(mMyCut,S,true)}</div>
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
            {l:"My Cut",v:myCut,c:D.amber},
            {l:"Monthly Fixed Costs",v:compMonthlyTotal,c:D.amber,sub:"/mo"},
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
            ?<div style={{padding:"0 18px"}}>{txs.slice(0,6).map(tx=><TxRow key={tx.id} tx={tx} onDel={()=>delTx(tx.id)}/>)}</div>
            :<EmptyState icon={IC.trend} color={D.indigo} title="No transactions yet" sub="Start by adding company revenue or a personal expense."/>}
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
    const list=txs.filter(t=>t.type===(view==="in"?"company_in":"company_out"));
    const compMonthly=monthly.filter(m=>m.scope==="company");
    const col=view==="in"?D.teal:view==="out"?D.rose:D.amber;
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <div>
          <div style={{fontSize:26,fontWeight:900,color:D.t1,letterSpacing:"-0.03em",marginBottom:4}}>Company</div>
          <div style={{fontSize:13,color:D.t2}}>{txs.filter(t=>t.type.startsWith("company")).length} transactions · {compMonthly.length} monthly</div>
        </div>

        {/* 3 stat cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{l:"Revenue",v:compIn,c:D.teal},{l:"Expenses",v:compOut,c:D.rose},{l:"My Cut",v:myCut,c:D.amber}].map(s=>(
            <div key={s.l} style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:16,padding:"14px 12px",textAlign:"center" as const}}>
              <div style={{fontSize:10,color:D.t2,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8}}>{s.l}</div>
              <div style={{fontSize:15,fontWeight:900,color:s.c,fontVariantNumeric:"tabular-nums"}}>{money(s.v,S,true)}</div>
            </div>
          ))}
        </div>

        {/* Profit card */}
        <div style={{background:D.s2,border:`1px solid ${compProfit>=0?D.teal+"33":D.rose+"33"}`,borderRadius:20,padding:"18px 20px"}}>
          <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:8}}>Company Net Profit</div>
          <div style={{fontSize:32,fontWeight:900,color:compProfit>=0?D.teal:D.rose,fontVariantNumeric:"tabular-nums",marginBottom:12}}>{compProfit>=0?"+":""}{money(compProfit,S)}</div>
          {compIn>0&&<Prog val={compIn>0?Math.max(0,(compProfit/compIn)*100):0} col={compProfit>=0?D.teal:D.rose} h={5}/>}
          {compIn>0&&<div style={{fontSize:12,color:D.t2,marginTop:8}}>{compIn>0?Math.round((compProfit/compIn)*100):0}% profit margin</div>}
        </div>

        {/* Monthly fixed costs summary */}
        {compMonthlyActive.length>0&&(
          <div style={{background:D.amberDim,border:`1px solid ${D.amber}33`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:11,color:D.amber,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Monthly Fixed Costs</div>
              <div style={{fontSize:12,color:D.t2}}>{compMonthlyActive.length} recurring expenses</div>
            </div>
            <div style={{fontSize:22,fontWeight:900,color:D.amber,fontVariantNumeric:"tabular-nums"}}>{money(compMonthlyTotal,S)}<span style={{fontSize:13,fontWeight:500}}>/mo</span></div>
          </div>
        )}

        {/* View toggle */}
        <div style={{display:"flex",gap:6,background:D.s1,padding:5,borderRadius:16,border:`1px solid ${D.b0}`}}>
          {[{id:"in",l:"Revenue In",c:D.teal},{id:"out",l:"Expenses Out",c:D.rose},{id:"monthly",l:"Monthly Fixed",c:D.amber}].map(v=>(
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

        {/* List */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,overflow:"hidden"}}>
          {view==="monthly"?(
            compMonthly.length>0
              ?<div style={{padding:"0 18px"}}>{compMonthly.map(m=><MonthlyRow key={m.id} m={m} onDel={()=>delMonthly(m.id)} onToggle={()=>toggleMonthly(m.id)}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No monthly costs added yet. Add recurring expenses like rent, salaries, or software.</div>
          ):(
            list.length>0
              ?<div style={{padding:"0 18px"}}>{list.map(tx=><TxRow key={tx.id} tx={tx} onDel={()=>delTx(tx.id)}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No {view==="in"?"revenue":"expenses"} recorded yet.</div>
          )}
        </div>
      </div>
    );
  };

  // ── PERSONAL ───────────────────────────────────────────────────
  const PersonalTab=()=>{
    const [view,setView]=useState<"daily"|"monthly"|"income">("daily");
    const daily=txs.filter(t=>t.type==="personal_out");
    const income=txs.filter(t=>t.type==="personal_in");
    const col=view==="income"?D.teal:view==="monthly"?D.violet:D.rose;
    // Category breakdown for daily
    const cats:{[k:string]:number}={};
    daily.forEach(t=>{cats[t.category]=(cats[t.category]||0)+t.amount;});
    const topCats=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const maxCat=topCats[0]?.[1]||1;
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <div>
          <div style={{fontSize:26,fontWeight:900,color:D.t1,letterSpacing:"-0.03em",marginBottom:4}}>Personal</div>
          <div style={{fontSize:13,color:D.t2}}>{txs.filter(t=>t.type.startsWith("personal")).length} transactions · {perMonthly.length} monthly</div>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{l:"Income",v:perIn,c:D.teal},{l:"Spent",v:perOut,c:D.rose},{l:"Available",v:perIn-perOut,c:(perIn-perOut)>=0?D.teal:D.rose}].map(s=>(
            <div key={s.l} style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:16,padding:"14px 12px",textAlign:"center" as const}}>
              <div style={{fontSize:10,color:D.t2,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8}}>{s.l}</div>
              <div style={{fontSize:15,fontWeight:900,color:s.c,fontVariantNumeric:"tabular-nums"}}>{money(s.v,S,true)}</div>
            </div>
          ))}
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
        <div style={{background:D.amberDim,border:`1px solid ${D.amber}33`,borderRadius:16,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:D.amber,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Company Cut</div>
            <div style={{fontSize:12,color:D.t2}}>Your share of income, minus what you covered</div>
          </div>
          <div style={{fontSize:22,fontWeight:900,color:D.amber,fontVariantNumeric:"tabular-nums"}}>{money(myCut,S,true)}</div>
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

        {/* List */}
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,overflow:"hidden"}}>
          {view==="monthly"?(
            perMonthly.length>0
              ?<div style={{padding:"0 18px"}}>{perMonthly.map(m=><MonthlyRow key={m.id} m={m} onDel={()=>delMonthly(m.id)} onToggle={()=>toggleMonthly(m.id)}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No monthly expenses. Add rent, family support, subscriptions, or friend loans.</div>
          ):view==="daily"?(
            daily.length>0
              ?<div style={{padding:"0 18px"}}>{daily.map(tx=><TxRow key={tx.id} tx={tx} onDel={()=>delTx(tx.id)}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No daily expenses yet. Start tracking food, transport, shopping…</div>
          ):(
            income.length>0
              ?<div style={{padding:"0 18px"}}>{income.map(tx=><TxRow key={tx.id} tx={tx} onDel={()=>delTx(tx.id)}/>)}</div>
              :<div style={{padding:"48px 20px",textAlign:"center" as const,color:D.t2}}>No personal income recorded.</div>
          )}
        </div>
      </div>
    );
  };

  // ── DEBTS ──────────────────────────────────────────────────────
  const DebtsTab=()=>(
    <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
      <div>
        <div style={{fontSize:26,fontWeight:900,color:D.t1,letterSpacing:"-0.03em",marginBottom:4}}>Debts</div>
        <div style={{fontSize:13,color:D.t2}}>{debts.length} debts tracked</div>
      </div>

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
        const due=daysUntil(debt.dueDate);
        const dueBadge=due!==null?(due<0?{l:"Overdue",c:D.rose}:due<=7?{l:`${due}d left`,c:D.amber}:{l:`${due}d left`,c:D.teal}):null;
        return(
          <div key={debt.id} style={{background:D.s2,border:`1px solid ${left===0?D.teal+"44":D.b1}`,borderRadius:20,overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"18px 18px 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,marginRight:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <div style={{width:36,height:36,borderRadius:11,background:D.indigoDim,border:`1px solid ${D.indigo}33`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <G d={IC.bank} s={16} c={D.indigo}/>
                    </div>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,color:D.t1}}>{debt.personBank}</div>
                      <div style={{fontSize:12,color:D.t2}}>{debt.description}</div>
                    </div>
                  </div>
                  {dueBadge&&<Badge label={dueBadge.l} color={dueBadge.c}/>}
                  {debt.dueDate&&<span style={{fontSize:11,color:D.t3,marginLeft:8}}>Due {debt.dueDate}</span>}
                </div>
                <button onClick={()=>delDebt(debt.id)} style={{background:"none",border:"none",cursor:"pointer",color:D.t3}}><G d={IC.trash} s={15}/></button>
              </div>
              <div style={{display:"flex",gap:20,marginBottom:16,marginTop:12}}>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Total</div><div style={{fontSize:16,fontWeight:800,color:D.t1,fontVariantNumeric:"tabular-nums"}}>{money(debt.totalAmount,ds)}</div></div>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Paid</div><div style={{fontSize:16,fontWeight:800,color:D.teal,fontVariantNumeric:"tabular-nums"}}>{money(paid,ds)}</div></div>
                <div><div style={{fontSize:10,color:D.t3,marginBottom:3,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>Remaining</div><div style={{fontSize:16,fontWeight:800,color:left>0?D.rose:D.teal,fontVariantNumeric:"tabular-nums"}}>{money(left,ds)}</div></div>
              </div>
              <Prog val={pct} col={pct>=100?D.teal:D.indigo} h={5}/>
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
                ?<button onClick={()=>openSheet("pay_debt",debt)} style={{width:"100%",padding:"13px",background:D.tealDim,border:`1px solid ${D.teal}44`,borderRadius:14,color:D.teal,fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
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
    const [cur,setCur]=useState(settings.currency);
    const [saved,setSaved]=useState(false);
    const [newPw,setNewPw]=useState("");
    const [pwBusy,setPwBusy]=useState(false);
    const [pwMsg,setPwMsg]=useState<{ok:boolean;text:string}|null>(null);
    const save=async()=>{
      const next={currency:cur,name};
      setSettings(next);
      setSaved(true);setTimeout(()=>setSaved(false),2500);
      try{await db.upsertSettings(userId,next);}catch(err){console.error(err);window.alert("Couldn't save settings. Please try again.");}
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
        ]);
        setTxs([]);setMonthly([]);setDebts([]);
      }catch(err){console.error(err);window.alert("Couldn't delete everything. Please try again.");}
    };
    return(
      <div style={{padding:"22px 16px",display:"flex",flexDirection:"column",gap:20}}>
        <div>
          <div style={{fontSize:26,fontWeight:900,color:D.t1,letterSpacing:"-0.03em",marginBottom:4}}>Settings</div>
          <div style={{fontSize:13,color:D.t2}}>Configure your Finance OS</div>
        </div>
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20,display:"flex",flexDirection:"column",gap:16}}>
          <Inp label="Your Name" val={name} onChange={setName} placeholder="Ahmad"/>
          <Sel label="Default Currency" val={cur} onChange={setCur} opts={CURRENCIES.map(c=>({v:c.code,l:`${c.code} (${c.symbol}) — ${c.name}`}))}/>
          <div style={{padding:"14px 16px",background:D.amberDim,border:`1px solid ${D.amber}33`,borderRadius:14}}>
            <div style={{fontSize:13,color:D.amber,lineHeight:1.6}}>
              Your Company Cut is no longer a fixed %. Set how much of each transaction is yours right when you add company income or an expense you covered.
            </div>
          </div>
        </div>
        <button onClick={save} style={{padding:"15px",background:saved?D.tealDim:D.indigo,border:saved?`1px solid ${D.teal}`:"none",borderRadius:12,color:saved?D.teal:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"opacity .15s",fontFamily:"inherit"}}>
          {saved?<><G d={IC.check} s={16} c={D.teal}/>Saved!</>:"Save Settings"}
        </button>
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20}}>
          <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:16}}>Your Data</div>
          {[{l:"Transactions",v:txs.length},{l:"Monthly Expenses",v:monthly.length},{l:"Debts",v:debts.length}].map(row=>(
            <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${D.b0}`}}>
              <span style={{fontSize:13,color:D.t2}}>{row.l}</span>
              <span style={{fontSize:14,fontWeight:700,color:D.t1}}>{row.v}</span>
            </div>
          ))}
          <button onClick={clearAllData}
            style={{width:"100%",padding:"13px",background:D.roseDim,border:`1px solid ${D.rose}44`,borderRadius:14,color:D.rose,fontSize:13,fontWeight:700,cursor:"pointer",marginTop:16,fontFamily:"inherit"}}>
            Clear All Data
          </button>
        </div>
        <div style={{background:D.s2,border:`1px solid ${D.b1}`,borderRadius:20,padding:20,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontSize:11,color:D.t2,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Change Password</div>
          <Inp label="New Password" type="password" val={newPw} onChange={setNewPw} placeholder="At least 6 characters"/>
          {pwMsg&&<div style={{fontSize:13,color:pwMsg.ok?D.teal:D.rose,background:pwMsg.ok?D.tealDim:D.roseDim,border:`1px solid ${pwMsg.ok?D.teal:D.rose}33`,borderRadius:12,padding:"10px 14px"}}>{pwMsg.text}</div>}
          <GhostBtn label={pwBusy?"Updating…":"Update Password"} onClick={changePassword}/>
        </div>
        <button onClick={onSignOut} style={{width:"100%",padding:"15px",background:"transparent",border:`1px solid ${D.b1}`,borderRadius:12,color:D.t2,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          Sign Out
        </button>
        <div style={{textAlign:"center" as const,fontSize:12,color:D.t3,paddingBottom:12}}>Finance OS · Synced to your account</div>
      </div>
    );
  };

  // ── BOTTOM NAV ─────────────────────────────────────────────────
  const navItems=[
    {id:"home",l:"Home",icon:IC.home,c:D.indigo},
    {id:"company",l:"Company",icon:IC.company,c:D.teal},
    {id:"personal",l:"Personal",icon:IC.personal,c:D.violet},
    {id:"debts",l:"Debts",icon:IC.debt,c:D.rose},
    {id:"settings",l:"Settings",icon:IC.cog,c:D.t2},
  ];

  // ── SHEETS ─────────────────────────────────────────────────────
  const sheetConfig:{[k:string]:{title:string;tall?:boolean}}={
    company_in:{title:"Add Company Revenue"},company_out:{title:"Add Company Expense"},
    company_monthly:{title:"Add Monthly Company Cost"},personal_in:{title:"Add Personal Income"},
    personal_out:{title:"Add Daily Expense"},personal_monthly:{title:"Add Monthly Personal Expense"},
    add_debt:{title:"Add Debt / Loan",tall:true},pay_debt:{title:`Pay — ${sheet.debt?.personBank||""}`},
  };

  const sheetBody=()=>{
    const k=sheet.key;
    if(!sheet.open)return null;
    if(k==="add_debt")return<AddDebtForm onAdd={addDebt} onClose={closeSheet} defCur={settings.currency}/>;
    if(k==="pay_debt"&&sheet.debt)return<PayForm debt={sheet.debt} onPay={(n,note,date)=>payDebt(sheet.debt!.id,n,note,date)} onClose={closeSheet}/>;
    if(k==="company_monthly")return<AddMonthlyForm scope="company" onAdd={addMonthly} onClose={closeSheet} defCur={settings.currency}/>;
    if(k==="personal_monthly")return<AddMonthlyForm scope="personal" onAdd={addMonthly} onClose={closeSheet} defCur={settings.currency}/>;
    if(["company_in","company_out","personal_in","personal_out"].includes(k))return<AddTxForm type={k as TxType} onAdd={addTx} onClose={closeSheet} defCur={settings.currency}/>;
    return null;
  };

  const cfg=sheetConfig[sheet.key];

  return(
    <div className={font.className} style={{background:D.bg,minHeight:"100vh",maxWidth:480,margin:"0 auto",color:D.t1}}>
      <div style={{paddingBottom:88}}>
        {tab==="home"&&<HomeTab/>}
        {tab==="company"&&<CompanyTab/>}
        {tab==="personal"&&<PersonalTab/>}
        {tab==="debts"&&<DebtsTab/>}
        {tab==="settings"&&<SettingsTab/>}
      </div>

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
    </div>
  );
}

// ── AUTH ───────────────────────────────────────────────────────────────────────
const LoginScreen=()=>{
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const ok=!!email&&!!password;

  const submit=async()=>{
    if(!ok||busy)return;
    setBusy(true);setError("");
    try{
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
          <div style={{width:56,height:56,borderRadius:16,background:D.indigo,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <G d={IC.trend} s={26} c="#fff"/>
          </div>
          <div style={{fontSize:22,fontWeight:800,letterSpacing:"-0.02em"}}>Finance OS</div>
          <div style={{fontSize:13,color:D.t2,marginTop:4}}>Sign in to your account</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Inp label="Email" type="email" val={email} onChange={setEmail} placeholder="you@example.com" autoFocus/>
          <Inp label="Password" type="password" val={password} onChange={setPassword} placeholder="Your password"/>
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

  if(session===undefined)return<div style={{background:D.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:D.t2}}>Loading…</div></div>;
  if(!session)return<LoginScreen/>;
  return<FinanceApp userId={session.user.id} onSignOut={()=>supabase.auth.signOut()}/>;
}
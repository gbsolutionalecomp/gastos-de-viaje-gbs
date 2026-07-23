'use client'

import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'

type Tarjeta = { id:string; alias:string; emisor:string; ultimos4:string; titular:string; activa:boolean }
type Sesion = { id:string; tarjetaId:string; nombre:string; inicio:string; fin:string; totalEstadoCuenta:number; estado:'abierta'|'conciliada' }
type Tx = { id:string; sesionId:string; fecha:string; comercio:string; monto:number; moneda:string; referencia:string; uuid?:string; rfc?:string; xmlNombre?:string }
const nid=()=>crypto.randomUUID(), money=(n:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0)
const storageKey=(empresaId:string)=>`gbs:tarjetas-sesiones:v1:${empresaId}`

async function leerCfdi(file:File){
  const doc=new DOMParser().parseFromString(await file.text(),'application/xml')
  if(doc.querySelector('parsererror')) throw new Error('El XML no tiene un formato válido.')
  const nodes=Array.from(doc.getElementsByTagName('*')), timbre=nodes.find(n=>n.localName==='TimbreFiscalDigital'), emisor=nodes.find(n=>n.localName==='Emisor')
  const uuid=timbre?.getAttribute('UUID')||'', rfc=emisor?.getAttribute('Rfc')||emisor?.getAttribute('RFC')||''
  if(!uuid||!rfc) throw new Error('El archivo no contiene UUID y RFC de emisor de un CFDI timbrado.')
  return {uuid:uuid.toUpperCase(),rfc:rfc.toUpperCase()}
}

export default function TarjetasSesiones({empresaId}:{empresaId:string}){
  const [tarjetas,setTarjetas]=useState<Tarjeta[]>([]),[sesiones,setSesiones]=useState<Sesion[]>([]),[txs,setTxs]=useState<Tx[]>([])
  const [tarjetaId,setTarjetaId]=useState(''),[sesionId,setSesionId]=useState(''),[aviso,setAviso]=useState('')
  const [alias,setAlias]=useState(''),[titular,setTitular]=useState(''),[ultimos4,setUltimos4]=useState('')
  const [nombre,setNombre]=useState(''),[inicio,setInicio]=useState(''),[fin,setFin]=useState(''),[total,setTotal]=useState('')
  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(storageKey(empresaId))||'{}');setTarjetas(x.tarjetas||[]);setSesiones(x.sesiones||[]);setTxs(x.txs||[])}catch{}},[empresaId])
  useEffect(()=>{if(empresaId)localStorage.setItem(storageKey(empresaId),JSON.stringify({tarjetas,sesiones,txs}))},[empresaId,tarjetas,sesiones,txs])
  useEffect(()=>{if(!tarjetaId&&tarjetas[0])setTarjetaId(tarjetas[0].id)},[tarjetas,tarjetaId])
  useEffect(()=>{const a=sesiones.filter(s=>s.tarjetaId===tarjetaId);if(!a.some(s=>s.id===sesionId))setSesionId(a[0]?.id||'')},[tarjetaId,sesiones,sesionId])
  const cortes=sesiones.filter(s=>s.tarjetaId===tarjetaId), movs=txs.filter(t=>t.sesionId===sesionId), sesion=sesiones.find(s=>s.id===sesionId)
  const suma=useMemo(()=>movs.reduce((a,t)=>a+t.monto,0),[movs])
  const crearTarjeta=()=>{if(!alias.trim()||!titular.trim()||!/^[0-9]{4}$/.test(ultimos4)){setAviso('Captura alias, titular y últimos 4 dígitos.');return}const t={id:nid(),alias:alias.trim(),emisor:'AMEX',ultimos4,titular:titular.trim(),activa:true};setTarjetas(v=>[...v,t]);setTarjetaId(t.id);setAlias('');setTitular('');setUltimos4('');setAviso('Tarjeta creada.')}
  const crearSesion=()=>{if(!tarjetaId||!nombre.trim()||!inicio||!fin){setAviso('Selecciona tarjeta, nombre y periodo.');return}const s:Sesion={id:nid(),tarjetaId,nombre:nombre.trim(),inicio,fin,totalEstadoCuenta:Number(total)||0,estado:'abierta'};setSesiones(v=>[...v,s]);setSesionId(s.id);setNombre('');setTotal('');setAviso('Sesión creada.')}
  const importar=(file?:File)=>{if(!file||!sesionId)return;Papa.parse(file,{header:true,skipEmptyLines:true,complete:r=>{const rows=(r.data as Record<string,string>[]).map(x=>({id:nid(),sesionId,fecha:x.fecha||x.Fecha||'',comercio:x.comercio||x.Comercio||x.descripcion||x.Descripcion||'',monto:Number((x.monto||x.Monto||x.total||x.Total||'0').replace(/[$,]/g,'')),moneda:x.moneda||x.Moneda||'MXN',referencia:x.referencia||x.Referencia||''})).filter(x=>x.fecha&&x.comercio&&Number.isFinite(x.monto));setTxs(v=>[...v,...rows]);setAviso(`${rows.length} transacciones importadas.`)}})}
  const adjuntar=async(t:Tx,file?:File)=>{if(!file)return;try{const x=await leerCfdi(file);if(txs.some(o=>o.id!==t.id&&o.uuid===x.uuid))throw new Error('Ese UUID ya está ligado a otra transacción.');setTxs(v=>v.map(o=>o.id===t.id?{...o,...x,xmlNombre:file.name}:o));setAviso('CFDI ligado y validado.')}catch(e){setAviso(e instanceof Error?e.message:'No se pudo leer el XML.')}}
  const cerrar=()=>{if(!sesion)return;if(Math.abs(suma-sesion.totalEstadoCuenta)>.01){setAviso('No puede conciliarse: la suma no coincide con el estado de cuenta.');return}setSesiones(v=>v.map(s=>s.id===sesion.id?{...s,estado:'conciliada'}:s));setAviso('Sesión conciliada.')}
  const box={background:'#fff',border:'1px solid #D9DDED',borderRadius:10,padding:16,marginBottom:14} as const,input={padding:'8px 10px',border:'1px solid #C9CEE2',borderRadius:6,minWidth:150} as const
  return <div style={{padding:24,maxWidth:1200,margin:'0 auto'}}><h2 style={{marginTop:0}}>Tarjetas y sesiones de operación</h2><p style={{color:'#54606B'}}>Cada corte pertenece a una sola tarjeta. Aquí se concentran transacciones y CFDI; no existe conexión con Microsip.</p>{aviso&&<div style={{...box,background:'#EEF3FF',color:'#25358A'}}>{aviso}</div>}
    <section style={box}><h3>1. Tarjetas corporativas</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input style={input} value={alias} onChange={e=>setAlias(e.target.value)} placeholder="Alias: AMEX Alejandro"/><input style={input} value={titular} onChange={e=>setTitular(e.target.value)} placeholder="Titular"/><input style={input} maxLength={4} value={ultimos4} onChange={e=>setUltimos4(e.target.value.replace(/\D/g,''))} placeholder="Últimos 4"/><button onClick={crearTarjeta}>Agregar tarjeta</button></div><select style={{...input,marginTop:12}} value={tarjetaId} onChange={e=>setTarjetaId(e.target.value)}><option value="">Selecciona tarjeta</option>{tarjetas.map(t=><option key={t.id} value={t.id}>{t.alias} · •••• {t.ultimos4} · {t.titular}</option>)}</select></section>
    <section style={box}><h3>2. Sesiones / cortes</h3><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input style={input} value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Julio 2026"/><input style={input} type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/><input style={input} type="date" value={fin} onChange={e=>setFin(e.target.value)}/><input style={input} value={total} onChange={e=>setTotal(e.target.value)} placeholder="Total estado de cuenta"/><button onClick={crearSesion}>Crear sesión</button></div><select style={{...input,marginTop:12}} value={sesionId} onChange={e=>setSesionId(e.target.value)}><option value="">Selecciona sesión</option>{cortes.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.estado}</option>)}</select></section>
    <section style={box}><h3>3. Transacciones y CFDI</h3>{sesionId?<><label>Importar CSV de Clara (fecha, comercio, monto, moneda, referencia): <input type="file" accept=".csv,text/csv" onChange={e=>importar(e.target.files?.[0])}/></label><div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Fecha','Comercio','Monto','Referencia','CFDI XML'].map(h=><th key={h} style={{textAlign:'left',padding:8,borderBottom:'1px solid #ddd'}}>{h}</th>)}</tr></thead><tbody>{movs.map(t=><tr key={t.id}><td style={{padding:8}}>{t.fecha}</td><td>{t.comercio}</td><td>{money(t.monto)}</td><td>{t.referencia||'—'}</td><td>{t.uuid?<span title={t.uuid}>✓ {t.rfc}</span>:<input type="file" accept=".xml,text/xml,application/xml" onChange={e=>adjuntar(t,e.target.files?.[0])}/>}</td></tr>)}</tbody></table></div><p><b>Total importado:</b> {money(suma)} · <b>Estado de cuenta:</b> {money(sesion?.totalEstadoCuenta||0)} · <b>Diferencia:</b> {money((sesion?.totalEstadoCuenta||0)-suma)}</p><button disabled={sesion?.estado==='conciliada'} onClick={cerrar}>Conciliar y cerrar sesión</button></>:<p>Crea o selecciona una sesión.</p>}</section>
  </div>
}

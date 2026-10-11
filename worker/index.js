// Animal Fighter on Cloudflare: the game is served as static assets (wrangler.jsonc); this Worker only answers
// /api/net (signaling path + ICE servers for the client) and /peerjs/:room/... (a PeerJS 1.5.5 compatible
// signaling server, one Durable Object per room). Match traffic never comes here: it is browser to browser.
import { DurableObject } from 'cloudflare:workers';

const ROOM=/^[A-Z2-9]{6}$/;                                  // same alphabet as the codes net/network.js creates
const PEER_ID=/^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/;        // PeerJS's own validateId
const TOKEN=/^[A-Za-z0-9]{1,32}$/;
const MAX_SOCKETS=12;                                        // host + 3 guests, with room for reconnects and refused guests
const MAX_MESSAGE=65536;                                     // an SDP offer is ~1-3 KB; anything bigger is not PeerJS
const MAX_EXPIRED=32;
const HEARTBEAT='{"type":"HEARTBEAT"}';                      // exact text PeerJS sends every 5 s
const RELAYED=new Set(['OFFER','ANSWER','CANDIDATE']);       // all a PeerJS client ever sends; relaying ERROR/ID-TAKEN/LEAVE would let a guest knock the host offline

// Without Cloudflare TURN: its free STUN plus the public PeerJS TURN, so it is never worse than the PeerJS defaults.
const FALLBACK_ICE=[
 { urls:'stun:stun.cloudflare.com:3478' },
 { urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'], username:'peerjs', credential:'peerjsp' },
];
// Firefox slows ICE down with 5+ URLs, so keep one of each kind (UDP, TCP, TLS on 443 for strict firewalls).
const CF_URLS=['stun:stun.cloudflare.com:3478','turn:turn.cloudflare.com:3478?transport=udp',
 'turn:turn.cloudflare.com:3478?transport=tcp','turns:turn.cloudflare.com:443?transport=tcp'];

const text=(body,status=200,headers={})=>new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store',...headers}});
const randomId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('');

// Only pages of this same site get TURN credentials (they cost money when relayed); others still get a working list.
function sameSite(request,url){
 const from=request.headers.get('Origin')||request.headers.get('Referer');
 try{return !!from&&new URL(from).host===url.host;}catch{return false;}
}

async function cloudflareIce(env){
 const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,{
  method:'POST',headers:{Authorization:`Bearer ${env.TURN_KEY_API_TOKEN}`,'Content-Type':'application/json'},
  body:JSON.stringify({ttl:14400}),signal:AbortSignal.timeout(2000)});    // the client gives up on /api/net after 3 s
 if(r.status!==201)return null;
 const body=await r.json();
 const out=[];let urls=0,relay=false;
 for(const s of [].concat(body?.iceServers||[])){                          // older endpoint: one object, not an array
  if(!s||typeof s!=='object')continue;
  const keep=[].concat(s.urls||[]).filter(u=>typeof u==='string'&&CF_URLS.includes(u)&&!/:53(?:[?/]|$)/.test(u)).slice(0,4-urls);
  if(!keep.length)continue;
  urls+=keep.length;relay||=keep.some(u=>u.startsWith('turn'))&&typeof s.username==='string'&&typeof s.credential==='string';
  out.push(s.username?{urls:keep,username:s.username,credential:s.credential}:{urls:keep});
 }
 return relay?out:null;
}

async function netConfig(request,url,env){
 let iceServers=null;
 if(env.TURN_KEY_ID&&env.TURN_KEY_API_TOKEN&&sameSite(request,url)){
  try{iceServers=await cloudflareIce(env);}catch(e){console.warn('TURN credentials failed:',e?.message||e);}
 }
 return Response.json({v:1,signal:'/peerjs/',iceServers:iceServers||FALLBACK_ICE},{headers:{'Cache-Control':'no-store'}});
}

export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='GET'){
   if(path==='/api/net')return netConfig(request,url,env);
   // PeerJS with path '/peerjs/CODE/' asks for '/peerjs/CODE/peerjs/id' (key 'peerjs') and opens '/peerjs/CODE/peerjs?...'.
   const m=/^\/peerjs\/([^/]+)\/peerjs(\/id)?$/.exec(path);
   if(m){
    if(!ROOM.test(m[1]))return text('Invalid room code',400);
    if(m[2])return text(randomId());
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return text('Expected a WebSocket upgrade',426,{Upgrade:'websocket'});
    const ns=env.SIGNAL;
    return (ns.getByName?ns.getByName(m[1]):ns.get(ns.idFromName(m[1]))).fetch(request);
   }
  }
  if(/^\/(?:api|peerjs)(?:\/|$)/.test(path))return text('Not found',404);
  return env.ASSETS.fetch(request);
 },
};

// One room: the PeerJS signaling exchange (OFFER/ANSWER/CANDIDATE) between its host and guests. Uses the
// WebSocket Hibernation API and no timers, so an idle room costs nothing; heartbeats are answered by the runtime.
export class SignalRoom extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT,HEARTBEAT));
 }
 // Refused sockets get no tag and no attachment, and are CLOSING at once, so live() never counts them. (With the
 // plain accept() API workerd logs "Network connection lost" when the client hangs up after the Close frame.)
 refuse(server,client,type,msg){
  this.ctx.acceptWebSocket(server);
  server.send(JSON.stringify({type,payload:{msg}}));
  server.close(1000,msg);
  return new Response(null,{status:101,webSocket:client});
 }
 live(tag){return this.ctx.getWebSockets(tag).filter(ws=>ws.readyState===1);}   // the list can still hold CLOSING sockets
 async fetch(request){
  const q=new URL(request.url).searchParams,id=q.get('id')||'',token=q.get('token')||'';
  const [client,server]=Object.values(new WebSocketPair());
  if(id.length>64||!PEER_ID.test(id))return this.refuse(server,client,'ERROR','Invalid id');
  if(!TOKEN.test(token))return this.refuse(server,client,'ERROR','Invalid token');
  const same=this.live(id);
  if(same.some(ws=>ws.deserializeAttachment()?.token!==token))return this.refuse(server,client,'ID-TAKEN','ID is taken');
  if(this.live().length-same.length>=MAX_SOCKETS)return this.refuse(server,client,'ERROR','Room is full');
  // Same id and token is the same Peer reconnecting (peer.reconnect()): the new socket replaces the old one.
  for(const old of same){try{old.close(1000,'Replaced by a new connection');}catch{}}
  this.ctx.acceptWebSocket(server,[id]);
  server.serializeAttachment({id,token,expired:[]});
  server.send('{"type":"OPEN"}');
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,message){
  if(typeof message!=='string'||message.length>MAX_MESSAGE)return;
  let m;try{m=JSON.parse(message);}catch{return;}
  if(!m||typeof m!=='object'||!RELAYED.has(m.type)||typeof m.dst!=='string')return;
  const me=ws.deserializeAttachment();if(!me)return;
  // PeerJS routes by src, so it is always the sender's registered id, never what the client claims.
  const out=JSON.stringify({type:m.type,src:me.id,dst:m.dst,payload:m.payload});
  let sent=false;
  if(m.dst.length<=64)for(const peer of this.live(m.dst)){try{peer.send(out);sent=true;}catch{}}
  // Unknown peer: one EXPIRE per pair (PeerJS raises 'peer-unavailable' for each, and every trickled CANDIDATE would repeat it).
  if(!sent&&!me.expired.includes(m.dst)){
   me.expired.push(m.dst);if(me.expired.length>MAX_EXPIRED)me.expired.shift();
   ws.serializeAttachment(me);
   ws.send(JSON.stringify({type:'EXPIRE',src:m.dst,dst:me.id}));
  }
 }
 // Never broadcast LEAVE: PeerJS would close live P2P links, and a match must survive a signaling drop.
 // Reply to the peer's Close frame. Compatibility dates >= 2026-04-07 are documented to do it automatically, but local
 // workerd 1.20260925 still hands hibernated sockets over in CLOSING and the client only gives up after a timeout
 // (1006); closing an already closed socket is a documented no-op. 1005/1006 cannot be sent, hence the bare close().
 async webSocketClose(ws,code,reason){try{ws.close(code,reason);}catch{try{ws.close();}catch{}}}
 async webSocketError(){}
}

// Loopback-only native tracker and protocol fault injection for browser E2E.
import http from 'node:http';
import {pathToFileURL} from 'node:url';
const {default:Server} = await import(pathToFileURL(process.argv[2]));
const tracker = new Server({http:false,udp:false,ws:true,stats:false,interval:5000});
const sockets = new Set(), messages = [], faults = new Map();
const nativeRequest = tracker._onWebSocketRequest;
tracker._onWebSocketRequest = function(socket, options, wire) {
    const data = JSON.parse(wire), room = Buffer.from(data.info_hash || '', 'latin1').toString('hex');
    messages.push({room,peerId:Buffer.from(data.peer_id || '', 'latin1').toString('hex'),event:data.event,keys:Object.keys(data),offers:data.offers?.length});
    if (faults.get(room) === 'silent') return;
    if (faults.get(room) === 'malformed') {
        socket.send(JSON.stringify({action:'announce',info_hash:data.info_hash,complete:-1,incomplete:'invalid'}));
        return;
    }
    nativeRequest.call(this,socket,options,wire);
};
tracker.ws.on('connection', socket => { sockets.add(socket); socket.once('close',()=>sockets.delete(socket)); });
tracker.on('warning',()=>{});
const control = http.createServer(async (request,response) => {
    let text = ''; for await (const chunk of request) text += chunk;
    const data = text ? JSON.parse(text) : {};
    if (request.url === '/fault') faults.set(data.room,data.mode);
    if (request.url === '/close') for (const socket of sockets) if (socket.peerId === data.peerId) socket.close(1012,'synthetic restart');
    response.setHeader('Content-Type','application/json');
    response.end(JSON.stringify({messages,sockets:sockets.size}));
});
await new Promise(resolve=>tracker.listen(0,'127.0.0.1',resolve));
await new Promise(resolve=>control.listen(0,'127.0.0.1',resolve));
console.log(JSON.stringify({trackerUrl:'ws://127.0.0.1:'+tracker.http.address().port,controlUrl:'http://127.0.0.1:'+control.address().port}));

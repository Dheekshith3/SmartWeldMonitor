const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { User, Machine, Alert, Maintenance } = require('./models');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors()); app.use(express.json());
const JWT_SECRET = process.env.JWT_SECRET || 'smartweld-demo-secret';

const initialUsers = [
  ['Admin', 'admin@smartweld.com', 'ADMIN', 'Admin@123'],
  ['Manager', 'manager@smartweld.com', 'MANAGER', 'Manager@123'],
  ['Supervisor', 'supervisor@smartweld.com', 'SUPERVISOR', 'Supervisor@123'],
  ['Operator', 'operator@smartweld.com', 'OPERATOR', 'Operator@123'],
  ['Maintenance', 'maintenance@smartweld.com', 'MAINTENANCE', 'Maintenance@123']
].map(([name, email, role, password]) => ({ name, email, role, password }));
const initialMachines = [
  { id:'WELD-001', name:'ArcMaster Alpha', model:'AM-4000', location:'Cell A · Bay 01', status:'RUNNING', health:94, temperature:72, vibration:2.8, current:186, voltage:23.4, production:248, good:242, defects:6, downtime:18, assigned:'operator@smartweld.com' },
  { id:'WELD-002', name:'Precision Weld 2', model:'PW-220', location:'Cell A · Bay 02', status:'RUNNING', health:81, temperature:84, vibration:4.9, current:214, voltage:25.2, production:221, good:213, defects:8, downtime:42, assigned:'operator@smartweld.com' },
  { id:'WELD-003', name:'Robotic Cell 3', model:'RC-900', location:'Cell B · Bay 01', status:'WARNING', health:63, temperature:94, vibration:7.7, current:241, voltage:28.1, production:198, good:185, defects:13, downtime:76, assigned:'operator@smartweld.com' },
  { id:'WELD-004', name:'HeavyArc Four', model:'HA-700', location:'Cell B · Bay 02', status:'MAINTENANCE', health:38, temperature:61, vibration:8.9, current:119, voltage:16.8, production:164, good:157, defects:7, downtime:214, assigned:'maintenance@smartweld.com' },
  { id:'WELD-005', name:'FlexWeld 5', model:'FX-180', location:'Cell C · Bay 01', status:'IDLE', health:88, temperature:68, vibration:2.1, current:102, voltage:19.7, production:187, good:182, defects:5, downtime:31, assigned:'operator@smartweld.com' },
  { id:'WELD-006', name:'MicroArc Six', model:'MA-120', location:'Cell C · Bay 02', status:'RUNNING', health:91, temperature:76, vibration:3.4, current:174, voltage:22.8, production:232, good:228, defects:4, downtime:25, assigned:'operator@smartweld.com' }
];
let machines = initialMachines;
let riskMode = false;
const initialAlerts = [
  { id:'ALT-1042', machine:'WELD-003', type:'High Temperature', severity:'CRITICAL', message:'Temperature is above the configured 90 °C threshold.', status:'ACTIVE', time:'2 min ago' },
  { id:'ALT-1041', machine:'WELD-004', type:'High Vibration', severity:'WARNING', message:'Vibration trend suggests bearing inspection.', status:'ACKNOWLEDGED', time:'18 min ago' },
  { id:'ALT-1039', machine:'WELD-002', type:'Quality Defect Spike', severity:'WARNING', message:'Defect rate crossed the 3% operating limit.', status:'ACTIVE', time:'34 min ago' },
  { id:'ALT-1036', machine:'WELD-001', type:'Maintenance Due', severity:'INFO', message:'Preventive inspection is due in 3 days.', status:'ACTIVE', time:'1 hr ago' }
];
let alerts = initialAlerts;
const initialMaintenance = [
  { id:'MNT-208', machine:'WELD-004', type:'Corrective', priority:'HIGH', description:'Inspect torch alignment and spindle bearings.', technician:'Maintenance', status:'In Progress', scheduled:'Today, 14:30' },
  { id:'MNT-207', machine:'WELD-001', type:'Preventive', priority:'MEDIUM', description:'Quarterly torch and cable inspection.', technician:'Maintenance', status:'Scheduled', scheduled:'Sep 21, 09:00' },
  { id:'MNT-206', machine:'WELD-002', type:'Inspection', priority:'LOW', description:'Review quality trend and current calibration.', technician:'Maintenance', status:'Pending', scheduled:'Sep 24, 11:00' }
];
let maintenance = initialMaintenance;
const history = machines.map(machine => Array.from({length: 12}, (_, i) => ({ time:`-${(11-i)*5}m`, temperature:Math.round(machine.temperature - 8 + i * .7), vibration:Number((machine.vibration - .7 + i * .1).toFixed(1)), current:Math.round(machine.current - 12 + i * 1.4), voltage:Number((machine.voltage - 1 + i * .15).toFixed(1)) })));
async function seedCollection(Model, records) { if (await Model.countDocuments() === 0) await Model.insertMany(records); }
async function initializeDatabase() {
  let mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartweld';

  if (!process.env.MONGODB_URI) {
    try {
      await mongoose.connect(mongoUri);
    } catch (error) {
      const memoryServer = await MongoMemoryServer.create();
      mongoUri = memoryServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('MongoDB not found locally; using in-memory MongoDB for demo mode.');
    }
  } else {
    await mongoose.connect(mongoUri);
  }

  if (await User.countDocuments() === 0) {
    await User.insertMany(await Promise.all(initialUsers.map(async user => ({
      name: user.name,
      email: user.email,
      role: user.role,
      passwordHash: await bcrypt.hash(user.password, 10)
    }))));
  }
  await seedCollection(Machine, initialMachines);
  await seedCollection(Alert, initialAlerts);
  await seedCollection(Maintenance, initialMaintenance);
  [machines, alerts, maintenance] = await Promise.all([
    Machine.find({}, { _id: 0, __v: 0 }).lean(),
    Alert.find({}, { _id: 0, __v: 0 }).lean(),
    Maintenance.find({}, { _id: 0, __v: 0 }).lean()
  ]);
  riskMode = alerts.some(alert => alert.id === 'ALT-DEMO');
}
async function saveMachines() {
  await Machine.bulkWrite(machines.map(({ id, ...fields }) => ({
    updateOne: { filter: { id }, update: { $set: fields } }
  })));
}
async function saveAlerts() {
  await Alert.deleteMany({ id: { $nin: alerts.map(alert => alert.id) } });
  await Alert.bulkWrite(alerts.map(({ id, ...fields }) => ({
    updateOne: { filter: { id }, update: { $set: fields } }, upsert: true
  })));
}
function totals() { const total = machines.reduce((sum,m)=>sum+m.production,0); const good = machines.reduce((sum,m)=>sum+m.good,0); const defects = machines.reduce((sum,m)=>sum+m.defects,0); const running=machines.filter(m=>m.status==='RUNNING').length; const availability=91.7, performance=94.8, quality=good/total*100; return { total, good, defects, running, availability, performance, quality, oee:availability*performance*quality/10000, defectRate:defects/total*100 }; }
function auth(req,res,next){ const token=(req.headers.authorization||'').replace('Bearer ',''); try { req.user=jwt.verify(token,JWT_SECRET); next(); } catch { res.status(401).json({error:'Authentication required'}); } }
function allow(...roles){ return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'This role cannot access that resource.'}); }
app.post('/api/auth/login',async (req,res)=>{ const user=await User.findOne({email:req.body.email}); if(!user||!await bcrypt.compare(req.body.password,user.passwordHash))return res.status(401).json({error:'Invalid demo credentials'}); const payload={id:user.id,name:user.name,email:user.email,role:user.role}; res.json({token:jwt.sign(payload,JWT_SECRET,{expiresIn:'8h'}),user:payload}); });
app.get('/api/overview',auth,(req,res)=>res.json({machines,alerts,maintenance,stats:totals(),simulator:!riskMode, limitation:'Prototype uses simulated sensor data. Physical robotic welding machine integration is not included in the current version.'}));
app.get('/api/machines',auth,(req,res)=>res.json(machines));
app.get('/api/machines/:id/history',auth,(req,res)=>res.json(history[machines.findIndex(m=>m.id===req.params.id)]||[]));
app.get('/api/alerts',auth,(req,res)=>res.json(alerts)); app.get('/api/maintenance',auth,(req,res)=>res.json(maintenance));
app.get('/api/reports',auth,(req,res)=>res.json({stats:totals(),production:machines.map(m=>({machine:m.id,produced:m.production,good:m.good,defects:m.defects}))}));
app.post('/api/demo/risk',auth,allow('ADMIN','MANAGER','SUPERVISOR'),async (req,res)=>{ riskMode=true; const machine=machines[2]; machine.status='WARNING'; machine.health=42; machine.temperature=103; machine.vibration=9.4; machine.current=255; if(!alerts.find(a=>a.id==='ALT-DEMO'))alerts.unshift({id:'ALT-DEMO',machine:machine.id,type:'Simulated Machine Risk',severity:'CRITICAL',message:'Demo risk scenario active. Maintenance recommended.',status:'ACTIVE',time:'Just now'}); await saveMachines(); await saveAlerts(); broadcast(); res.json({ok:true}); });
app.post('/api/demo/reset',auth,allow('ADMIN','MANAGER','SUPERVISOR'),async (req,res)=>{ riskMode=false; Object.assign(machines[2],{status:'WARNING',health:63,temperature:94,vibration:7.7,current:241}); const index=alerts.findIndex(a=>a.id==='ALT-DEMO'); if(index>=0)alerts.splice(index,1); await saveMachines(); await saveAlerts(); broadcast(); res.json({ok:true}); });
app.patch('/api/alerts/:id',auth,allow('ADMIN','MANAGER','SUPERVISOR','MAINTENANCE'),async (req,res)=>{ const item=alerts.find(a=>a.id===req.params.id); if(item){item.status=req.body.status||'ACKNOWLEDGED';await Alert.updateOne({id:item.id},{$set:{status:item.status}});} broadcast(); res.json(item||{}); });
function broadcast(){ io.emit('snapshot',{machines,alerts,maintenance,stats:totals(),simulator:!riskMode}); }
function startSimulator() { setInterval(()=>{ machines.forEach(machine=>{ if(riskMode&&machine.id==='WELD-003')return; const drift=(Math.random()-.5); machine.temperature=Math.max(58,Math.min(98,Number((machine.temperature+drift).toFixed(1)))); machine.vibration=Math.max(1.2,Math.min(9.5,Number((machine.vibration+drift*.12).toFixed(1)))); machine.current=Math.round(Math.max(100,Math.min(250,machine.current+drift*3))); machine.voltage=Number(Math.max(16,Math.min(29,machine.voltage+drift*.15)).toFixed(1)); if(machine.status==='RUNNING'){machine.production+=Math.random()>.45?1:0; machine.good+=Math.random()>.08?1:0;} }); saveMachines().catch(error=>console.error('Could not persist simulator data:',error)); broadcast(); },5000); }
io.on('connection',socket=>socket.emit('snapshot',{machines,alerts,maintenance,stats:totals(),simulator:!riskMode}));
app.get('/api/health',(req,res)=>res.json({status:'ok',service:'smartweld-api'}));
initializeDatabase().then(()=>{server.listen(process.env.PORT||4000,()=>console.log('SmartWeld API running on http://localhost:'+ (process.env.PORT||4000)));startSimulator();})
  .catch(error=>{console.error('Could not connect to MongoDB:',error.message);process.exit(1);});

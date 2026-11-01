const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'records.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ activeSession: null, days: [] }, null, 2));
}
function readData() { ensureData(); return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function localDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
}
function prune(data) {
  const now = new Date();
  const currentMonth = new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit' }).format(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
  data.days = data.days.filter(x => x.date.startsWith(currentMonth) || x.date.startsWith(previousMonth));
}
function totalOf(counts) {
  return (counts.maimai + counts.chunithm + counts.ongeki + counts.taiko) * 100 + counts.freedom * 200;
}
const allowed=['maimai','freedom','chunithm','ongeki','taiko'];

app.get('/api/state', (req,res) => { const d=readData(); prune(d); writeData(d); res.json(d); });
app.post('/api/start', (req,res) => {
  const d=readData();
  if (!d.activeSession) d.activeSession={ date: localDate(), startedAt:new Date().toISOString(), counts:{maimai:0,freedom:0,chunithm:0,ongeki:0,taiko:0}, actions:[] };
  writeData(d); res.json(d);
});
app.post('/api/add/:game', (req,res) => {
  const game=req.params.game;
  if(!allowed.includes(game)) return res.status(400).json({error:'invalid game'});
  const d=readData(); if(!d.activeSession) return res.status(400).json({error:'no active session'});
  d.activeSession.counts[game]++; d.activeSession.actions.push(game); writeData(d); res.json(d);
});
app.post('/api/sub/:game', (req,res) => {
  const game=req.params.game;
  if(!allowed.includes(game)) return res.status(400).json({error:'invalid game'});
  const d=readData(); if(!d.activeSession) return res.status(400).json({error:'no active session'});
  if(d.activeSession.counts[game]>0){
    d.activeSession.counts[game]--;
    const i=d.activeSession.actions.lastIndexOf(game);
    if(i!==-1)d.activeSession.actions.splice(i,1);
  }
  writeData(d); res.json(d);
});
app.post('/api/undo', (req,res) => {
  const d=readData(); if(!d.activeSession || !d.activeSession.actions.length) return res.json(d);
  const game=d.activeSession.actions.pop(); d.activeSession.counts[game]=Math.max(0,d.activeSession.counts[game]-1); writeData(d); res.json(d);
});
app.post('/api/finish', (req,res) => {
  const d=readData(); if(!d.activeSession) return res.status(400).json({error:'no active session'});
  const s=d.activeSession; const record={date:s.date, counts:s.counts, total:totalOf(s.counts), startedAt:s.startedAt, finishedAt:new Date().toISOString()};
  const existing=d.days.find(x=>x.date===s.date);
  if(existing){ for(const k of Object.keys(s.counts)) existing.counts[k]=(existing.counts[k]||0)+s.counts[k]; existing.total=totalOf(existing.counts); existing.finishedAt=record.finishedAt; }
  else d.days.push(record);
  d.activeSession=null; prune(d); writeData(d); res.json(d);
});

app.listen(PORT, '0.0.0.0', () => console.log(`音ゲークレジット管理: http://localhost:${PORT}`));

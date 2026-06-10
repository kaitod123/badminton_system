import React, { useState, useEffect } from 'react';
import { Users, UserPlus, RefreshCw, Trophy, DollarSign, Swords, Clock, Trash2, History, Settings, Play, StopCircle, CheckSquare, Square } from 'lucide-react';

export default function App() {
  // ==========================================
  // 1. STATES: ระบบนำทาง (Navigation)
  // ==========================================
  const [activeTab, setActiveTab] = useState('matchmaking'); // 'matchmaking', 'history', 'calculator'

  // ==========================================
  // 2. STATES: ระบบรายชื่อและจับคู่ (Roster & Matchmaking)
  // ==========================================
  const [players, setPlayers] = useState(() => {
    const localData = localStorage.getItem('badminton_players_v4');
    return localData ? JSON.parse(localData) : [
      { id: 1, name: 'A', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: 2, name: 'B', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: 3, name: 'C', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: 4, name: 'D', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: 5, name: 'E (ไม่มา)', mmr: 100, win: 0, lose: 0, isActive: false },
      { id: 6, name: 'F (ไม่มา)', mmr: 100, win: 0, lose: 0, isActive: false },
    ];
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  
  // ตั้งค่าการเล่น
  const [numCourts, setNumCourts] = useState(2);
  const [matchMode, setMatchMode] = useState('winner_stays'); // 'winner_stays' หรือ 'balanced'
  
  // สถานะเซสชันการแข่งขัน
  const [matchSession, setMatchSession] = useState(null);

  // ==========================================
  // 3. STATES: ระบบประวัติการแข่งขันย้อนหลัง
  // ==========================================
  const [matchHistory, setMatchHistory] = useState(() => {
    const localHistory = localStorage.getItem('badminton_history_v4');
    return localHistory ? JSON.parse(localHistory) : [];
  });

  // ==========================================
  // 4. STATES: ระบบคำนวณค่าสนาม
  // ==========================================
  const [calcFees, setCalcFees] = useState({ court: 120, shuttlecock: 0 });
  const [calcPlayers, setCalcPlayers] = useState([
    { id: 1, name: 'A', joinTime: '19:00', leaveTime: '21:00' },
    { id: 2, name: 'B', joinTime: '19:00', leaveTime: '21:00' },
    { id: 3, name: 'C', joinTime: '19:00', leaveTime: '21:00' },
    { id: 4, name: 'D', joinTime: '19:00', leaveTime: '21:00' }
  ]);
  const [calcResults, setCalcResults] = useState([]);

  // ==========================================
  // 5. EFFECTS: ระบบบันทึกข้อมูลอัตโนมัติ
  // ==========================================
  useEffect(() => {
    localStorage.setItem('badminton_players_v4', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('badminton_history_v4', JSON.stringify(matchHistory));
  }, [matchHistory]);

  // ฟังก์ชันดึง MMR ล่าสุดเสมอ
  const getPlayerLatest = (id) => players.find(p => p.id === id) || { mmr: 0, name: 'Unknown' };

  // ==========================================
  // 6. FUNCTIONS: Matchmaking Logic & Winner Stays
  // ==========================================
  const handleStartSession = () => {
    // กรองเอาเฉพาะคนที่ติ๊กว่า "มาเล่น/พร้อมลงสนาม (isActive: true)" เท่านั้น
    const activePlayers = players.filter(p => p.isActive);

    if (activePlayers.length < 4) return alert('ต้องมีผู้เล่นที่ติ๊กสถานะ "พร้อมลงสนาม" อย่างน้อย 4 คนขึ้นไปครับ');
    
    // เรียงลำดับตามฝีมือ MMR จากมากไปน้อย (เฉพาะคนที่มา)
    const sorted = [...activePlayers].sort((a, b) => b.mmr - a.mmr);
    
    // จับคู่แบบไขว้ (1 คู่กับ 4, 2 คู่กับ 3 เพื่อความสูสีในแต่ละกลุ่ม 4 คน)
    const pairs = [];
    const numToPair = sorted.length - (sorted.length % 2); // ตัดเศษ 1 คนออกจากการจับคู่
    
    for (let i = 0; i < numToPair; i += 4) {
      if (i + 3 < numToPair) {
        pairs.push([sorted[i], sorted[i+3]]);
        pairs.push([sorted[i+1], sorted[i+2]]);
      } else if (i + 1 < numToPair) {
        // กรณีเหลือเศษ 2 คนสุดท้าย
        pairs.push([sorted[i], sorted[i+1]]);
      }
    }
    
    // จัดลงสนามตามจำนวนสนามที่เลือก
    const courts = [];
    let pairIndex = 0;
    const actualCourts = Math.min(numCourts, Math.floor(pairs.length / 2));
    
    if (actualCourts === 0) return alert('จำนวนผู้เล่นไม่พอที่จะจับคู่ลงสนามได้อย่างน้อย 1 สนามครับ');

    for (let i = 0; i < actualCourts; i++) {
      courts.push({
        id: i + 1,
        team1: pairs[pairIndex],
        team2: pairs[pairIndex + 1],
        finished: false,
        winnerIndex: null // 1 หรือ 2
      });
      pairIndex += 2;
    }

    // คู่ที่เหลือ นำไปใส่คิวรอ
    const waiting = pairs.slice(pairIndex);
    // คนที่ไม่มีคู่ (ถ้าจำนวนคนเป็นเลขคี่)
    const oddPlayer = sorted.length % 2 !== 0 ? sorted[sorted.length - 1] : null;

    setMatchSession({
      mode: matchMode,
      courts: courts,
      waitingPairs: waiting,
      oddPlayer: oddPlayer,
      round: 1
    });
  };

  const recordResult = (courtId, winnerTeamIndex) => {
    if (!matchSession) return;

    // ค้นหาข้อมูลสนาม
    const targetCourt = matchSession.courts.find(c => c.id === courtId);
    if (!targetCourt) return;

    const winningTeam = winnerTeamIndex === 1 ? targetCourt.team1 : targetCourt.team2;
    const losingTeam = winnerTeamIndex === 1 ? targetCourt.team2 : targetCourt.team1;

    // 1. อัปเดตสถิติลงในบอร์ดผู้เล่นหลัก
    const updatedPlayers = players.map(p => {
      const isWinner = winningTeam.some(w => w.id === p.id);
      const isLoser = losingTeam.some(l => l.id === p.id);
      
      if (isWinner) return { ...p, win: p.win + 1, mmr: p.mmr + 15 };
      if (isLoser) return { ...p, lose: p.lose + 1, mmr: Math.max(800, p.mmr - 10) };
      return p;
    });
    
    // 2. สร้างประวัติการแข่งย้อนหลัง
    const newRecord = {
      id: `MATCH-${Date.now().toString().slice(-6)}-C${courtId}`,
      date: new Date().toLocaleString('th-TH', { hour12: false }),
      team1: winningTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr })),
      team2: losingTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr })),
      winnerLabel: winnerTeamIndex === 1 ? 'TEAM A' : 'TEAM B',
      matchDetails: `สนามที่ ${courtId} (${matchSession.mode === 'winner_stays' ? 'ผู้ชนะอยู่ต่อ' : 'สลับคู่'})`,
      mmrWin: '+15',
      mmrLose: '-10'
    };

    setMatchHistory(prev => [newRecord, ...prev]);
    setPlayers(updatedPlayers);

    // 3. จัดการ Session สลับคู่ หรือ สลายโต๊ะ
    setMatchSession(prev => {
      const nextState = { ...prev, waitingPairs: [...prev.waitingPairs] };
      const cIdx = nextState.courts.findIndex(c => c.id === courtId);

      if (nextState.mode === 'winner_stays') {
        // --- โหมดชนะอยู่ต่อ ---
        if (nextState.waitingPairs.length > 0) {
          // ดึงคิวแรกมาลงสนาม
          const nextChallengerTeam = nextState.waitingPairs.shift();
          // เอาคนแพ้ไปต่อท้ายคิว
          nextState.waitingPairs.push(losingTeam);
          
          // รีเฟรชสนามให้คนชนะอยู่ต่อ เจอคนใหม่
          nextState.courts[cIdx] = {
            ...nextState.courts[cIdx],
            team1: winningTeam, // แชมป์ยืนรอ (ฝั่ง A)
            team2: nextChallengerTeam, // ผู้ท้าชิง (ฝั่ง B)
            finished: false,
            winnerIndex: null
          };
          alert(`🏆 บันทึกผลสนามที่ ${courtId} สำเร็จ!\nแชมป์แข่งต่อ เจอกับคู่ของ ${nextChallengerTeam[0].name} & ${nextChallengerTeam[1].name}`);
        } else {
          // ไม่มีคนรอคิว ให้รีเซ็ตสนามให้แข่งกันเองอีกรอบได้
          nextState.courts[cIdx] = {
            ...nextState.courts[cIdx],
            team1: winningTeam, 
            team2: losingTeam,
            finished: false,
            winnerIndex: null
          };
          alert(`🏆 บันทึกผลสนามที่ ${courtId} สำเร็จ!\n(ไม่มีคิวรอ ให้แข่งรีแมตช์รอบต่อไปได้เลย)`);
        }
      } else {
        // --- โหมดสลับคู่ทุกรอบ (Balanced) ---
        // ทำเครื่องหมายว่าจบแล้ว รอให้ทุกสนามจบเพื่อจัดคู่รอบใหม่
        nextState.courts[cIdx].finished = true;
        nextState.courts[cIdx].winnerIndex = winnerTeamIndex;
      }

      return nextState;
    });
  };

  const endSession = () => {
    if (window.confirm('ยุติเซสชันการแข่งปัจจุบันใช่หรือไม่?')) {
      setMatchSession(null);
    }
  }

  // Check if all courts are finished (for balanced mode)
  const isAllCourtsFinished = matchSession && matchSession.mode === 'balanced' && matchSession.courts.every(c => c.finished);

  // ==========================================
  // 7. FUNCTIONS: Player Management
  // ==========================================
  const addPlayer = () => {
    if (!newPlayerName) return;
    if (players.some(p => p.name.trim() === newPlayerName.trim())) return alert('ชื่อนี้มีอยู่ในระบบแล้วครับ');
    
    // ผู้เล่นใหม่ถูกเพิ่ม และตั้งค่าสถานะ isActive: true (พร้อมลงสนาม) อัตโนมัติ
    const newP = { id: Date.now(), name: newPlayerName.trim(), mmr: 100, win: 0, lose: 0, isActive: true };
    setPlayers([...players, newP]);
    setNewPlayerName('');
  };

  const togglePlayerActive = (id) => {
    setPlayers(players.map(p => {
      if (p.id === id) return { ...p, isActive: !p.isActive };
      return p;
    }));
  };

  const removePlayer = (id) => {
    if (window.confirm('คุณต้องการลบผู้เล่นคนนี้ออก "อย่างถาวร" ใช่หรือไม่?\n(คำแนะนำ: หากแค่วันนี้เขาไม่ได้มาเล่น ให้กดติ๊กถูกด้านหน้าชื่อออกแทนการลบ เพื่อรักษา MMR ไว้)')) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  const clearHistory = () => {
    if (window.confirm('⚠️ คุณต้องการลบประวัติการแข่งย้อนหลังทั้งหมดใช่หรือไม่? ข้อมูลนี้จะสูญหายถาวร')) {
      setMatchHistory([]);
    }
  };

  const resetRoster = () => {
    if (window.confirm('⚠️ คุณต้องการรีเซ็ตสถิติผู้เล่นกลับเป็นค่าเริ่มต้นทั้งหมดใช่หรือไม่?')) {
      localStorage.removeItem('badminton_players_v4');
      window.location.reload();
    }
  };

  // ==========================================
  // 8. FUNCTIONS: Calculator Logic
  // ==========================================
  const calculateDynamicFees = () => {
    const totalExpenses = Number(calcFees.court) + Number(calcFees.shuttlecock);
    let totalPlayedMinutes = 0;

    const getMinutesFromTime = (timeStr) => {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return (hours * 60) + minutes;
    };

    const playersWithMinutes = calcPlayers.map(player => {
      const joinMins = getMinutesFromTime(player.joinTime);
      const leaveMins = getMinutesFromTime(player.leaveTime);
      const adjustedLeave = leaveMins < joinMins ? leaveMins + (24 * 60) : leaveMins;
      const minutesPlayed = Math.max(0, adjustedLeave - joinMins);
      
      totalPlayedMinutes += minutesPlayed;
      return { ...player, minutesPlayed };
    });

    if (totalPlayedMinutes === 0) {
      setCalcResults([]);
      return;
    }

    const results = playersWithMinutes.map(player => {
      const ratio = player.minutesPlayed / totalPlayedMinutes;
      const feeToPay = totalExpenses * ratio;
      return { ...player, feeToPay: feeToPay.toFixed(2) };
    });

    setCalcResults(results);
  };

  useEffect(() => {
    if (activeTab === 'calculator') {
      calculateDynamicFees();
    }
  }, [calcFees, calcPlayers, activeTab]);

  const updateCalcPlayerTime = (index, field, value) => {
    const newPlayers = [...calcPlayers];
    newPlayers[index][field] = value;
    setCalcPlayers(newPlayers);
  };

  const addCalcPlayer = () => {
    setCalcPlayers([...calcPlayers, { id: Date.now(), name: `ผู้เล่น ${calcPlayers.length + 1}`, joinTime: '19:00', leaveTime: '21:00' }]);
  };

  const removeCalcPlayer = (id) => {
    setCalcPlayers(calcPlayers.filter(p => p.id !== id));
  };

  const importRosterToCalculator = () => {
    // ดึงเฉพาะคนที่มาร่วมเล่น (isActive === true) ลงมาคำนวณเงิน
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length === 0) return alert('ไม่มีผู้เล่นที่ตั้งสถานะพร้อมลงสนาม สำหรับดึงข้อมูลครับ');
    
    const imported = activePlayers.map(p => ({
      id: p.id,
      name: p.name,
      joinTime: '19:00',
      leaveTime: '21:00'
    }));
    setCalcPlayers(imported);
    alert(`⚡ ดึงรายชื่อผู้เล่นจำนวน ${activePlayers.length} คนลงมายังระบบคิดเงินเรียบร้อย!`);
  };

  // ==========================================
  // 9. RENDER UI
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      {/* Navbar */}
      <nav className="bg-indigo-600 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2 text-xl font-bold cursor-pointer" onClick={() => setActiveTab('matchmaking')}>
            <Swords size={28} />
            <span>Badminton System</span>
          </div>
          <div className="flex flex-wrap gap-2 bg-indigo-700 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('matchmaking')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'matchmaking' ? 'bg-white text-indigo-700 shadow' : 'hover:bg-indigo-500 text-indigo-100'}`}
            >
              ระบบจับคู่ (Matchmaking)
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'history' ? 'bg-white text-indigo-700 shadow' : 'hover:bg-indigo-500 text-indigo-100'}`}
            >
              ประวัติการแข่ง (History)
            </button>
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'calculator' ? 'bg-white text-indigo-700 shadow' : 'hover:bg-indigo-500 text-indigo-100'}`}
            >
              ระบบคิดเงิน (Calculator)
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto mt-8 px-4">
        
        {/* ========================================= */}
        {/* VIEW 1: MATCHMAKING & ROSTER */}
        {/* ========================================= */}
        {activeTab === 'matchmaking' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-slate-800 flex items-center">
                <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
                ระบบจัดการรายชื่อและจัดทีม
              </h1>
              <div className="flex items-center gap-4">
                <span className="bg-indigo-100 text-indigo-800 text-sm font-bold px-3 py-1 rounded-full">
                  พร้อมลงสนาม: {players.filter(p=>p.isActive).length} / {players.length} คน
                </span>
                <button onClick={resetRoster} className="text-xs text-red-500 hover:text-red-700 font-semibold underline">
                  รีเซ็ตข้อมูลทั้งหมด
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-12 gap-6">
              
              {/* === รายชื่อผู้เล่น (ซ้าย) === */}
              <div className="md:col-span-4 lg:col-span-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 h-fit">
                <h2 className="font-bold text-slate-700 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-indigo-500"/> รายชื่อผู้เล่นทั้งหมด (Database)
                </h2>
                
                <div className="flex gap-2 mb-6">
                  <input 
                    value={newPlayerName} 
                    onChange={(e) => setNewPlayerName(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                    placeholder="เพิ่มชื่อผู้เล่นใหม่..." 
                    className="flex-1 border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm" 
                  />
                  <button onClick={addPlayer} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center">
                    <UserPlus size={18}/>
                  </button>
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {players.length === 0 && <p className="text-center text-slate-400 py-4">ยังไม่มีผู้เล่น</p>}
                  
                  {players.sort((a,b) => b.mmr - a.mmr).map((p, index) => (
                    <div key={p.id} className={`flex justify-between items-center p-2.5 rounded-xl transition-colors group border ${p.isActive ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-slate-100 border-slate-100 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => togglePlayerActive(p.id)}
                          className="focus:outline-none flex-shrink-0"
                          title={p.isActive ? "พร้อมลงสนาม" : "ไม่ได้มา / พัก"}
                        >
                          {p.isActive 
                            ? <CheckSquare className="text-emerald-500 w-5 h-5 hover:text-emerald-600" /> 
                            : <Square className="text-slate-400 w-5 h-5 hover:text-slate-500" />
                          }
                        </button>
                        <div>
                          <p className={`text-sm ${p.isActive ? 'font-bold text-slate-700' : 'font-medium text-slate-500 line-through'}`}>{p.name}</p>
                          <p className="text-[10px] text-slate-500">ชนะ {p.win} | แพ้ {p.lose}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-indigo-600 shadow-sm">
                          {p.mmr}
                        </span>
                        <button onClick={() => removePlayer(p.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="ลบออกจากระบบถาวร">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* === ลานประลอง (ขวา) === */}
              <div className="md:col-span-8 lg:col-span-8 space-y-6">
                
                {/* --- แผงควบคุม (Settings Panel) --- */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center"><Swords size={12} className="mr-1"/> จำนวนสนาม</label>
                      <select 
                        disabled={matchSession !== null}
                        value={numCourts} 
                        onChange={(e) => setNumCourts(Number(e.target.value))}
                        className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value={1}>1 สนาม (รองรับสูงสุด 4 คน)</option>
                        <option value={2}>2 สนาม (รองรับสูงสุด 8 คน)</option>
                        <option value={3}>3 สนาม (รองรับสูงสุด 12 คน)</option>
                        <option value={4}>4 สนาม (รองรับสูงสุด 16 คน)</option>
                        <option value={5}>5 สนาม (รองรับสูงสุด 20 คน)</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center"><Settings size={12} className="mr-1"/> โหมดการเล่น</label>
                      <select 
                        disabled={matchSession !== null}
                        value={matchMode} 
                        onChange={(e) => setMatchMode(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="winner_stays">👑 ผู้ชนะอยู่ต่อ (สลับทีมรอเสียบ)</option>
                        <option value="balanced">🔄 จัดใหม่ทุกรอบ (กระจายความหลากหลาย)</option>
                      </select>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex-shrink-0 mt-2 md:mt-0 flex flex-col justify-end">
                    {!matchSession ? (
                      <button 
                        onClick={handleStartSession} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Play size={18} /> เริ่มเซสชันการแข่ง
                      </button>
                    ) : (
                      <button 
                        onClick={endSession} 
                        className="w-full bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <StopCircle size={18} /> ยุติเซสชัน
                      </button>
                    )}
                  </div>
                </div>

                {/* --- แสดงผลการจัดสนาม --- */}
                {!matchSession ? (
                   <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-2xl flex flex-col items-center justify-center text-center text-slate-400">
                     <Swords className="w-16 h-16 mb-4 opacity-50" />
                     <p className="font-bold text-lg text-slate-500">ยังไม่มีการแข่งขัน</p>
                     <p className="text-sm mt-2">ติ๊กเลือกคนที่พร้อมแข่งด้านซ้าย เลือกระบบสนาม แล้วกด "เริ่มเซสชัน"</p>
                   </div>
                ) : (
                  <div className="bg-indigo-900 rounded-2xl shadow-lg p-5 relative overflow-hidden animate-in zoom-in-95 duration-300">
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-indigo-700 rounded-full blur-3xl opacity-50"></div>
                    
                    <div className="flex items-center justify-between border-b border-indigo-800 pb-3 mb-5">
                      <h3 className="font-bold text-white text-lg flex items-center">
                        <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                        กำลังแข่งขัน ({matchSession.mode === 'winner_stays' ? 'โหมดชนะอยู่ต่อ' : 'โหมดสลับใหม่ทุกรอบ'})
                      </h3>
                      <span className="text-xs bg-indigo-800 text-indigo-200 px-3 py-1 rounded-full font-bold shadow-sm border border-indigo-700">
                        เปิดใช้งาน {matchSession.courts.length} สนาม
                      </span>
                    </div>
                    
                    {/* วนลูปแสดงสนาม */}
                    <div className="grid lg:grid-cols-2 gap-4">
                      {matchSession.courts.map((court) => (
                        <div key={court.id} className="bg-indigo-950/60 p-4 rounded-xl border border-indigo-800/80 shadow-inner flex flex-col">
                          <h4 className="text-indigo-200 text-sm font-bold mb-3 flex items-center justify-between">
                            <span>🏸 สนามที่ {court.id}</span>
                            {court.finished && <span className="text-green-400 text-[10px] bg-green-500/20 px-2 py-0.5 rounded uppercase">จบแล้ว</span>}
                          </h4>

                          <div className="flex-1 flex flex-col justify-center space-y-3 relative">
                            {/* VS Badge */}
                            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-900 rounded-full p-2 shadow z-10 border border-indigo-800">
                              <span className="font-black text-red-400 text-xs">VS</span>
                            </div>

                            {/* Team 1 (A) */}
                            <div className={`p-3 rounded-lg border transition-all ${court.finished ? 'bg-slate-800/50 border-slate-700/50 opacity-50' : 'bg-white/10 backdrop-blur-md border-white/10 shadow-sm'}`}>
                              <div className="space-y-1.5 mb-3">
                                {court.team1.map(p => (
                                  <div key={p.id} className="bg-white/90 rounded px-2 py-1.5 shadow-sm flex justify-between items-center text-sm">
                                    <span className="font-bold text-indigo-950">{p.name}</span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">{getPlayerLatest(p.id).mmr}</span>
                                  </div>
                                ))}
                              </div>
                              {!court.finished && (
                                <button onClick={() => recordResult(court.id, 1)} className="w-full bg-blue-500 hover:bg-blue-400 text-white py-1.5 rounded font-bold text-xs shadow transition-colors">
                                  ทีมบนชนะ 🏆
                                </button>
                              )}
                            </div>

                            {/* Team 2 (B) */}
                            <div className={`p-3 rounded-lg border transition-all ${court.finished ? 'bg-slate-800/50 border-slate-700/50 opacity-50' : 'bg-white/10 backdrop-blur-md border-white/10 shadow-sm'}`}>
                              <div className="space-y-1.5 mb-3">
                                {court.team2.map(p => (
                                  <div key={p.id} className="bg-white/90 rounded px-2 py-1.5 shadow-sm flex justify-between items-center text-sm">
                                    <span className="font-bold text-indigo-950">{p.name}</span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">{getPlayerLatest(p.id).mmr}</span>
                                  </div>
                                ))}
                              </div>
                              {!court.finished && (
                                <button onClick={() => recordResult(court.id, 2)} className="w-full bg-red-500 hover:bg-red-400 text-white py-1.5 rounded font-bold text-xs shadow transition-colors">
                                  ทีมล่างชนะ 🏆
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* คิวรอ (Waiting Queue) */}
                    {matchSession.waitingPairs && matchSession.waitingPairs.length > 0 && (
                      <div className="bg-black/20 border border-white/10 rounded-xl p-4 mt-5">
                        <h4 className="font-bold text-sm text-indigo-200 flex items-center gap-1.5 mb-3">
                          <Clock size={16} /> คิวรอเสียบสนามถัดไป ({matchSession.waitingPairs.length} คู่)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {matchSession.waitingPairs.map((pair, idx) => (
                            <div key={idx} className="bg-indigo-950 border border-indigo-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-sm">
                              <span className="font-bold text-white">{pair[0].name}</span>
                              <span className="text-indigo-400/50">&</span>
                              <span className="font-bold text-white">{pair[1].name}</span>
                              {idx === 0 && <span className="ml-1 bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded-[4px] text-[10px] font-black">คิวถัดไป!</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {matchSession.oddPlayer && (
                      <div className="mt-4 text-xs text-indigo-300">
                        * หมายเหตุ: มีผู้เล่น 1 คนรอเข้าคู่คือ <span className="font-bold text-white">{matchSession.oddPlayer.name}</span>
                      </div>
                    )}

                    {/* ปุ่มสำหรับโหมด Balanced เพื่อสร้างรอบต่อไป */}
                    {isAllCourtsFinished && (
                      <button 
                        onClick={handleStartSession} 
                        className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex justify-center items-center gap-2 animate-bounce"
                      >
                        <RefreshCw size={18} /> เริ่มรอบต่อไป (กระจายสลับคู่ใหม่ทั้งหมด)
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 2: MATCH HISTORY VIEW */}
        {/* ========================================= */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <History className="w-7 h-7 mr-2 text-indigo-600 bg-indigo-50 p-1 rounded-full" />
                ประวัติการแข่งขันและปรับคะแนนย้อนหลัง
              </h2>
              {matchHistory.length > 0 && (
                <button onClick={clearHistory} className="text-xs text-red-500 hover:text-red-700 font-semibold underline">
                  ล้างประวัติทั้งหมด
                </button>
              )}
            </div>

            <p className="text-slate-500 text-sm">
              ผลการแข่งขันทั้งหมดจะถูกบันทึกไว้อย่างปลอดภัยลงใน LocalStorage ของคุณ
            </p>

            {matchHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <History className="w-16 h-16 mx-auto text-slate-200 mb-3" />
                <p>ยังไม่มีประวัติการแข่งในระบบ ลองเริ่มจับคู่และลงคะแนนเพื่อให้สถิติบันทึกเข้ามาครับ</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 animate-fade-in">
                {matchHistory.map((match) => (
                  <div key={match.id} className="border border-slate-150 rounded-xl p-4 shadow-sm hover:shadow transition-shadow bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between md:justify-start gap-4 mb-3">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{match.id}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {match.date}</span>
                        <span className="text-xs font-medium text-slate-500 hidden sm:inline">{match.matchDetails}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-2.5 rounded-lg border border-green-200 bg-green-50/30">
                          <p className="text-xs font-bold text-green-700 mb-1">ทีมชนะ ({match.winnerLabel})</p>
                          <div className="space-y-0.5 text-sm">
                            {match.team1.map((p, i) => (
                              <div key={i} className="text-slate-700 flex justify-between">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-slate-400">(MMR เดิม {p.mmr})</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg border border-slate-100 bg-white">
                          <p className="text-xs font-bold text-slate-500 mb-1">ทีมแพ้</p>
                          <div className="space-y-0.5 text-sm">
                            {match.team2.map((p, i) => (
                              <div key={i} className="text-slate-700 flex justify-between">
                                <span>{p.name}</span>
                                <span className="text-xs text-slate-400">(MMR เดิม {p.mmr})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border p-3 rounded-lg text-center w-full md:w-32 flex md:flex-col justify-around md:justify-center gap-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ปรับทีมชนะ</p>
                        <p className="text-xs font-black text-green-600">{match.mmrWin} MMR</p>
                      </div>
                      <div className="border-l md:border-l-0 md:border-t border-slate-100 pt-0 md:pt-1">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ปรับทีมแพ้</p>
                        <p className="text-xs font-black text-red-500">{match.mmrLose} MMR</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 3: DYNAMIC COURT FEE CALCULATOR */}
        {/* ========================================= */}
        {activeTab === 'calculator' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <DollarSign className="w-7 h-7 mr-2 text-green-500 bg-green-100 p-1 rounded-full" />
                ระบบคิดเงิน (Pro-Rata Calculator)
              </h2>
              <button 
                onClick={importRosterToCalculator}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors flex items-center gap-1 border border-indigo-200"
              >
                <Users size={14}/> ดึงรายชื่อคนที่พร้อมเล่นลงมาคิดเงิน ({players.filter(p=>p.isActive).length} คน)
              </button>
            </div>
            
            <p className="text-slate-500 mb-6 text-sm">
              คำนวณแบ่งจ่ายค่าสนามและค่าลูกแบดตาม <strong className="text-indigo-600">"ระยะเวลาที่เล่นจริงของแต่ละคน"</strong> เพื่อความเที่ยงตรงและยุติธรรมสำหรับผู้เล่นที่มาสลับเวลาลงเล่น
            </p>

            <div className="grid md:grid-cols-12 gap-8 mb-8">
              
              {/* ตั้งค่าค่าใช้จ่าย */}
              <div className="md:col-span-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-4 flex items-center"><DollarSign className="w-4 h-4 mr-1"/> ยอดค่าใช้จ่ายรวม</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1 font-medium">ค่าสนามรวม (บาท)</label>
                    <input 
                      type="number" 
                      value={calcFees.court} 
                      onChange={(e) => setCalcFees({...calcFees, court: e.target.value})}
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1 font-medium">ค่าลูกแบดรวม (บาท)</label>
                    <input 
                      type="number" 
                      value={calcFees.shuttlecock} 
                      onChange={(e) => setCalcFees({...calcFees, shuttlecock: e.target.value})}
                      className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex justify-between font-bold text-xl text-slate-800">
                      <span>รวมต้องจ่าย:</span>
                      <span className="text-green-600">{Number(calcFees.court) + Number(calcFees.shuttlecock)} ฿</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* รายชื่อและเวลา */}
              <div className="md:col-span-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-700 flex items-center"><Clock className="w-4 h-4 mr-2"/> ผู้เล่นและเวลาลงสนาม</h3>
                  <button onClick={addCalcPlayer} className="text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg font-medium flex items-center transition-colors">
                    + เพิ่มคนจ่ายตังค์
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {calcPlayers.map((player, index) => (
                    <div key={player.id} className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors shadow-sm">
                      <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-500 mb-1">ชื่อผู้เล่น</label>
                        <input 
                          type="text" 
                          value={player.name} 
                          onChange={(e) => updateCalcPlayerTime(index, 'name', e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" 
                        />
                      </div>
                      <div className="w-full sm:w-28">
                        <label className="block text-xs text-slate-500 mb-1">เวลาเข้า</label>
                        <input 
                          type="time" 
                          value={player.joinTime} 
                          onChange={(e) => updateCalcPlayerTime(index, 'joinTime', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" 
                        />
                      </div>
                      <div className="w-full sm:w-28">
                        <label className="block text-xs text-slate-500 mb-1">เวลาออก</label>
                        <input 
                          type="time" 
                          value={player.leaveTime} 
                          onChange={(e) => updateCalcPlayerTime(index, 'leaveTime', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none" 
                        />
                      </div>
                      <div className="pt-5">
                         <button onClick={() => removeCalcPlayer(player.id)} className="text-red-400 hover:text-red-600 p-2">
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ผลลัพธ์การคำนวณ */}
            <div className="bg-indigo-950 text-white rounded-2xl overflow-hidden shadow-xl border border-indigo-900">
              <div className="p-4 border-b border-indigo-800 bg-indigo-900 flex justify-between items-center">
                <h3 className="font-bold flex items-center text-lg">
                  <DollarSign className="w-5 h-5 mr-2 text-green-400" />
                  สรุปยอดเรียกเก็บเงินรายบุคคล
                </h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-indigo-950 text-indigo-300 text-sm border-b border-indigo-800">
                      <th className="p-4 py-3 font-medium">ชื่อผู้เล่น</th>
                      <th className="p-4 py-3 font-medium text-center">เวลาที่เล่นจริง</th>
                      <th className="p-4 py-3 font-medium text-right">ยอดที่ต้องโอน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-800/50">
                    {calcResults.map((result, idx) => (
                      <tr key={idx} className="hover:bg-indigo-800/30 transition-colors">
                        <td className="p-4 font-medium flex items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center mr-3 text-indigo-200 text-xs font-bold uppercase">
                            {result.name.substring(0, 2)}
                          </div>
                          {result.name}
                        </td>
                        <td className="p-4 text-center text-indigo-200 font-medium">
                          {result.minutesPlayed} <span className="text-xs text-indigo-400">นาที</span>
                        </td>
                        <td className="p-4 text-right font-black text-green-400 text-xl">
                          {result.feeToPay} <span className="text-sm font-normal text-green-600">฿</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

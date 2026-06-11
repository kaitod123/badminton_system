import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, RefreshCw, Trophy, DollarSign, Swords, 
  Clock, Trash2, History, Settings, Play, StopCircle, 
  CheckCircle2, Circle, ChevronRight, Activity, Award,
  Menu, X, Wifi, WifiOff
} from 'lucide-react';

// ==========================================
// 0. API CONFIG (เชื่อมต่อ Aiven Postgres ผ่าน server.js)
// ==========================================
// ⚠️ นำลิงก์ Web Service ที่ได้จาก Render มาใส่ตรงนี้ (อย่าลืมเติม /api ต่อท้าย)
const API_BASE_URL = 'https://badminton-system-hpkd.onrender.com/api'; 

export default function App() {
  // ==========================================
  // 1. STATES: ระบบนำทาง (Navigation) & Connection
  // ==========================================
  const [activeTab, setActiveTab] = useState('matchmaking');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking'); // 'checking', 'online', 'offline'

  // ==========================================
  // 2. STATES: ระบบข้อมูลหลัก (มี LocalStorage เป็น Fallback หากออฟไลน์)
  // ==========================================
  const [players, setPlayers] = useState(() => {
    const localData = localStorage.getItem('badminton_players_v7');
    return localData ? JSON.parse(localData) : [
      { id: '1', name: 'A', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: '2', name: 'B', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: '3', name: 'C', mmr: 100, win: 0, lose: 0, isActive: true },
      { id: '4', name: 'D', mmr: 100, win: 0, lose: 0, isActive: true },
    ];
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  
  const [numCourts, setNumCourts] = useState(2);
  const [matchMode, setMatchMode] = useState('winner_stays');
  
  const [matchSession, setMatchSession] = useState(() => {
    const local = localStorage.getItem('badminton_session_v7');
    return local ? JSON.parse(local) : null;
  });

  const [matchHistory, setMatchHistory] = useState(() => {
    const local = localStorage.getItem('badminton_history_v7');
    return local ? JSON.parse(local) : [];
  });

  // ==========================================
  // 3. STATES: ระบบคำนวณค่าสนาม (ทำงานบนเครื่องอย่างเดียว)
  // ==========================================
  const [calcFees, setCalcFees] = useState({ court: 120, shuttlecock: 0 });
  const [calcPlayers, setCalcPlayers] = useState([]);
  const [calcResults, setCalcResults] = useState([]);

  // ==========================================
  // 4. API SYNC FUNCTIONS (หัวใจของระบบ Real-time)
  // ==========================================
  
  // 4.1 ฟังก์ชันดึงข้อมูลจาก Aiven
  const fetchFromServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sync`);
      if (res.ok) {
        const data = await res.json();
        // อัปเดตข้อมูลจากเซิร์ฟเวอร์ ถ้ามีข้อมูล
        if (data.players) setPlayers(data.players);
        if (data.history) setMatchHistory(data.history);
        if (data.session !== undefined) setMatchSession(data.session);
        
        setDbStatus('online');
      } else {
        setDbStatus('offline');
      }
    } catch (error) {
      setDbStatus('offline');
    }
  }, []);

  // 4.2 Polling: ให้ยิงตรวจข้อมูลทุกๆ 3 วินาที (เพื่อให้หน้าจอทุกคนตรงกัน)
  useEffect(() => {
    fetchFromServer();
    const interval = setInterval(fetchFromServer, 3000);
    return () => clearInterval(interval);
  }, [fetchFromServer]);

  // 4.3 ฟังก์ชันรับผิดชอบการเซฟข้อมูลทั้งหมด (อัปเดต UI ทันที แล้วยิงไปเซิร์ฟเวอร์ทีหลัง)
  const updateGlobalState = async (newPlayers, newHistory, newSession) => {
    // อัปเดตหน้าจอทันที ไม่ต้องรอเน็ต
    if (newPlayers) setPlayers(newPlayers);
    if (newHistory) setMatchHistory(newHistory);
    if (newSession !== undefined) setMatchSession(newSession);

    // เก็บความจำสำรองลงเครื่อง (Fallback)
    if (newPlayers) localStorage.setItem('badminton_players_v7', JSON.stringify(newPlayers));
    if (newHistory) localStorage.setItem('badminton_history_v7', JSON.stringify(newHistory));
    if (newSession !== undefined) localStorage.setItem('badminton_session_v7', JSON.stringify(newSession));

    // พยายามยิงอัปเดตฐานข้อมูล Aiven
    if (dbStatus === 'online') {
      try {
        await fetch(`${API_BASE_URL}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            players: newPlayers || players,
            history: newHistory || matchHistory,
            session: newSession !== undefined ? newSession : matchSession
          })
        });
      } catch (e) {
        console.error("Failed to push update to Aiven");
      }
    }
  };

  const getPlayerLatest = (id) => players.find(p => p.id === String(id)) || { mmr: 0, name: 'Unknown' };

  // ==========================================
  // 5. FUNCTIONS: Matchmaking Logic 
  // ==========================================
  const handleStartSession = () => {
    const activePlayers = players.filter(p => p.isActive);

    if (activePlayers.length < 4) return alert('ต้องมีผู้เล่นที่ "พร้อมลงสนาม" อย่างน้อย 4 คนขึ้นไปครับ');
    
    // สุ่มและจัดเข้าข่าย (Snake Draft)
    const shuffledActive = [...activePlayers].sort(() => Math.random() - 0.5);
    const numToPlay = Math.min(
      shuffledActive.length - (shuffledActive.length % 4),
      numCourts * 4
    );

    if (numToPlay === 0) return alert('จำนวนผู้เล่นไม่พอที่จะจับคู่ลงสนามได้อย่างน้อย 1 สนามครับ');

    const selectedToPlay = shuffledActive.slice(0, numToPlay);
    const waitingPlayers = shuffledActive.slice(numToPlay);

    selectedToPlay.sort((a, b) => b.mmr - a.mmr);

    const pairs = [];
    const half = selectedToPlay.length / 2;
    for (let i = 0; i < half; i++) {
      pairs.push([selectedToPlay[i], selectedToPlay[selectedToPlay.length - 1 - i]]);
    }
    
    const courts = [];
    const actualCourts = pairs.length / 2;
    for (let i = 0; i < actualCourts; i++) {
      courts.push({
        id: i + 1,
        team1: pairs[i],
        team2: pairs[pairs.length - 1 - i],
        finished: false,
        winnerIndex: null
      });
    }

    const waitingPairs = [];
    for (let i = 0; i < waitingPlayers.length - 1; i += 2) {
       waitingPairs.push([waitingPlayers[i], waitingPlayers[i+1]]);
    }

    const newSession = {
      mode: matchMode,
      courts: courts,
      waitingPairs: waitingPairs,
      oddPlayer: waitingPlayers.length % 2 !== 0 ? waitingPlayers[waitingPlayers.length - 1] : null,
      round: 1
    };

    updateGlobalState(null, null, newSession);
  };

  const recordResult = (courtId, winnerTeamIndex) => {
    if (!matchSession) return;

    const targetCourt = matchSession.courts.find(c => c.id === courtId);
    if (!targetCourt) return;

    const winningTeam = winnerTeamIndex === 1 ? targetCourt.team1 : targetCourt.team2;
    const losingTeam = winnerTeamIndex === 1 ? targetCourt.team2 : targetCourt.team1;

    const getAvgMmr = (team) => team.reduce((sum, p) => sum + getPlayerLatest(p.id).mmr, 0) / team.length;
    const winAvg = getAvgMmr(winningTeam);
    const loseAvg = getAvgMmr(losingTeam);

    const mmrChanges = {};

    winningTeam.forEach(p => {
       const partner = winningTeam.find(x => x.id !== p.id);
       let gain = 15;
       const pMmr = getPlayerLatest(p.id).mmr;
       const partnerMmr = getPlayerLatest(partner.id).mmr;

       if (loseAvg > winAvg + 10) gain += 3; 
       else if (winAvg > loseAvg + 10) gain -= 3;
       if (pMmr < partnerMmr - 10) gain += 2;
       else if (pMmr > partnerMmr + 10) gain -= 2;

       mmrChanges[p.id] = gain;
    });

    losingTeam.forEach(p => {
       const partner = losingTeam.find(x => x.id !== p.id);
       let drop = 10;
       const pMmr = getPlayerLatest(p.id).mmr;
       const partnerMmr = getPlayerLatest(partner.id).mmr;

       if (loseAvg > winAvg + 10) drop += 3;
       else if (winAvg > loseAvg + 10) drop -= 3;
       if (pMmr > partnerMmr + 10) drop -= 2;
       else if (pMmr < partnerMmr - 10) drop += 2;

       mmrChanges[p.id] = -drop;
    });

    // อัปเดต MMR
    const updatedPlayers = players.map(p => {
      if (mmrChanges[p.id] !== undefined) {
         const change = mmrChanges[p.id];
         return {
           ...p,
           win: change > 0 ? p.win + 1 : p.win,
           lose: change < 0 ? p.lose + 1 : p.lose,
           mmr: Math.max(10, p.mmr + change)
         };
      }
      return p;
    });
    
    // บันทึกประวัติ
    const historyId = `M${Date.now().toString().slice(-4)}-C${courtId}`;
    const newRecord = {
      id: historyId,
      timestamp: Date.now(),
      date: new Date().toLocaleString('th-TH', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }),
      team1: winningTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr, change: `+${mmrChanges[p.id]}` })),
      team2: losingTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr, change: `${mmrChanges[p.id]}` })),
      winnerLabel: winnerTeamIndex === 1 ? 'TEAM A' : 'TEAM B',
      matchDetails: `สนามที่ ${courtId} • ${matchSession.mode === 'winner_stays' ? 'แชมป์อยู่ต่อ' : 'สลับคู่'}`
    };
    
    const newHistory = [newRecord, ...matchHistory];

    // อัปเดตกระดานเซสชัน
    const nextState = { ...matchSession, waitingPairs: [...matchSession.waitingPairs] };
    const cIdx = nextState.courts.findIndex(c => c.id === courtId);

    if (nextState.mode === 'winner_stays') {
      if (nextState.waitingPairs.length > 0) {
        const nextChallengerTeam = nextState.waitingPairs.shift();
        nextState.waitingPairs.push(losingTeam);
        
        nextState.courts[cIdx] = {
          ...nextState.courts[cIdx],
          team1: winningTeam,
          team2: nextChallengerTeam,
          finished: false,
          winnerIndex: null
        };
      } else {
        nextState.courts[cIdx] = {
          ...nextState.courts[cIdx],
          team1: winningTeam, 
          team2: losingTeam,
          finished: false,
          winnerIndex: null
        };
      }
    } else {
      nextState.courts[cIdx].finished = true;
      nextState.courts[cIdx].winnerIndex = winnerTeamIndex;
    }

    // สั่งเซฟขึ้นเซิร์ฟเวอร์ทีเดียว
    updateGlobalState(updatedPlayers, newHistory, nextState);
  };

  const endSession = () => {
    if (window.confirm('ยืนยันการปิดเซสชันการแข่งปัจจุบัน?')) {
      updateGlobalState(null, null, null);
    }
  }

  const isAllCourtsFinished = matchSession && matchSession.mode === 'balanced' && matchSession.courts.every(c => c.finished);

  // ==========================================
  // 6. FUNCTIONS: Player Management
  // ==========================================
  const addPlayer = () => {
    if (!newPlayerName) return;
    if (players.some(p => p.name.trim().toLowerCase() === newPlayerName.trim().toLowerCase())) return alert('ชื่อนี้มีอยู่ในระบบแล้วครับ');
    
    const newId = Date.now().toString();
    const newP = { id: newId, name: newPlayerName.trim(), mmr: 100, win: 0, lose: 0, isActive: true };
    
    updateGlobalState([...players, newP], null, undefined);
    setNewPlayerName('');
  };

  const togglePlayerActive = (id) => {
    const updatedPlayers = players.map(p => p.id === String(id) ? { ...p, isActive: !p.isActive } : p);
    updateGlobalState(updatedPlayers, null, undefined);
  };

  const removePlayer = (id) => {
    if (window.confirm('ลบผู้เล่นคนนี้ออกจากระบบถาวรใช่หรือไม่?')) {
      const updatedPlayers = players.filter(p => p.id !== String(id));
      updateGlobalState(updatedPlayers, null, undefined);
    }
  };

  const clearHistory = () => {
    if (window.confirm('⚠️ ลบประวัติทั้งหมดถาวร ใช่หรือไม่?')) {
      updateGlobalState(null, [], undefined);
    }
  };

  const resetRoster = () => {
    if (window.confirm('⚠️ รีเซ็ตข้อมูลผู้เล่นกลับเป็นค่าเริ่มต้นทั้งหมด ใช่หรือไม่?')) {
      const defaults = [
        { id: '1', name: 'A', mmr: 100, win: 0, lose: 0, isActive: true },
        { id: '2', name: 'B', mmr: 100, win: 0, lose: 0, isActive: true },
      ];
      updateGlobalState(defaults, [], null);
    }
  };

  // ==========================================
  // 7. FUNCTIONS: Calculator Logic (ทำงานในเครื่องอย่างเดียว ไม่ซิงค์ออนไลน์)
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
    if (activeTab === 'calculator') calculateDynamicFees();
  }, [calcFees, calcPlayers, activeTab]);

  const updateCalcPlayerTime = (index, field, value) => {
    const newPlayers = [...calcPlayers];
    newPlayers[index][field] = value;
    setCalcPlayers(newPlayers);
  };

  const addCalcPlayer = () => {
    setCalcPlayers([...calcPlayers, { id: Date.now(), name: `Player ${calcPlayers.length + 1}`, joinTime: '19:00', leaveTime: '21:00' }]);
  };

  const removeCalcPlayer = (id) => {
    setCalcPlayers(calcPlayers.filter(p => p.id !== id));
  };

  const importRosterToCalculator = () => {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length === 0) return alert('ไม่มีผู้เล่นที่ตั้งสถานะพร้อมลงสนามครับ');
    
    const imported = activePlayers.map(p => ({
      id: p.id,
      name: p.name,
      joinTime: '19:00',
      leaveTime: '21:00'
    }));
    setCalcPlayers(imported);
  };

  // ==========================================
  // 8. REUSABLE COMPONENTS & UI RENDER
  // ==========================================
  const TabButton = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap
        ${activeTab === id 
          ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' 
          : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200/50'}`}
    >
      <Icon size={16} className={activeTab === id ? "text-indigo-600 sm:w-[18px] sm:h-[18px]" : "sm:w-[18px] sm:h-[18px]"} />
      {label}
    </button>
  );

  const SidebarButton = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => {
        setActiveTab(id);
        setIsSidebarOpen(false);
      }}
      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all w-full text-left
        ${activeTab === id 
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' 
          : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-transparent'}`}
    >
      <Icon size={20} className={activeTab === id ? "text-indigo-600" : "text-slate-400"} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-20 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* --- SIDEBAR OVERLAY & MENU --- */}
      <div 
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <div 
        className={`fixed top-0 left-0 h-full w-72 md:w-80 bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2.5 rounded-xl shadow-md">
              <Swords size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Badminton Pro</h2>
              <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${dbStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {dbStatus === 'online' ? <Wifi size={12}/> : <WifiOff size={12}/>}
                {dbStatus === 'online' ? 'Aiven Connected' : 'Offline Mode'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors active:scale-95 bg-slate-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-2 pb-1">Menu</h3>
          <SidebarButton id="matchmaking" icon={Activity} label="ระบบจัดทีม (Matchmaking)" />
          <SidebarButton id="history" icon={History} label="ประวัติย้อนหลัง (History)" />
          <SidebarButton id="calculator" icon={DollarSign} label="บิลค่าสนาม (Calculator)" />
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 text-center">
           <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Version 8.0 Aiven Polling</p>
        </div>
      </div>

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <div className="flex flex-row items-center justify-between py-3 sm:py-4">
            
            {/* Left Section: Menu Toggle + Logo */}
            <div className="flex items-center gap-3 sm:gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:bg-slate-200"
              >
                <Menu size={24} />
              </button>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-indigo-500/30 shadow-lg relative">
                  <Swords size={20} className="sm:w-6 sm:h-6" />
                  <div className={`absolute -top-1 -right-1 w-3 h-3 border-2 border-white rounded-full ${dbStatus === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-indigo-900 to-slate-800 bg-clip-text text-transparent">Badminton Pro</h1>
                  <p className={`hidden sm:flex text-[10px] sm:text-[11px] font-bold uppercase tracking-wider items-center gap-1.5 ${dbStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                    {dbStatus === 'checking' ? 'Connecting DB...' : (dbStatus === 'online' ? 'Aiven Connected' : 'Offline Mode')}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="hidden md:flex gap-1.5 sm:gap-2 bg-slate-100 p-1 sm:p-1.5 rounded-2xl w-max">
              <TabButton id="matchmaking" icon={Activity} label="ระบบจัดทีม" />
              <TabButton id="history" icon={History} label="ประวัติย้อนหลัง" />
              <TabButton id="calculator" icon={DollarSign} label="บิลค่าสนาม" />
            </div>

          </div>
        </div>
      </header>

      {/* --- WARNING BANNER (Offline) --- */}
      {dbStatus === 'offline' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-center text-rose-600 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
          <WifiOff size={16} /> กำลังใช้งานโหมดความจำในเครื่องชั่วคราว (หาเซิร์ฟเวอร์ Aiven ไม่เจอ)
        </div>
      )}

      <main className="max-w-6xl mx-auto mt-4 sm:mt-6 px-4 lg:px-8">
        
        {/* ========================================= */}
        {/* VIEW 1: MATCHMAKING & ROSTER */}
        {/* ========================================= */}
        {activeTab === 'matchmaking' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              
              {/* --- ซ้าย: จัดการรายชื่อ (Roster Panel) --- */}
              <div className="lg:col-span-4 lg:sticky lg:top-28 space-y-5 sm:space-y-6">
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <h2 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500"/> รายชื่อผู้เล่น
                    </h2>
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full border border-indigo-100">
                      {players.filter(p=>p.isActive).length} พร้อมเล่น
                    </span>
                  </div>
                  
                  {/* Input เพิ่มผู้เล่น */}
                  <div className="flex gap-2 mb-5 sm:mb-6">
                    <input 
                      value={newPlayerName} 
                      onChange={(e) => setNewPlayerName(e.target.value)} 
                      onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                      placeholder="พิมพ์ชื่อ..." 
                      className="flex-1 bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium" 
                    />
                    <button onClick={addPlayer} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 sm:p-3 rounded-2xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center">
                      <UserPlus size={18} className="sm:w-5 sm:h-5"/>
                    </button>
                  </div>

                  {/* List ผู้เล่น */}
                  <div className="space-y-2.5 sm:space-y-3 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                    {players.length === 0 && (
                      <div className="text-center py-8 sm:py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Users className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mx-auto mb-2"/>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium">เพิ่มผู้เล่นคนแรกเลย</p>
                      </div>
                    )}
                    
                    {players.sort((a,b) => b.mmr - a.mmr).map((p) => (
                      <div 
                        key={p.id} 
                        className={`group flex justify-between items-center p-3 sm:p-3.5 rounded-2xl transition-all duration-200 border
                        ${p.isActive 
                          ? 'bg-white border-slate-200 shadow-sm hover:border-indigo-300' 
                          : 'bg-slate-50 border-transparent opacity-60 grayscale-[50%]'}`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <button 
                            onClick={() => togglePlayerActive(p.id)}
                            className="focus:outline-none transition-transform active:scale-95"
                          >
                            {p.isActive 
                              ? <CheckCircle2 className="text-emerald-500 w-5 h-5 sm:w-6 sm:h-6 fill-emerald-50" /> 
                              : <Circle className="text-slate-300 w-5 h-5 sm:w-6 sm:h-6" />
                            }
                          </button>
                          <div className="flex flex-col">
                            <span className={`text-xs sm:text-sm ${p.isActive ? 'font-bold text-slate-800' : 'font-semibold text-slate-500 line-through decoration-slate-300'}`}>
                              {p.name}
                            </span>
                            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide">
                              W {p.win} · L {p.lose}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] sm:text-xs font-bold bg-slate-100 text-indigo-700 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg border border-slate-200/60">
                              {p.mmr}
                            </span>
                          </div>
                          <button onClick={() => removePlayer(p.id)} className="text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-md">
                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100 text-center">
                    <button onClick={resetRoster} className="text-[10px] sm:text-[11px] text-slate-400 hover:text-red-500 font-medium underline underline-offset-2 transition-colors">
                      ล้างข้อมูลผู้เล่นทั้งหมด
                    </button>
                  </div>
                </div>
              </div>

              {/* --- ขวา: ลานประลอง (Arena & Settings) --- */}
              <div className="lg:col-span-8 space-y-5 sm:space-y-6">
                
                {/* แผงควบคุม (Settings) */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] sm:text-[13px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Swords size={14} className="text-indigo-500"/> จำนวนสนาม
                      </label>
                      <select 
                        disabled={matchSession !== null}
                        value={numCourts} 
                        onChange={(e) => setNumCourts(Number(e.target.value))}
                        className="w-full p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm font-medium text-slate-700 disabled:opacity-50 transition-all appearance-none"
                      >
                        {[1,2,3,4,5].map(n => (
                          <option key={n} value={n}>{n} สนาม (สูงสุด {n*4} คน)</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[12px] sm:text-[13px] font-bold text-slate-600 flex items-center gap-1.5">
                        <Settings size={14} className="text-indigo-500"/> โหมดการจับคู่
                      </label>
                      <select 
                        disabled={matchSession !== null}
                        value={matchMode} 
                        onChange={(e) => setMatchMode(e.target.value)}
                        className="w-full p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm font-medium text-slate-700 disabled:opacity-50 transition-all appearance-none"
                      >
                        <option value="winner_stays">👑 แชมป์อยู่ต่อ (สลับผู้ท้าชิง)</option>
                        <option value="balanced">🔄 สุ่มใหม่ทุกรอบ (กระจายคู่)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-slate-100 flex justify-end">
                    {!matchSession ? (
                      <button 
                        onClick={handleStartSession} 
                        className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2 transform active:scale-95"
                      >
                        <Play size={16} fill="currentColor" className="sm:w-[18px] sm:h-[18px]" /> เริ่มเซสชันการแข่ง
                      </button>
                    ) : (
                      <button 
                        onClick={endSession} 
                        className="w-full sm:w-auto bg-white border border-red-200 text-red-500 hover:bg-red-50 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                      >
                        <StopCircle size={16} className="sm:w-[18px] sm:h-[18px]" /> ยุติการแข่งขัน
                      </button>
                    )}
                  </div>
                </div>

                {/* สนามแข่ง (Arena) */}
                {!matchSession ? (
                   <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 p-8 sm:p-16 rounded-3xl flex flex-col items-center justify-center text-center">
                     <div className="bg-white p-3 sm:p-4 rounded-full shadow-sm mb-3 sm:mb-4">
                        <Swords className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-300" />
                     </div>
                     <h3 className="font-bold text-base sm:text-lg text-slate-700 mb-1">ยังไม่มีการจับคู่</h3>
                     <p className="text-xs sm:text-sm text-slate-500 max-w-sm">เลือกผู้เล่นที่พร้อมลงสนามทางซ้ายมือ ปรับตั้งค่าสนาม แล้วกด "เริ่มเซสชันการแข่ง"</p>
                   </div>
                ) : (
                  <div className="bg-[#0B1120] rounded-[2rem] shadow-2xl p-5 sm:p-6 lg:p-8 relative overflow-hidden border border-slate-800">
                    {/* Background Effects */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 sm:pb-6 mb-5 sm:mb-6 border-b border-white/10 relative z-10 gap-3 sm:gap-4">
                      <div>
                        <h3 className="font-black text-white text-lg sm:text-xl flex items-center gap-2 tracking-wide">
                          <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500"></span>
                          </span>
                          LIVE ARENA
                        </h3>
                        <p className="text-indigo-200/60 text-xs sm:text-sm mt-1 font-medium">
                          {matchSession.mode === 'winner_stays' ? 'โหมด: แชมป์อยู่ต่อ' : 'โหมด: สลับใหม่ทุกรอบ'}
                        </p>
                      </div>
                      <span className="bg-white/5 backdrop-blur-md text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border border-white/10 flex items-center gap-1.5 sm:gap-2 w-max">
                        <Swords size={14} className="text-indigo-400 sm:w-4 sm:h-4"/> {matchSession.courts.length} สนามทำงาน
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 sm:gap-6 relative z-10">
                      {matchSession.courts.map((court) => (
                        <div key={court.id} className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col">
                          
                          <div className="flex justify-between items-center mb-4 sm:mb-5">
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs font-black tracking-widest uppercase px-2.5 sm:px-3 py-1 rounded-md sm:rounded-lg border border-indigo-500/30">
                              Court {court.id}
                            </span>
                            {court.finished && (
                              <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 sm:px-2.5 py-1 rounded-md sm:rounded-lg uppercase flex items-center gap-1">
                                <CheckCircle2 size={10} className="sm:w-3 sm:h-3"/> Match Ended
                              </span>
                            )}
                          </div>

                          <div className="flex-1 flex flex-col space-y-3 sm:space-y-4">
                            
                            {/* Team 1 (Top) */}
                            <div className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${court.finished ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20 hover:border-indigo-500/40'}`}>
                              <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                                {court.team1.map(p => (
                                  <div key={p.id} className="flex justify-between items-center">
                                    <span className="font-bold text-white text-xs sm:text-sm">{p.name}</span>
                                    <span className="text-[9px] sm:text-[10px] font-mono bg-white/10 text-indigo-200 px-1.5 sm:px-2 py-0.5 rounded-md">{getPlayerLatest(p.id).mmr}</span>
                                  </div>
                                ))}
                              </div>
                              {!court.finished && (
                                <button onClick={() => recordResult(court.id, 1)} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex justify-center items-center gap-1.5 sm:gap-2">
                                  <Award size={12} className="sm:w-3.5 sm:h-3.5" /> ทีมบนชนะ
                                </button>
                              )}
                            </div>

                            {/* VS Divider */}
                            <div className="relative flex items-center justify-center h-2">
                               <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                               <span className="bg-[#0B1120] text-slate-500 text-[9px] sm:text-[10px] font-black italic px-2 z-10 border border-white/5 rounded-full py-0.5">VS</span>
                            </div>

                            {/* Team 2 (Bottom) */}
                            <div className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${court.finished ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/20 hover:border-rose-500/40'}`}>
                              <div className="flex flex-col gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                                {court.team2.map(p => (
                                  <div key={p.id} className="flex justify-between items-center">
                                    <span className="font-bold text-white text-xs sm:text-sm">{p.name}</span>
                                    <span className="text-[9px] sm:text-[10px] font-mono bg-white/10 text-rose-200 px-1.5 sm:px-2 py-0.5 rounded-md">{getPlayerLatest(p.id).mmr}</span>
                                  </div>
                                ))}
                              </div>
                              {!court.finished && (
                                <button onClick={() => recordResult(court.id, 2)} className="w-full bg-rose-500 hover:bg-rose-400 text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-bold text-[11px] sm:text-xs shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex justify-center items-center gap-1.5 sm:gap-2">
                                  <Award size={12} className="sm:w-3.5 sm:h-3.5" /> ทีมล่างชนะ
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Waiting Queue */}
                    {matchSession.waitingPairs && matchSession.waitingPairs.length > 0 && (
                      <div className="mt-5 sm:mt-6 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 relative z-10">
                        <h4 className="font-bold text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                          <Clock size={12} className="sm:w-3.5 sm:h-3.5" /> คิวรอเสียบสนามถัดไป ({matchSession.waitingPairs.length} คู่)
                        </h4>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {matchSession.waitingPairs.map((pair, idx) => (
                            <div key={idx} className="bg-black/40 border border-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                              <span className="font-bold text-white">{pair[0].name}</span>
                              <span className="text-slate-500 text-[10px] sm:text-xs px-0.5 sm:px-1">+</span>
                              <span className="font-bold text-white">{pair[1].name}</span>
                              {idx === 0 && <span className="ml-1.5 sm:ml-2 bg-emerald-500 text-emerald-950 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black">NEXT</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Start Next Round Button */}
                    {isAllCourtsFinished && (
                      <button 
                        onClick={handleStartSession} 
                        className="w-full mt-5 sm:mt-6 bg-white text-[#0B1120] py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all flex justify-center items-center gap-2"
                      >
                        <RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" /> เริ่มจับคู่รอบต่อไป
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 2: MATCH HISTORY */}
        {/* ========================================= */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
              <div className="flex flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Match History</h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1">ประวัติการแข่งขันและการปรับ MMR ระดับบุคคล</p>
                </div>
                {matchHistory.length > 0 && (
                  <button onClick={clearHistory} className="text-[10px] sm:text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold transition-colors whitespace-nowrap">
                    ล้างประวัติ
                  </button>
                )}
              </div>

              {matchHistory.length === 0 ? (
                <div className="py-16 sm:py-20 text-center text-slate-400 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100">
                  <History className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base font-medium">ยังไม่มีประวัติการแข่งขัน</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {matchHistory.map((match) => (
                    <div key={match.id} className="group bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col md:flex-row gap-4 sm:gap-6">
                      
                      {/* Meta Info */}
                      <div className="md:w-1/4 flex flex-row md:flex-col justify-between md:justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md w-max mb-1.5 uppercase">{match.id}</span>
                          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{match.date}</span>
                        </div>
                        <span className="text-[11px] sm:text-xs text-slate-400 text-right md:text-left self-end md:self-auto md:mt-1">{match.matchDetails}</span>
                      </div>
                      
                      {/* Teams & Score */}
                      <div className="flex-1 grid grid-cols-2 gap-3 sm:gap-4 items-center relative">
                        {/* Winner */}
                        <div className="bg-emerald-50/50 p-2.5 sm:p-3 rounded-xl border border-emerald-100 relative">
                          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm"><Trophy size={10} className="sm:w-3 sm:h-3"/></div>
                          <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase mb-1.5 sm:mb-2 tracking-wider">Winner</p>
                          {match.team1.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs sm:text-sm mb-1.5 last:mb-0">
                              <span className="font-bold text-slate-700">{p.name}</span>
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200/50">{p.change || '+15'}</span>
                            </div>
                          ))}
                        </div>

                        {/* Loser */}
                        <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase mb-1.5 sm:mb-2 tracking-wider">Loser</p>
                          {match.team2.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs sm:text-sm mb-1.5 last:mb-0">
                              <span className="font-medium text-slate-600">{p.name}</span>
                              <span className="text-[10px] font-black text-rose-500 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200/50">{p.change || '-10'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* VIEW 3: CALCULATOR */}
        {/* ========================================= */}
        {activeTab === 'calculator' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              
              <div className="p-5 sm:p-6 md:p-8 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
                      <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" />
                      ระบบหารค่าสนาม (Pro-Rata)
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1.5 sm:mt-2 max-w-md">
                      คำนวณเงินตาม "นาทีที่เล่นจริง" เพื่อความยุติธรรมสำหรับคนที่มาไม่พร้อมกัน
                    </p>
                  </div>
                  <button 
                    onClick={importRosterToCalculator}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-md transition-all flex items-center justify-center gap-2 border border-white/10"
                  >
                    <Users size={14} className="sm:w-4 sm:h-4"/> ดึงชื่อคนพร้อมเล่น ({players.filter(p=>p.isActive).length})
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
                  
                  {/* Left: Input */}
                  <div className="lg:col-span-5 space-y-6 sm:space-y-8">
                    
                    {/* Bill Settings */}
                    <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base mb-4 sm:mb-5 flex items-center gap-2"><Settings size={16} className="text-indigo-500 sm:w-[18px] sm:h-[18px]"/> ค่าใช้จ่ายรวม</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="relative">
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 mb-1.5 uppercase">ค่าสนาม (บาท)</label>
                            <input 
                              type="number" 
                              value={calcFees.court} 
                              onChange={(e) => setCalcFees({...calcFees, court: e.target.value})}
                              className="w-full pl-3 sm:pl-4 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-bold font-mono text-sm sm:text-base transition-all"
                            />
                            <span className="absolute right-3 sm:right-4 bottom-2.5 sm:bottom-3 text-slate-400 font-bold text-xs sm:text-base">฿</span>
                          </div>
                          <div className="relative">
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 mb-1.5 uppercase">ค่าลูกแบด (บาท)</label>
                            <input 
                              type="number" 
                              value={calcFees.shuttlecock} 
                              onChange={(e) => setCalcFees({...calcFees, shuttlecock: e.target.value})}
                              className="w-full pl-3 sm:pl-4 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-bold font-mono text-sm sm:text-base transition-all"
                            />
                            <span className="absolute right-3 sm:right-4 bottom-2.5 sm:bottom-3 text-slate-400 font-bold text-xs sm:text-base">฿</span>
                          </div>
                        </div>
                        <div className="pt-4 sm:pt-5 mt-2 border-t border-slate-200 flex justify-between items-end">
                          <span className="text-xs sm:text-sm font-bold text-slate-500">ยอดรวมทั้งหมด</span>
                          <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                            {Number(calcFees.court) + Number(calcFees.shuttlecock)} <span className="text-sm sm:text-lg">฿</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add Player Times */}
                    <div>
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2"><Clock size={16} className="text-indigo-500 sm:w-[18px] sm:h-[18px]"/> ผู้เล่นและเวลา</h3>
                        <button onClick={addCalcPlayer} className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-colors">
                          + เพิ่มคน
                        </button>
                      </div>
                      
                      <div className="space-y-2.5 sm:space-y-3 max-h-[350px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                        {calcPlayers.map((player, index) => (
                          <div key={player.id} className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm relative group">
                            <button onClick={() => removeCalcPlayer(player.id)} className="absolute -top-1.5 sm:-top-2 -right-1.5 sm:-right-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 p-1 sm:p-1.5 rounded-full shadow-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={10} className="sm:w-3 sm:h-3" />
                            </button>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div className="col-span-2">
                                <input 
                                  type="text" 
                                  value={player.name} 
                                  onChange={(e) => updateCalcPlayerTime(index, 'name', e.target.value)}
                                  placeholder="ชื่อผู้เล่น"
                                  className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1 ml-1">เวลาเข้า</label>
                                <input 
                                  type="time" 
                                  value={player.joinTime} 
                                  onChange={(e) => updateCalcPlayerTime(index, 'joinTime', e.target.value)}
                                  className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono focus:border-indigo-500 outline-none" 
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1 ml-1">เวลาออก</label>
                                <input 
                                  type="time" 
                                  value={player.leaveTime} 
                                  onChange={(e) => updateCalcPlayerTime(index, 'leaveTime', e.target.value)}
                                  className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono focus:border-indigo-500 outline-none" 
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Right: Results (Responsive Flex List) */}
                  <div className="lg:col-span-7">
                    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                          <ChevronRight className="text-indigo-500 w-4 h-4 sm:w-5 sm:h-5"/> สรุปยอดโอน
                        </h3>
                      </div>
                      
                      {/* Responsive List Container */}
                      <div className="flex-1 overflow-hidden">
                        
                        {/* Table Header */}
                        <div className="hidden sm:flex items-center justify-between p-4 border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider bg-white">
                           <div className="flex-[2]">ผู้เล่น</div>
                           <div className="flex-[1.5] text-center">เวลาเล่นจริง</div>
                           <div className="flex-[1.5] text-right">ยอดที่ต้องจ่าย</div>
                        </div>

                        {/* Data Rows */}
                        <div className="flex flex-col divide-y divide-slate-50">
                          {calcResults.length === 0 ? (
                            <div className="p-8 sm:p-10 text-center text-slate-400 text-xs sm:text-sm">
                              เพิ่มข้อมูลด้านซ้ายเพื่อดูผลลัพธ์
                            </div>
                          ) : calcResults.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50/50 transition-colors gap-2">
                              
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-[2] min-w-0">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] sm:text-xs font-bold uppercase border border-indigo-200 shrink-0">
                                  {result.name.substring(0, 2)}
                                </div>
                                <span className="font-bold text-slate-700 text-sm sm:text-base truncate">{result.name}</span>
                              </div>
                              
                              <div className="flex-[1.5] text-center shrink-0">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium border border-slate-200 whitespace-nowrap">
                                  {result.minutesPlayed} นาที
                                </span>
                              </div>
                              
                              <div className="flex-[1.5] text-right shrink-0">
                                <span className="font-black text-emerald-600 text-base sm:text-lg tracking-tight">
                                  {result.feeToPay} <span className="text-[10px] sm:text-xs font-bold text-emerald-400">฿</span>
                                </span>
                              </div>
                              
                            </div>
                          ))}
                        </div>

                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Custom Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
}
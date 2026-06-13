import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, RefreshCw, Trophy, DollarSign, Swords, 
  Clock, Trash2, History, Settings, Play, StopCircle, 
  CheckCircle2, Circle, ChevronRight, Activity, Award,
  Menu, X, Wifi, WifiOff, AlertCircle, RotateCcw, Copy, ArrowLeftRight,
  TrendingUp, Hash, Sparkles
} from 'lucide-react';

// ==========================================
// 0. API CONFIG
// ==========================================
const API_BASE_URL = '/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('matchmaking');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('checking');

  // ==========================================
  // 1. UI STATES (Toast & Modal)
  // ==========================================
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [swapData, setSwapData] = useState(null);
  const [scoreModal, setScoreModal] = useState(null); 
  const [scoreInput, setScoreInput] = useState({ t1: '', t2: '' });

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const requestConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });

  // ==========================================
  // 2. DATA STATES
  // ==========================================
  const [players, setPlayers] = useState(() => {
    const localData = localStorage.getItem('badminton_players_v13');
    return localData ? JSON.parse(localData) : [
      { id: '1', name: 'A', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
      { id: '2', name: 'B', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
      { id: '3', name: 'C', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
      { id: '4', name: 'D', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
      { id: '5', name: 'E', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
      { id: '6', name: 'F', mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 },
    ];
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [numCourts, setNumCourts] = useState(2);
  const [matchMode, setMatchMode] = useState('winner_stays');
  
  const [matchSession, setMatchSession] = useState(() => {
    const local = localStorage.getItem('badminton_session_v13');
    return local ? JSON.parse(local) : null;
  });

  const [matchHistory, setMatchHistory] = useState(() => {
    const local = localStorage.getItem('badminton_history_v13');
    return local ? JSON.parse(local) : [];
  });

  const [undoSnapshot, setUndoSnapshot] = useState(null); 

  const [calcFees, setCalcFees] = useState({ court: 120, shuttlecock: 0 });
  const [calcPlayers, setCalcPlayers] = useState([]);
  const [calcResults, setCalcResults] = useState([]);
  const [globalLeaveTime, setGlobalLeaveTime] = useState('21:00'); 

  // ==========================================
  // 3. API SYNC FUNCTIONS
  // ==========================================
  const fetchFromServer = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.players) setPlayers(data.players);
        if (data.history) setMatchHistory(data.history);
        if (data.session !== undefined) setMatchSession(data.session);
        setDbStatus('online');
      } else { setDbStatus('offline'); }
    } catch (error) { setDbStatus('offline'); }
  }, []);

  useEffect(() => {
    fetchFromServer();
    const interval = setInterval(fetchFromServer, 3000);
    return () => clearInterval(interval);
  }, [fetchFromServer]);

  const updateGlobalState = async (newPlayers, newHistory, newSession) => {
    if (newPlayers) setPlayers(newPlayers);
    if (newHistory) setMatchHistory(newHistory);
    if (newSession !== undefined) setMatchSession(newSession);

    if (newPlayers) localStorage.setItem('badminton_players_v13', JSON.stringify(newPlayers));
    if (newHistory) localStorage.setItem('badminton_history_v13', JSON.stringify(newHistory));
    if (newSession !== undefined) localStorage.setItem('badminton_session_v13', JSON.stringify(newSession));

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
      } catch (e) { console.error("Failed to push update to Aiven"); }
    }
  };

  const getPlayerLatest = (id) => players.find(p => p.id === String(id)) || { mmr: 0, name: 'Unknown', playCount: 0 };

  const getBestPartner = (playerName) => {
    const partnerCounts = {};
    matchHistory.forEach(match => {
      const isInWinningTeam = match.team1 && match.team1.some(p => p.name === playerName);
      if (isInWinningTeam && match.team1.length === 2) {
        const partner = match.team1.find(p => p.name !== playerName);
        if (partner) partnerCounts[partner.name] = (partnerCounts[partner.name] || 0) + 1;
      }
    });

    if (Object.keys(partnerCounts).length === 0) return "-";
    let bestPartner = "-"; let maxWins = 0;
    for (const [partner, wins] of Object.entries(partnerCounts)) {
      if (wins > maxWins) { maxWins = wins; bestPartner = partner; }
    }
    return `${bestPartner} (${maxWins}W)`;
  };

  // ==========================================
  // 4. LOCK LOGIC & MATCHMAKING
  // ==========================================
  const isPlayerInMatch = (id) => {
    if (!matchSession) return false;
    const strId = String(id);
    const inCourts = matchSession.courts.some(c => !c.finished && (c.team1.some(p => String(p.id) === strId) || c.team2.some(p => String(p.id) === strId)));
    const inQueue = matchSession.waitingQueue?.some(p => String(p.id) === strId);
    return inCourts || inQueue;
  };

  const handleStartSession = () => {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length < 4) return showToast('ต้องมีผู้เล่นที่ "พร้อมลงสนาม" อย่างน้อย 4 คนขึ้นไปครับ', 'error');
    
    const sortedActive = [...activePlayers].sort((a, b) => {
      const countA = a.playCount || 0;
      const countB = b.playCount || 0;
      if (countA !== countB) return countA - countB;
      return Math.random() - 0.5;
    });

    const numToPlay = Math.min(sortedActive.length - (sortedActive.length % 4), numCourts * 4);
    if (numToPlay === 0) return showToast('จำนวนผู้เล่นไม่พอที่จะจับคู่ลงสนามได้อย่างน้อย 1 สนาม', 'error');

    const selectedToPlay = sortedActive.slice(0, numToPlay);
    const waitingPlayersQueue = sortedActive.slice(numToPlay);

    selectedToPlay.sort((a, b) => b.mmr - a.mmr);

    const pairs = [];
    const half = selectedToPlay.length / 2;
    for (let i = 0; i < half; i++) pairs.push([selectedToPlay[i], selectedToPlay[selectedToPlay.length - 1 - i]]);
    
    const courts = [];
    const actualCourts = pairs.length / 2;
    for (let i = 0; i < actualCourts; i++) {
      courts.push({ id: i + 1, team1: pairs[i], team2: pairs[pairs.length - 1 - i], finished: false, winnerIndex: null });
    }

    setUndoSnapshot(null); 
    updateGlobalState(null, null, { mode: matchMode, courts: courts, waitingQueue: waitingPlayersQueue, round: 1 });
    showToast('จัดทีมเริ่มเซสชันสำเร็จ!', 'success');
  };

  const executeSwapPlayer = (newPlayer) => {
    if (!matchSession || !swapData) return;
    setUndoSnapshot({ players: JSON.parse(JSON.stringify(players)), history: JSON.parse(JSON.stringify(matchHistory)), session: JSON.parse(JSON.stringify(matchSession)) });

    const nextSession = { ...matchSession, waitingQueue: [...(matchSession.waitingQueue || [])] };
    const cIdx = nextSession.courts.findIndex(c => c.id === swapData.courtId);
    if (cIdx === -1) return;

    const teamKey = swapData.teamIndex === 1 ? 'team1' : 'team2';
    nextSession.courts[cIdx][teamKey] = nextSession.courts[cIdx][teamKey].map(p => p.id === swapData.oldPlayer.id ? newPlayer : p);

    nextSession.waitingQueue = nextSession.waitingQueue.filter(p => p.id !== newPlayer.id);
    nextSession.waitingQueue.push(swapData.oldPlayer);

    updateGlobalState(null, null, nextSession);
    setSwapData(null);
    showToast(`เปลี่ยนตัว ${newPlayer.name} ลงแทน ${swapData.oldPlayer.name} เรียบร้อย`, 'success');
  };

  const handleScoreSubmit = () => {
    const s1 = parseInt(scoreInput.t1);
    const s2 = parseInt(scoreInput.t2);
    
    if (isNaN(s1) || isNaN(s2)) return showToast('กรุณากรอกคะแนนให้ครบทั้งสองทีม', 'error');
    if (s1 < 0 || s2 < 0) return showToast('คะแนนห้ามติดลบ', 'error');
    if (s1 === s2) return showToast('แบดมินตันไม่มีเสมอ กรุณาระบุผู้ชนะ', 'error');

    const winnerIndex = s1 > s2 ? 1 : 2;
    recordResult(scoreModal.id, winnerIndex, s1, s2);
    setScoreModal(null);
  };

  const recordResult = (courtId, winnerTeamIndex, score1, score2) => {
    if (!matchSession) return;
    const targetCourt = matchSession.courts.find(c => c.id === courtId);
    if (!targetCourt) return;

    setUndoSnapshot({ players: JSON.parse(JSON.stringify(players)), history: JSON.parse(JSON.stringify(matchHistory)), session: JSON.parse(JSON.stringify(matchSession)) });

    const winningTeam = winnerTeamIndex === 1 ? targetCourt.team1 : targetCourt.team2;
    const losingTeam = winnerTeamIndex === 1 ? targetCourt.team2 : targetCourt.team1;
    
    const winnerScore = winnerTeamIndex === 1 ? score1 : score2;
    const loserScore = winnerTeamIndex === 1 ? score2 : score1;
    const scoreDiff = Math.abs(winnerScore - loserScore);

    const scoreBonus = Math.max(0, Math.round((scoreDiff - 2) / 3)); 

    const getAvgMmr = (team) => team.reduce((sum, p) => sum + getPlayerLatest(p.id).mmr, 0) / team.length;
    const winAvg = getAvgMmr(winningTeam);
    const loseAvg = getAvgMmr(losingTeam);

    const mmrChanges = {};

    winningTeam.forEach(p => {
       const partner = winningTeam.find(x => x.id !== p.id);
       const myMmr = getPlayerLatest(p.id).mmr;
       const partnerMmr = partner ? getPlayerLatest(partner.id).mmr : myMmr;
       let gain = 15;

       const diffWithPartner = partnerMmr - myMmr;
       gain += Math.round(diffWithPartner / 10); 
       const teamDiff = loseAvg - winAvg;
       gain += Math.round(teamDiff / 10); 
       gain += scoreBonus; 

       mmrChanges[p.id] = Math.max(5, Math.min(30, gain));
    });

    losingTeam.forEach(p => {
       const partner = losingTeam.find(x => x.id !== p.id);
       const myMmr = getPlayerLatest(p.id).mmr;
       const partnerMmr = partner ? getPlayerLatest(partner.id).mmr : myMmr;
       let drop = 10; 

       const diffWithPartnerLose = partnerMmr - myMmr;
       drop += Math.round(diffWithPartnerLose / 10); 
       const teamDiffLose = winAvg - loseAvg;
       drop -= Math.round(teamDiffLose / 10); 
       drop += scoreBonus; 

       mmrChanges[p.id] = -Math.max(5, Math.min(30, drop)); 
    });

    const updatedPlayers = players.map(p => {
      const pId = String(p.id);
      const isWinner = winningTeam.some(w => String(w.id) === pId);
      const isLoser = losingTeam.some(l => String(l.id) === pId);
      if (isWinner || isLoser) {
         return { ...p, win: isWinner ? p.win + 1 : p.win, lose: isLoser ? p.lose + 1 : p.lose, mmr: Math.max(10, p.mmr + mmrChanges[p.id]), playCount: (p.playCount || 0) + 1 };
      }
      return p;
    });
    
    const historyId = `M${Date.now().toString().slice(-4)}-C${courtId}`;
    const newRecord = {
      id: historyId, timestamp: Date.now(),
      date: new Date().toLocaleString('th-TH', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }),
      scoreText: `${winnerScore} - ${loserScore}`, 
      team1: winningTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr, change: `+${mmrChanges[p.id]}` })),
      team2: losingTeam.map(p => ({ name: p.name, mmr: getPlayerLatest(p.id).mmr, change: `${mmrChanges[p.id]}` })),
      winnerLabel: winnerTeamIndex === 1 ? 'TEAM A' : 'TEAM B', matchDetails: `สนามที่ ${courtId} • ${matchSession.mode === 'winner_stays' ? 'แชมป์อยู่ต่อ' : 'สลับคู่'}`
    };

    const nextState = { ...matchSession, waitingQueue: [...(matchSession.waitingQueue || [])] };
    const cIdx = nextState.courts.findIndex(c => c.id === courtId);

    if (nextState.mode === 'winner_stays') {
      let nextChallengerTeam = null;
      let currentQueue = nextState.waitingQueue;

      currentQueue.sort((a, b) => (getPlayerLatest(a.id).playCount || 0) - (getPlayerLatest(b.id).playCount || 0));

      if (currentQueue.length >= 2) {
        nextChallengerTeam = [currentQueue.shift(), currentQueue.shift()];
        currentQueue.push(...losingTeam);
      } else if (currentQueue.length === 1) {
        const leftoverPlayer = currentQueue.shift();
        const sortedLosers = [...losingTeam].sort((a, b) => {
          const countDiff = (getPlayerLatest(b.id).playCount || 0) - (getPlayerLatest(a.id).playCount || 0);
          if (countDiff !== 0) return countDiff;
          return getPlayerLatest(b.id).mmr - getPlayerLatest(a.id).mmr;
        });
        nextChallengerTeam = [leftoverPlayer, sortedLosers[1]];
        currentQueue.push(sortedLosers[0]);
      } else {
        nextChallengerTeam = losingTeam;
      }

      nextState.courts[cIdx] = { ...nextState.courts[cIdx], team1: winningTeam, team2: nextChallengerTeam, finished: false, winnerIndex: null };
    } else {
      nextState.courts[cIdx].finished = true;
      nextState.courts[cIdx].winnerIndex = winnerTeamIndex;
    }

    updateGlobalState(updatedPlayers, [newRecord, ...matchHistory], nextState);
    showToast(`บันทึกผลสนาม ${courtId} แล้ว (${winnerScore}-${loserScore})`, 'success');
  };

  const undoLastMatch = () => {
    if (!undoSnapshot) return;
    requestConfirm('คุณต้องการย้อนกลับผลการแข่งขันและการจัดคิวล่าสุดใช่หรือไม่?', () => {
      updateGlobalState(undoSnapshot.players, undoSnapshot.history, undoSnapshot.session);
      setUndoSnapshot(null);
      showToast('ย้อนกลับผลแมตช์ล่าสุดเรียบร้อย', 'success');
    });
  };

  const endSession = () => requestConfirm('ยืนยันการปิดเซสชันการแข่งปัจจุบัน?', () => { updateGlobalState(null, null, null); setUndoSnapshot(null); showToast('ยุติการแข่งขันแล้ว', 'success'); });
  const isAllCourtsFinished = matchSession && matchSession.mode === 'balanced' && matchSession.courts.every(c => c.finished);

  // ==========================================
  // 5. Player Management & Re-Rank
  // ==========================================
  const addPlayer = () => {
    if (!newPlayerName) return;
    if (players.some(p => p.name.trim().toLowerCase() === newPlayerName.trim().toLowerCase())) return showToast('ชื่อนี้มีอยู่ในระบบแล้วครับ', 'error');
    updateGlobalState([...players, { id: Date.now().toString(), name: newPlayerName.trim(), mmr: 100, win: 0, lose: 0, isActive: true, playCount: 0 }], null, undefined);
    setNewPlayerName('');
    showToast(`เพิ่มผู้เล่นเรียบร้อย`, 'success');
  };

  const togglePlayerActive = (id) => {
    if (isPlayerInMatch(id)) return showToast('ไม่สามารถเปลี่ยนสถานะได้ ผู้เล่นกำลังแข่งขันหรือรอคิวอยู่', 'error');
    updateGlobalState(players.map(p => p.id === String(id) ? { ...p, isActive: !p.isActive } : p), null, undefined);
  };

  const removePlayer = (id) => {
    if (isPlayerInMatch(id)) return showToast('ไม่สามารถลบได้ ผู้เล่นกำลังแข่งขันหรือรอคิวอยู่', 'error');
    requestConfirm('ลบผู้เล่นคนนี้ออกจากระบบถาวรใช่หรือไม่?', () => {
      updateGlobalState(players.filter(p => p.id !== String(id)), null, undefined);
      showToast('ลบผู้เล่นออกจากระบบแล้ว', 'success');
    });
  };

  const clearHistory = () => requestConfirm('⚠️ ลบประวัติทั้งหมดถาวร ใช่หรือไม่?', () => { updateGlobalState(null, [], undefined); showToast('ล้างประวัติการแข่งเรียบร้อย', 'success'); });
  
  // 🌟 ฟังก์ชันระบบรีแรงค์ (Soft Reset)
  const handleNewSeason = () => {
    requestConfirm('⚠️ ยืนยันการขึ้นซีซันใหม่ (Re-Rank)?\n\n1. สถิติ ชนะ/แพ้ จะถูกล้างเป็น 0\n2. ประวัติการแข่งจะถูกล้างทั้งหมด\n3. MMR จะถูก "Soft Reset" (ดึงคะแนนเข้าหา 100 เพื่อบีบช่องว่างความห่างให้สูสีขึ้น)\n\nยืนยันการเริ่มฤดูกาลใหม่?', () => {
      const updatedPlayers = players.map(p => ({
        ...p,
        mmr: Math.round((p.mmr + 100) / 2), // สมการ Soft Reset
        win: 0,
        lose: 0,
        playCount: 0
      }));
      updateGlobalState(updatedPlayers, [], null);
      setUndoSnapshot(null);
      showToast('🎉 เริ่มซีซันใหม่เรียบร้อย! ขอให้สนุกกับการไต่แรงค์', 'success');
    });
  };

  // ==========================================
  // 6. Calculator Logic
  // ==========================================
  const calculateDynamicFees = () => {
    const totalExpenses = Number(calcFees.court) + Number(calcFees.shuttlecock);
    let totalPlayedMinutes = 0;
    const getMins = (t) => { if(!t) return 0; const [h, m] = t.split(':').map(Number); return (h * 60) + m; };

    const pm = calcPlayers.map(p => {
      const jMins = getMins(p.joinTime); const lMins = getMins(p.leaveTime);
      const mins = Math.max(0, (lMins < jMins ? lMins + (24 * 60) : lMins) - jMins);
      totalPlayedMinutes += mins; return { ...p, minutesPlayed: mins };
    });

    if (totalPlayedMinutes === 0) return setCalcResults([]);
    setCalcResults(pm.map(p => ({ ...p, feeToPay: (totalExpenses * (p.minutesPlayed / totalPlayedMinutes)).toFixed(2) })));
  };

  useEffect(() => { if (activeTab === 'calculator') calculateDynamicFees(); }, [calcFees, calcPlayers, activeTab]);

  const updateCalcPlayerTime = (index, field, value) => { const np = [...calcPlayers]; np[index][field] = value; setCalcPlayers(np); };
  const addCalcPlayer = () => setCalcPlayers([...calcPlayers, { id: Date.now(), name: `Player ${calcPlayers.length + 1}`, joinTime: '19:00', leaveTime: '21:00' }]);
  const removeCalcPlayer = (id) => setCalcPlayers(calcPlayers.filter(p => p.id !== id));
  
  const importRosterToCalculator = () => {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length === 0) return showToast('ไม่มีผู้เล่นพร้อมลงสนามครับ', 'error');
    setCalcPlayers(activePlayers.map(p => ({ id: p.id, name: p.name, joinTime: '19:00', leaveTime: '21:00' })));
    showToast('ดึงรายชื่อสำเร็จ', 'success');
  };
  const applyGlobalLeaveTime = () => {
    if (!globalLeaveTime || calcPlayers.length === 0) return;
    setCalcPlayers(calcPlayers.map(p => ({ ...p, leaveTime: globalLeaveTime })));
    showToast(`ตั้งเวลาออกทุกคนเป็น ${globalLeaveTime} แล้ว`, 'success');
  };

  // ==========================================
  // 7. UI RENDER COMPONENT
  // ==========================================
  const TabButton = ({ id, icon: Icon, label }) => (
    <button onClick={() => setActiveTab(id)} className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${activeTab === id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200/50'}`}>
      <Icon size={16} className={activeTab === id ? "text-indigo-600" : ""} /> {label}
    </button>
  );

  const SidebarButton = ({ id, icon: Icon, label }) => (
    <button onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all w-full text-left ${activeTab === id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-transparent'}`}>
      <Icon size={20} className={activeTab === id ? "text-indigo-600" : "text-slate-400"} /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans pb-20 selection:bg-indigo-100 selection:text-indigo-900 relative">
      
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 font-bold text-sm ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />} {toast.message}
        </div>
      )}

      {/* 🌟 SCORE INPUT MODAL 🌟 */}
      {scoreModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border-2 border-indigo-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Hash className="text-indigo-500" /> กรอกคะแนน สนาม {scoreModal.id}</h3>
              <button onClick={() => setScoreModal(null)} className="p-1 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={18} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1">TEAM A</span>
                  {scoreModal.team1.map(p => <span key={p.id} className="font-bold text-slate-700 text-sm">{p.name}</span>)}
                </div>
                <input type="number" value={scoreInput.t1} onChange={(e) => setScoreInput({...scoreInput, t1: e.target.value})} placeholder="0" className="w-20 text-center text-2xl font-black bg-white border-2 border-indigo-200 text-indigo-700 p-2 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
              </div>
              
              <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider mb-1">TEAM B</span>
                  {scoreModal.team2.map(p => <span key={p.id} className="font-bold text-slate-700 text-sm">{p.name}</span>)}
                </div>
                <input type="number" value={scoreInput.t2} onChange={(e) => setScoreInput({...scoreInput, t2: e.target.value})} placeholder="0" className="w-20 text-center text-2xl font-black bg-white border-2 border-rose-200 text-rose-700 p-2 rounded-xl outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 transition-all" />
              </div>
            </div>

            <button onClick={handleScoreSubmit} className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white py-3.5 rounded-xl font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95 flex justify-center items-center gap-2">
              <CheckCircle2 size={18} /> บันทึกผลการแข่งขัน
            </button>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><AlertCircle className="text-indigo-500" /> ยืนยันการดำเนินการ</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed whitespace-pre-wrap">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">ยกเลิก</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="px-4 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors">ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {swapData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ArrowLeftRight className="text-indigo-500" /> เปลี่ยนตัวผู้เล่น</h3>
              <button onClick={() => setSwapData(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><X size={18} /></button>
            </div>
            <p className="text-slate-500 text-sm mb-4">เลือกคนที่กำลัง <strong>เข้าคิวรอ</strong> เพื่อไปตีแทน <span className="font-bold text-indigo-600">{swapData.oldPlayer.name}</span></p>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2 mb-6">
              {(!matchSession.waitingQueue || matchSession.waitingQueue.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">ไม่มีผู้เล่นในคิวรอ</div>
              ) : (
                matchSession.waitingQueue.map((p, idx) => (
                  <button key={p.id} onClick={() => executeSwapPlayer(p)} className="w-full text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-3 rounded-xl transition-all flex justify-between items-center group">
                    <span className="font-bold text-slate-700 group-hover:text-indigo-700">{p.name}</span><span className="text-xs font-bold text-indigo-500 bg-indigo-100 px-2 py-1 rounded-lg">เลือกลงแทน</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
      <div className={`fixed top-0 left-0 h-full w-72 md:w-80 bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-2.5 rounded-xl shadow-md"><Swords size={22} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Badminton Pro</h2>
              <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${dbStatus === 'online' ? 'text-emerald-500' : 'text-rose-500'}`}>{dbStatus === 'online' ? <Wifi size={12}/> : <WifiOff size={12}/>}{dbStatus === 'online' ? 'Aiven Connected' : 'Offline Mode'}</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors active:scale-95 bg-slate-50"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-2 pb-1">Menu</h3>
          <SidebarButton id="matchmaking" icon={Activity} label="จัดทีม (Matchmaking)" />
          <SidebarButton id="history" icon={History} label="ประวัติ (History)" />
          <SidebarButton id="stats" icon={TrendingUp} label="สถิติผู้เล่น (Rank)" />
          <SidebarButton id="calculator" icon={DollarSign} label="คิดเงิน (Calculator)" />
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 text-center">
           <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Version 1.0 </p>
        </div>
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 lg:px-8">
          <div className="flex flex-row items-center justify-between py-3 sm:py-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:bg-slate-200"><Menu size={24} /></button>
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
            <div className="hidden md:flex gap-1 sm:gap-2 bg-slate-100 p-1 sm:p-1.5 rounded-2xl w-max">
              <TabButton id="matchmaking" icon={Activity} label="จัดทีม" />
              <TabButton id="history" icon={History} label="ประวัติ" />
              <TabButton id="stats" icon={TrendingUp} label="สถิติ (Rank)" />
              <TabButton id="calculator" icon={DollarSign} label="คิดเงิน" />
            </div>
          </div>
        </div>
      </header>

      {dbStatus === 'offline' && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-center text-rose-600 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
          <WifiOff size={16} /> กำลังใช้งานโหมดความจำในเครื่องชั่วคราว (หาเซิร์ฟเวอร์ Aiven ไม่เจอ)
        </div>
      )}

      <main className="max-w-6xl mx-auto mt-4 sm:mt-6 px-4 lg:px-8">
        
        {/* VIEW 1: MATCHMAKING */}
        {activeTab === 'matchmaking' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 items-start">
              
              <div className="lg:col-span-4 lg:sticky lg:top-28 space-y-5 sm:space-y-6">
                <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
                  <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <h2 className="font-bold text-slate-800 text-base sm:text-lg flex items-center gap-2">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500"/> รายชื่อผู้เล่น
                    </h2>
                    <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-1 rounded-full border border-indigo-100">{players.filter(p=>p.isActive).length} พร้อมเล่น</span>
                  </div>
                  
                  <div className="flex gap-2 mb-5 sm:mb-6">
                    <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addPlayer()} placeholder="พิมพ์ชื่อ..." className="flex-1 bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium" />
                    <button onClick={addPlayer} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 sm:p-3 rounded-2xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center"><UserPlus size={18} className="sm:w-5 sm:h-5"/></button>
                  </div>

                  <div className="space-y-2.5 sm:space-y-3 max-h-[50vh] sm:max-h-[55vh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                    {players.length === 0 && (
                      <div className="text-center py-8 sm:py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Users className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300 mx-auto mb-2"/><p className="text-xs sm:text-sm text-slate-500 font-medium">เพิ่มผู้เล่นคนแรกเลย</p>
                      </div>
                    )}
                    {players.sort((a,b) => b.mmr - a.mmr).map((p) => (
                      <div key={p.id} className={`group flex justify-between items-center p-3 sm:p-3.5 rounded-2xl transition-all duration-200 border ${p.isActive ? 'bg-white border-slate-200 shadow-sm hover:border-indigo-300' : 'bg-slate-50 border-transparent opacity-60 grayscale-[50%]'}`}>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <button onClick={() => togglePlayerActive(p.id)} className="focus:outline-none transition-transform active:scale-95">
                            {p.isActive ? <CheckCircle2 className="text-emerald-500 w-5 h-5 sm:w-6 sm:h-6 fill-emerald-50" /> : <Circle className="text-slate-300 w-5 h-5 sm:w-6 sm:h-6" />}
                          </button>
                          <div className="flex flex-col">
                            <span className={`text-xs sm:text-sm ${p.isActive ? 'font-bold text-slate-800' : 'font-semibold text-slate-500 line-through decoration-slate-300'}`}>{p.name}</span>
                            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium tracking-wide">W {p.win} · L {p.lose} · เล่นแล้ว <span className="text-indigo-500 font-bold">{p.playCount || 0}</span> รอบ</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex flex-col items-end"><span className="text-[10px] sm:text-xs font-bold bg-slate-100 text-indigo-700 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg border border-slate-200/60">{p.mmr}</span></div>
                          <button onClick={() => removePlayer(p.id)} className="text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-md"><Trash2 size={14} className="sm:w-4 sm:h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-5 sm:space-y-6">
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] sm:text-[13px] font-bold text-slate-600 flex items-center gap-1.5"><Swords size={14} className="text-indigo-500"/> จำนวนสนาม</label>
                      <select disabled={matchSession !== null} value={numCourts} onChange={(e) => setNumCourts(Number(e.target.value))} className="w-full p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm font-medium text-slate-700 disabled:opacity-50 transition-all appearance-none">
                        {[1,2,3,4,5].map(n => (<option key={n} value={n}>{n} สนาม (สูงสุด {n*4} คน)</option>))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[12px] sm:text-[13px] font-bold text-slate-600 flex items-center gap-1.5"><Settings size={14} className="text-indigo-500"/> โหมดการจับคู่</label>
                      <select disabled={matchSession !== null} value={matchMode} onChange={(e) => setMatchMode(e.target.value)} className="w-full p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs sm:text-sm font-medium text-slate-700 disabled:opacity-50 transition-all appearance-none">
                        <option value="winner_stays">👑 แชมป์อยู่ต่อ (สลับผู้ท้าชิง)</option>
                        <option value="balanced">🔄 สุ่มใหม่ทุกรอบ (กระจายให้เล่นเท่ากัน)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-slate-100 flex justify-end">
                    {!matchSession ? (
                      <button onClick={handleStartSession} className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2 transform active:scale-95"><Play size={16} fill="currentColor" className="sm:w-[18px] sm:h-[18px]" /> เริ่มเซสชันการแข่ง</button>
                    ) : (
                      <button onClick={endSession} className="w-full sm:w-auto bg-white border border-red-200 text-red-500 hover:bg-red-50 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold shadow-sm transition-all flex items-center justify-center gap-2"><StopCircle size={16} className="sm:w-[18px] sm:h-[18px]" /> ยุติการแข่งขัน</button>
                    )}
                  </div>
                </div>

                {!matchSession ? (
                   <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 p-8 sm:p-16 rounded-3xl flex flex-col items-center justify-center text-center">
                     <div className="bg-white p-3 sm:p-4 rounded-full shadow-sm mb-3 sm:mb-4"><Swords className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-300" /></div>
                     <h3 className="font-bold text-base sm:text-lg text-slate-700 mb-1">ยังไม่มีการจับคู่</h3>
                     <p className="text-xs sm:text-sm text-slate-500 max-w-sm">เลือกผู้เล่นที่พร้อมลงสนามทางซ้ายมือ ปรับตั้งค่าสนาม แล้วกด "เริ่มเซสชันการแข่ง"</p>
                   </div>
                ) : (
                  <div className="bg-[#0B1120] rounded-[2rem] shadow-2xl p-5 sm:p-6 lg:p-8 relative overflow-hidden border border-slate-800">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 sm:pb-6 mb-5 sm:mb-6 border-b border-white/10 relative z-10 gap-3 sm:gap-4">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <h3 className="font-black text-white text-lg sm:text-xl flex items-center gap-2 tracking-wide">
                            <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-red-500"></span></span>
                            LIVE ARENA
                          </h3>
                          {undoSnapshot && (
                            <button onClick={undoLastMatch} className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all w-max"><RotateCcw size={14} /> ย้อนผลล่าสุด</button>
                          )}
                        </div>
                        <p className="text-indigo-200/60 text-xs sm:text-sm mt-2 sm:mt-1 font-medium">{matchSession.mode === 'winner_stays' ? 'โหมด: แชมป์อยู่ต่อ' : 'โหมด: สลับใหม่ทุกรอบ'}</p>
                      </div>
                      <span className="bg-white/5 backdrop-blur-md text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border border-white/10 flex items-center gap-1.5 sm:gap-2 w-max"><Swords size={14} className="text-indigo-400 sm:w-4 sm:h-4"/> {matchSession.courts.length} สนามทำงาน</span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 sm:gap-6 relative z-10">
                      {matchSession.courts.map((court) => (
                        <div key={court.id} className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col">
                          <div className="flex justify-between items-center mb-4 sm:mb-5">
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs font-black tracking-widest uppercase px-2.5 sm:px-3 py-1 rounded-md sm:rounded-lg border border-indigo-500/30">Court {court.id}</span>
                            {court.finished && <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 sm:px-2.5 py-1 rounded-md sm:rounded-lg uppercase flex items-center gap-1"><CheckCircle2 size={10} className="sm:w-3 sm:h-3"/> Match Ended</span>}
                          </div>

                          <div className="flex-1 flex flex-col space-y-2">
                            <div className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${court.finished ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-500/20'}`}>
                              <div className="flex flex-col gap-1.5 sm:gap-2">
                                {court.team1.map(p => (
                                  <div key={p.id} className="flex justify-between items-center group/player">
                                    <span className="font-bold text-white text-xs sm:text-sm">{p.name}</span>
                                    <div className="flex items-center gap-2">
                                      {!court.finished && <button onClick={() => setSwapData({ courtId: court.id, teamIndex: 1, oldPlayer: p })} className="opacity-0 group-hover/player:opacity-100 transition-opacity bg-indigo-500/30 hover:bg-indigo-500 text-indigo-200 hover:text-white p-1 rounded-md"><RefreshCw size={12} /></button>}
                                      <span className="text-[9px] sm:text-[10px] font-mono bg-white/10 text-indigo-200 px-1.5 sm:px-2 py-0.5 rounded-md">{getPlayerLatest(p.id).mmr}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="relative flex items-center justify-center h-4"><div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div><span className="bg-[#0B1120] text-slate-500 text-[9px] sm:text-[10px] font-black italic px-2 z-10 border border-white/5 rounded-full py-0.5">VS</span></div>

                            <div className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 ${court.finished ? 'bg-white/5 border-white/5 opacity-50 grayscale' : 'bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/20'}`}>
                              <div className="flex flex-col gap-1.5 sm:gap-2">
                                {court.team2.map(p => (
                                  <div key={p.id} className="flex justify-between items-center group/player">
                                    <span className="font-bold text-white text-xs sm:text-sm">{p.name}</span>
                                    <div className="flex items-center gap-2">
                                      {!court.finished && <button onClick={() => setSwapData({ courtId: court.id, teamIndex: 2, oldPlayer: p })} className="opacity-0 group-hover/player:opacity-100 transition-opacity bg-rose-500/30 hover:bg-rose-500 text-rose-200 hover:text-white p-1 rounded-md"><RefreshCw size={12} /></button>}
                                      <span className="text-[9px] sm:text-[10px] font-mono bg-white/10 text-rose-200 px-1.5 sm:px-2 py-0.5 rounded-md">{getPlayerLatest(p.id).mmr}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {!court.finished && (
                              <button onClick={() => { setScoreInput({t1: '', t2: ''}); setScoreModal(court); }} className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 flex justify-center items-center gap-2 border border-white/10">
                                <Award size={14} /> บันทึกผลคะแนน
                              </button>
                            )}

                          </div>
                        </div>
                      ))}
                    </div>

                    {matchSession.waitingQueue && matchSession.waitingQueue.length > 0 && (
                      <div className="mt-5 sm:mt-6 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl p-4 sm:p-5 relative z-10">
                        <h4 className="font-bold text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                          <Clock size={12} className="sm:w-3.5 sm:h-3.5" /> คิวรอเข้าสนาม ({matchSession.waitingQueue.length} คน)
                        </h4>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {matchSession.waitingQueue.map((p, idx) => (
                            <div key={idx} className="bg-black/40 border border-white/5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                              <span className="font-bold text-white">{p.name}</span>
                              {idx < 2 && matchSession.mode === 'winner_stays' && <span className="ml-1.5 sm:ml-2 bg-emerald-500 text-emerald-950 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black">NEXT</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {isAllCourtsFinished && (
                      <button onClick={handleStartSession} className="w-full mt-5 sm:mt-6 bg-white text-[#0B1120] py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all flex justify-center items-center gap-2"><RefreshCw size={16} className="sm:w-[18px] sm:h-[18px]" /> เริ่มจับคู่รอบต่อไป</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MATCH HISTORY */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
              <div className="flex flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Match History</h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1">ประวัติการแข่งขันและการปรับ MMR ระดับบุคคล</p>
                </div>
                {matchHistory.length > 0 && <button onClick={clearHistory} className="text-[10px] sm:text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-bold transition-colors whitespace-nowrap">ล้างประวัติ</button>}
              </div>

              {matchHistory.length === 0 ? (
                <div className="py-16 sm:py-20 text-center text-slate-400 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100">
                  <History className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-slate-300 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base font-medium">ยังไม่มีประวัติการแข่งขัน</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matchHistory.map((match) => (
                    <div key={match.id} className="group bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col md:flex-row gap-4 sm:gap-6">
                      <div className="md:w-1/4 flex flex-row md:flex-col justify-between md:justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md w-max mb-1.5 uppercase">{match.id}</span>
                          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">{match.date}</span>
                        </div>
                        <span className="text-[11px] sm:text-xs text-slate-400 text-right md:text-left self-end md:self-auto md:mt-1">{match.matchDetails}</span>
                      </div>

                      <div className="flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 relative">
                        <div className="flex-1 w-full bg-emerald-50/50 p-2.5 sm:p-3 rounded-xl border border-emerald-100 relative">
                          <div className="absolute -top-2 -left-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm"><Trophy size={10} className="sm:w-3 sm:h-3"/></div>
                          <p className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase mb-1.5 sm:mb-2 tracking-wider text-right">Winner</p>
                          {match.team1.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs sm:text-sm mb-1.5 last:mb-0">
                              <span className="font-bold text-slate-700">{p.name}</span>
                              <span className="text-[10px] font-black text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200/50">{p.change}</span>
                            </div>
                          ))}
                        </div>

                        {match.scoreText && (
                          <div className="shrink-0 bg-slate-800 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl font-black text-sm sm:text-base tracking-widest shadow-md">
                            {match.scoreText}
                          </div>
                        )}

                        <div className="flex-1 w-full bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase mb-1.5 sm:mb-2 tracking-wider">Loser</p>
                          {match.team2.map((p, i) => (
                            <div key={i} className="flex justify-between items-center text-xs sm:text-sm mb-1.5 last:mb-0">
                              <span className="font-medium text-slate-600">{p.name}</span>
                              <span className="text-[10px] font-black text-rose-500 bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200/50">{p.change}</span>
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

        {/* 🌟 VIEW 3: STATS & LEADERBOARD (Re-Rank added) */}
        {activeTab === 'stats' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white p-5 sm:p-6 md:p-8 rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <TrendingUp className="text-indigo-500" /> Leaderboard & Stats
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1">อันดับผู้เล่น อัตราชนะ และคู่หูยอดเยี่ยม</p>
                </div>
                {players.length > 0 && (
                  <button onClick={handleNewSeason} className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 text-xs sm:text-sm whitespace-nowrap w-max">
                    <Sparkles size={16} /> ขึ้นซีซันใหม่ (Re-Rank)
                  </button>
                )}
              </div>

              {(() => {
                const rankedPlayers = [...players].sort((a, b) => b.mmr - a.mmr);
                const top1 = rankedPlayers[0]; const top2 = rankedPlayers[1]; const top3 = rankedPlayers[2];

                return (
                  <>
                    {rankedPlayers.some(p => p.win > 0 || p.lose > 0) && (
                      <div className="flex justify-center items-end gap-2 sm:gap-6 mt-10 mb-12">
                        {top2 && (
                          <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100">
                            <div className="bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center font-bold text-slate-500 mb-2 border-2 border-slate-200 shadow-sm">{top2.name.substring(0,2)}</div>
                            <div className="bg-gradient-to-t from-slate-200 to-slate-50 w-20 sm:w-24 h-24 rounded-t-2xl flex flex-col items-center justify-start pt-3 border border-slate-200 shadow-inner">
                              <span className="text-2xl font-black text-slate-400">2</span><span className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1">{top2.mmr} MMR</span>
                            </div>
                          </div>
                        )}
                        {top1 && (
                          <div className="flex flex-col items-center z-10 animate-in slide-in-from-bottom-12 duration-700">
                            <div className="absolute -mt-8 animate-bounce drop-shadow-md"><Trophy className="text-yellow-500 fill-yellow-100 w-8 h-8"/></div>
                            <div className="bg-yellow-100 rounded-full w-16 h-16 flex items-center justify-center font-black text-yellow-700 mb-2 border-4 border-yellow-300 text-lg shadow-lg shadow-yellow-200/50">{top1.name.substring(0,2)}</div>
                            <div className="bg-gradient-to-t from-yellow-300 to-yellow-50 w-24 sm:w-28 h-32 rounded-t-2xl flex flex-col items-center justify-start pt-3 border border-yellow-300 shadow-xl relative overflow-hidden">
                              <div className="absolute inset-0 bg-white/20 w-full h-full transform -skew-x-12"></div>
                              <span className="text-4xl font-black text-yellow-600 relative z-10">1</span><span className="text-xs sm:text-sm font-black text-yellow-700 mt-1 relative z-10">{top1.mmr} MMR</span>
                            </div>
                          </div>
                        )}
                        {top3 && (
                          <div className="flex flex-col items-center animate-in slide-in-from-bottom-4 duration-700 delay-200">
                            <div className="bg-orange-50 rounded-full w-12 h-12 flex items-center justify-center font-bold text-orange-700 mb-2 border-2 border-orange-200 shadow-sm">{top3.name.substring(0,2)}</div>
                            <div className="bg-gradient-to-t from-orange-200 to-orange-50 w-20 sm:w-24 h-20 rounded-t-2xl flex flex-col items-center justify-start pt-2 border border-orange-200 shadow-inner">
                              <span className="text-xl font-black text-orange-500">3</span><span className="text-[10px] sm:text-xs font-bold text-orange-600 mt-1">{top3.mmr} MMR</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3">
                      {rankedPlayers.map((p, index) => {
                        const totalMatches = p.win + p.lose;
                        const winRate = totalMatches > 0 ? Math.round((p.win / totalMatches) * 100) : 0;
                        const bestPartner = getBestPartner(p.name);
                        
                        return (
                          <div key={p.id} className="bg-white border border-slate-200 p-3 sm:p-4 rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow hover:border-indigo-200 group">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <span className={`font-black text-base sm:text-lg w-6 text-center ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-400' : 'text-slate-300'}`}>{index + 1}</span>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-slate-800 text-sm sm:text-base">{p.name}</span>
                                </div>
                                <div className="text-[10px] sm:text-xs text-slate-500 flex gap-2 sm:gap-3 items-center">
                                  <span className="bg-slate-50 px-1.5 py-0.5 rounded">W <b>{p.win}</b> - L <b>{p.lose}</b></span>
                                  <span className={`font-bold ${winRate >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>{winRate}% WR</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className="font-black text-base sm:text-lg text-indigo-600 tracking-tight">{p.mmr}</span>
                              <span className="text-[9px] sm:text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">คู่หูชนะบ่อย: <span className="font-bold text-slate-600">{bestPartner}</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        )}

        {/* VIEW 4: CALCULATOR */}
        {activeTab === 'calculator' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_-8px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              <div className="p-5 sm:p-6 md:p-8 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-20"></div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2"><DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-400" /> ระบบหารค่าสนาม (Pro-Rata)</h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1.5 sm:mt-2 max-w-md">คำนวณเงินตาม "นาทีที่เล่นจริง" เพื่อความยุติธรรมสำหรับคนที่มาไม่พร้อมกัน</p>
                  </div>
                  <button onClick={importRosterToCalculator} className="bg-white/10 hover:bg-white/20 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold backdrop-blur-md transition-all flex items-center justify-center gap-2 border border-white/10"><Users size={14} className="sm:w-4 sm:h-4"/> ดึงรายชื่อ ({players.filter(p=>p.isActive).length})</button>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
                  {/* Left: Input */}
                  <div className="lg:col-span-5 space-y-6 sm:space-y-8">
                    <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base mb-4 sm:mb-5 flex items-center gap-2"><Settings size={16} className="text-indigo-500 sm:w-[18px] sm:h-[18px]"/> ค่าใช้จ่ายรวม</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="relative">
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 mb-1.5 uppercase">ค่าสนาม (บาท)</label>
                            <input type="number" value={calcFees.court} onChange={(e) => setCalcFees({...calcFees, court: e.target.value})} className="w-full pl-3 sm:pl-4 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-bold font-mono text-sm sm:text-base transition-all" />
                            <span className="absolute right-3 sm:right-4 bottom-2.5 sm:bottom-3 text-slate-400 font-bold text-xs sm:text-base">฿</span>
                          </div>
                          <div className="relative">
                            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 mb-1.5 uppercase">ค่าลูกแบด (บาท)</label>
                            <input type="number" value={calcFees.shuttlecock} onChange={(e) => setCalcFees({...calcFees, shuttlecock: e.target.value})} className="w-full pl-3 sm:pl-4 pr-8 sm:pr-10 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 font-bold font-mono text-sm sm:text-base transition-all" />
                            <span className="absolute right-3 sm:right-4 bottom-2.5 sm:bottom-3 text-slate-400 font-bold text-xs sm:text-base">฿</span>
                          </div>
                        </div>
                        <div className="pt-4 sm:pt-5 mt-2 border-t border-slate-200 flex justify-between items-end">
                          <span className="text-xs sm:text-sm font-bold text-slate-500">ยอดรวมทั้งหมด</span>
                          <span className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">{Number(calcFees.court) + Number(calcFees.shuttlecock)} <span className="text-sm sm:text-lg">฿</span></span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-3 sm:mb-4">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2"><Clock size={16} className="text-indigo-500 sm:w-[18px] sm:h-[18px]"/> ผู้เล่นและเวลา</h3>
                        <button onClick={addCalcPlayer} className="text-[10px] sm:text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold transition-colors">+ เพิ่มคน</button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <Copy size={14} className="text-indigo-500" />
                          <span className="text-[10px] sm:text-xs font-bold text-indigo-800">เซ็ตเวลาออกทุกคน:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="time" value={globalLeaveTime} onChange={e => setGlobalLeaveTime(e.target.value)} className="p-1 sm:p-1.5 rounded-lg border border-indigo-200 text-xs font-mono outline-none bg-white w-full sm:w-auto" />
                          <button onClick={applyGlobalLeaveTime} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all shadow-sm">นำไปใช้</button>
                        </div>
                      </div>

                      <div className="space-y-2.5 sm:space-y-3 max-h-[350px] sm:max-h-[400px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
                        {calcPlayers.map((player, index) => (
                          <div key={player.id} className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm relative group">
                            <button onClick={() => removeCalcPlayer(player.id)} className="absolute -top-1.5 sm:-top-2 -right-1.5 sm:-right-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 p-1 sm:p-1.5 rounded-full shadow-sm opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={10} className="sm:w-3 sm:h-3" /></button>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                              <div className="col-span-2"><input type="text" value={player.name} onChange={(e) => updateCalcPlayerTime(index, 'name', e.target.value)} placeholder="ชื่อผู้เล่น" className="w-full p-2 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" /></div>
                              <div><label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1 ml-1">เวลาเข้า</label><input type="time" value={player.joinTime} onChange={(e) => updateCalcPlayerTime(index, 'joinTime', e.target.value)} className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono focus:border-indigo-500 outline-none" /></div>
                              <div><label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-0.5 sm:mb-1 ml-1">เวลาออก</label><input type="time" value={player.leaveTime} onChange={(e) => updateCalcPlayerTime(index, 'leaveTime', e.target.value)} className="w-full p-1.5 sm:p-2 bg-white border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-mono focus:border-indigo-500 outline-none" /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Results */}
                  <div className="lg:col-span-7">
                    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm h-full flex flex-col">
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl sm:rounded-t-3xl">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2"><ChevronRight className="text-indigo-500 w-4 h-4 sm:w-5 sm:h-5"/> สรุปยอดโอน</h3>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="hidden sm:flex items-center justify-between p-4 border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider bg-white">
                           <div className="flex-[2]">ผู้เล่น</div>
                           <div className="flex-[1.5] text-center">เวลาเล่นจริง</div>
                           <div className="flex-[1.5] text-right">ยอดที่ต้องจ่าย</div>
                        </div>
                        <div className="flex flex-col divide-y divide-slate-50">
                          {calcResults.length === 0 ? (
                            <div className="p-8 sm:p-10 text-center text-slate-400 text-xs sm:text-sm">เพิ่มข้อมูลด้านซ้ายเพื่อดูผลลัพธ์</div>
                          ) : calcResults.map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 sm:p-4 hover:bg-slate-50/50 transition-colors gap-2">
                              <div className="flex items-center gap-2.5 sm:gap-3 flex-[2] min-w-0">
                                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-[10px] sm:text-xs font-bold uppercase border border-indigo-200 shrink-0">{result.name.substring(0, 2)}</div>
                                <span className="font-bold text-slate-700 text-sm sm:text-base truncate">{result.name}</span>
                              </div>
                              <div className="flex-[1.5] text-center shrink-0">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium border border-slate-200 whitespace-nowrap">{result.minutesPlayed} นาที</span>
                              </div>
                              <div className="flex-[1.5] text-right shrink-0">
                                <span className="font-black text-emerald-600 text-base sm:text-lg tracking-tight">{result.feeToPay} <span className="text-[10px] sm:text-xs font-bold text-emerald-400">฿</span></span>
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

      <style dangerouslySetInnerHTML={{__html: `.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }`}} />
    </div>
  );
}
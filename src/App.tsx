import React, { useState, useEffect } from 'react';
import { 
  Save, User, Users, Trophy, CheckCircle, Calculator, FileText, Upload, 
  Lock, LogOut, ArrowRight, Key, Check, Layers, Plus, Copy, Settings, 
  Edit2, Trash2, X, Pencil, FileSpreadsheet, Clock, Power, 
  AlertTriangle, Mail, RefreshCw, Loader2
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ==============================
// SUPABASE CONFIG
// ==============================
// Using the exact credentials provided
const supabaseUrl = 'https://ewjbfxerlbnmreeywamg.supabase.co';
const supabaseKey = 'sb_publishable_5lfD7JnOoOJ7r-MGoFieKA_4Oh_QCHP';

// Initialize client
const supabase = createClient(supabaseUrl, supabaseKey);

// ==============================
// TYPE DEFINITIONS
// ==============================
declare global {
  interface Window {
    XLSX: any;
  }
}

interface CriterionOption {
  score: number;
  desc: string;
}

interface TeacherCriterion {
  id: number;
  name: string;
  options: CriterionOption[];
  score?: number; 
}

interface StudentCriterion {
  id: number;
  name: string;
  max: number;
  score: number;
}

interface Member {
  id: string;
  name: string;
  label: string;
}

interface Group {
  id?: number;
  project: string;
  name: string;
  membersString: string;
  membersArray: Member[];
}

interface PeerEval {
  id?: number;
  project: string;
  groupName: string;
  evaluator: string;
  target: string;
  scores: StudentCriterion[];
  totalRaw: number;
  timestamp: string;
}

interface TeacherRecord {
  id: number;
  project: string;
  groupName: string;
  rawGroupScore: number;
  weightedGroupScore: number;
  avgPeerRaw: number;
  weightedIndivScore: number;
  totalScore: number;
  groupEvalsCount: number;
}

interface ProjectStatus {
  [key: string]: boolean;
}

interface ProjectCriteriaMap {
  [key: string]: TeacherCriterion[];
}

interface StudentSession {
  project: string;
  groupName: string;
  memberId: string;
  memberLabel: string;
}

// ==============================
// CONSTANTS & DEFAULTS
// ==============================
const defaultCriteriaTemplate: StudentCriterion[] = [
  { id: 1, name: '1. ความรับผิดชอบ (Responsibility)', max: 5, score: 0 },
  { id: 2, name: '2. คุณภาพงาน (Quality)', max: 5, score: 0 },
  { id: 3, name: '3. การทำงานร่วมกับทีม (Teamwork)', max: 5, score: 0 },
];

const defaultTeacherCriteria: TeacherCriterion[] = [
  { id: 1, name: '1. Pipeline ระบบ', options: [{ score: 1, desc: 'ระบบไม่ครบ' }, { score: 3, desc: 'ระบบทำงานได้บางส่วน' }, { score: 5, desc: 'Pipeline ครบถ้วน' }] },
  { id: 2, name: '2. AI & Model Usage', options: [{ score: 1, desc: 'ใช้โมเดลผิด/ไม่ work' }, { score: 3, desc: 'ใช้ได้ตามตัวอย่าง' }, { score: 5, desc: 'เข้าใจ/อธิบายได้ดี' }] },
  { id: 3, name: '3. Web Implementation', options: [{ score: 1, desc: 'รันไม่ได้' }, { score: 3, desc: 'รันได้แต่ไม่เสถียร' }, { score: 5, desc: 'รันได้ดี UX ชัดเจน' }] },
  { id: 4, name: '4. ความสร้างสรรค์', options: [{ score: 1, desc: 'ไม่มี' }, { score: 3, desc: 'มีบ้าง' }, { score: 5, desc: 'Re-design สวยงาม' }] },
  { id: 5, name: '5. Deployment & Demo', options: [{ score: 1, desc: 'ไม่มี Demo' }, { score: 3, desc: 'Demo บางส่วน' }, { score: 5, desc: 'Deploy ครบถ้วน' }] },
];

const App: React.FC = () => {
  // ==============================
  // 1. GLOBAL STATE & DATA
  // ==============================
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'landing' | 'teacher' | 'student-login' | 'student-dashboard' | 'student-vote'>('landing');
  
  // Data from Supabase
  const [projectList, setProjectList] = useState<string[]>([]);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>({});
  const [allProjectCriteria, setAllProjectCriteria] = useState<ProjectCriteriaMap>({});
  const [records, setRecords] = useState<TeacherRecord[]>([]); 
  const [peerEvaluations, setPeerEvaluations] = useState<PeerEval[]>([]); 
  const [importedGroups, setImportedGroups] = useState<Group[]>([]); 

  // ==============================
  // 2. TEACHER AUTH & STATE
  // ==============================
  const [session, setSession] = useState<any>(null);
  const [teacherProject, setTeacherProject] = useState<string>(''); 
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null); 
  
  // Auth UI State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false); 
  
  const [groupCriteria, setGroupCriteria] = useState<TeacherCriterion[]>([]);

  // ==============================
  // 3. STUDENT STATE
  // ==============================
  const [loginProject, setLoginProject] = useState('');
  const [loginGroup, setLoginGroup] = useState('');
  const [loginMemberLabel, setLoginMemberLabel] = useState('');
  const [loginMemberId, setLoginMemberId] = useState('');
  const [studentAuthInput, setStudentAuthInput] = useState('');
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null); 
  const [targetLabel, setTargetLabel] = useState('');
  const [currentScores, setCurrentScores] = useState<StudentCriterion[]>(defaultCriteriaTemplate.map(c => ({...c})));
  const [studentSuccessMsg, setStudentSuccessMsg] = useState('');

  // ==============================
  // 4. SUPABASE DATA FETCHING
  // ==============================
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Projects
      const { data: projects, error: projErr } = await supabase.from('projects').select('*');
      if (projErr) throw projErr;
      
      const pList = projects.map((p: any) => p.name);
      const pStatus: ProjectStatus = {};
      projects.forEach((p: any) => pStatus[p.name] = p.is_active);
      
      setProjectList(pList);
      setProjectStatus(pStatus);
      
      // If teacherProject is not set or not in list, set it
      if (pList.length > 0 && (!teacherProject || !pList.includes(teacherProject))) {
        setTeacherProject(pList[0]);
      }

      // 2. Fetch Criteria
      const { data: criteria, error: critErr } = await supabase.from('criteria').select('*');
      if (critErr) throw critErr;
      const criteriaMap: ProjectCriteriaMap = {};
      criteria.forEach((c: any) => criteriaMap[c.project_name] = c.data);
      // Ensure defaults for missing projects
      pList.forEach(p => {
        if (!criteriaMap[p]) criteriaMap[p] = JSON.parse(JSON.stringify(defaultTeacherCriteria));
      });
      setAllProjectCriteria(criteriaMap);

      // 3. Fetch Groups
      const { data: groups, error: grpErr } = await supabase.from('groups').select('*');
      if (grpErr) throw grpErr;
      const parsedGroups = groups.map((g: any) => ({
        id: g.id,
        project: g.project_name,
        name: g.name,
        membersArray: g.members,
        membersString: g.members.map((m: any) => m.id ? `${m.id} ${m.name}` : m.name).join(', ')
      }));
      setImportedGroups(parsedGroups);

      // 4. Fetch Peer Evals
      const { data: pEvals, error: peErr } = await supabase.from('peer_evals').select('*');
      if (peErr) throw peErr;
      const parsedPEvals = pEvals.map((e: any) => ({
        id: e.id,
        project: e.project_name,
        groupName: e.group_name,
        evaluator: e.evaluator,
        target: e.target,
        scores: e.scores,
        totalRaw: e.total_raw,
        timestamp: e.created_at
      }));
      setPeerEvaluations(parsedPEvals);

      // 5. Fetch Teacher Records
      const { data: tEvals, error: teErr } = await supabase.from('teacher_evals').select('*');
      if (teErr) throw teErr;
      const parsedTEvals = tEvals.map((e: any) => ({
        id: e.created_at, // Use timestamp as ID for display logic consistency
        project: e.project_name,
        groupName: e.group_name,
        ...e.data, // Contains score breakdown
        totalScore: e.total_score
      }));
      setRecords(parsedTEvals);

    } catch (error: any) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Check Active Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
         setShowLoginModal(false);
         setView('teacher');
         fetchData(); // Refresh data on login
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (teacherProject && allProjectCriteria[teacherProject]) {
        const loadedCriteria = allProjectCriteria[teacherProject].map(c => ({...c, score: 0}));
        setGroupCriteria(loadedCriteria);
        setCurrentGroup(null);
    }
  }, [teacherProject, allProjectCriteria]);

  useEffect(() => {
    if(studentSuccessMsg) {
      const timer = setTimeout(() => setStudentSuccessMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [studentSuccessMsg]);

  // ==============================
  // 5. HANDLERS
  // ==============================

  // --- Auth Handlers ---
  const handleAuth = async () => {
    if (!email || !password) return alert('กรุณากรอก Email และ Password');
    if (password.length < 6) return alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');

    setLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Register Mode
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // Check if session is created immediately (Email Confirmation Disabled)
        if (data.session) {
            alert('Registration successful! Logging you in...');
            // The onAuthStateChange hook will handle the redirect
        } else if (data.user) {
            // User created but waiting for confirmation
            alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน (หากไม่ได้รับให้เช็ค Spam หรือปิด Email Confirmation ใน Supabase)');
            setAuthMode('login');
        }
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setView('landing');
  };

  // --- Export Logic (Excel) ---
  const loadXLSX = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (window.XLSX) {
        resolve(window.XLSX);
        return;
      }
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = () => resolve(window.XLSX);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const handleExportExcel = async () => {
    try {
      const XLSX = await loadXLSX();
      
      const teacherData = records.map(r => ({
        "Project": r.project,
        "Group Name": r.groupName,
        "Raw Group Score": r.rawGroupScore,
        "Weighted Group Score (14%)": parseFloat(r.weightedGroupScore.toFixed(2)),
        "Avg Peer Score (Raw)": parseFloat(r.avgPeerRaw.toFixed(2)),
        "Weighted Peer Score (6%)": parseFloat(r.weightedIndivScore.toFixed(2)),
        "Total Score (20%)": parseFloat(r.totalScore.toFixed(2)),
        "Peer Voters Count": r.groupEvalsCount,
        "Evaluation Time": new Date(r.id).toLocaleString('th-TH')
      }));

      const studentData = peerEvaluations.map(p => {
        const scoreDetails: Record<string, number> = {};
        p.scores.forEach((s) => {
            scoreDetails[`${s.name}`] = s.score;
        });
        
        return {
          "Project": p.project,
          "Group Name": p.groupName,
          "Evaluator": p.evaluator,
          "Target": p.target,
          "Total Score (15)": p.totalRaw,
          ...scoreDetails,
          "Evaluation Time": new Date(p.timestamp).toLocaleString('th-TH')
        };
      });

      const summaryData: any[] = [];
      const sortedGroups = [...importedGroups].sort((a, b) => 
        a.project.localeCompare(b.project) || a.name.localeCompare(b.name)
      );

      sortedGroups.forEach(group => {
          const teacherRecord = records.find(r => r.project === group.project && r.groupName === group.name);
          const groupScore = teacherRecord ? teacherRecord.weightedGroupScore : 0;

          group.membersArray.forEach(member => {
              const memberEvaluations = peerEvaluations.filter(e => 
                  e.project === group.project && 
                  e.groupName === group.name && 
                  e.target === member.label
              );

              let peerScoreWeighted = 0;
              if (memberEvaluations.length > 0) {
                  const totalRawReceived = memberEvaluations.reduce((sum, e) => sum + e.totalRaw, 0);
                  const avgRaw = totalRawReceived / memberEvaluations.length;
                  peerScoreWeighted = (avgRaw / 15) * 6;
              }

              const totalScore = groupScore + peerScoreWeighted;

              summaryData.push({
                  "รหัส": member.id || '-',
                  "ชื่อ-นามสกุล": member.name || member.label,
                  "ชื่อ Project": group.project,
                  "ชื่อ กลุ่ม": group.name,
                  "คะแนนกลุ่ม (14%)": parseFloat(groupScore.toFixed(2)),
                  "คะแนนเพื่อน (6%)": parseFloat(peerScoreWeighted.toFixed(2)),
                  "Total Percent (20%)": parseFloat(totalScore.toFixed(2))
              });
          });
      });

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData.length > 0 ? summaryData : [{"Info": "No data"}]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      const wsTeacher = XLSX.utils.json_to_sheet(teacherData.length > 0 ? teacherData : [{"Info": "No teacher data"}]);
      XLSX.utils.book_append_sheet(wb, wsTeacher, "Teacher_Evaluation");
      const wsStudent = XLSX.utils.json_to_sheet(studentData.length > 0 ? studentData : [{"Info": "No peer data"}]);
      XLSX.utils.book_append_sheet(wb, wsStudent, "Student_Peer_Evaluation");

      XLSX.writeFile(wb, `Evaluation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);

    } catch (error) {
      console.error("Export failed:", error);
      alert("ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
    }
  };

  // --- Project Management (Supabase) ---
  const toggleProjectStatus = async () => {
    const currentStatus = projectStatus[teacherProject];
    const { error } = await supabase.from('projects').update({ is_active: !currentStatus }).eq('name', teacherProject);
    if (!error) {
        setProjectStatus(prev => ({ ...prev, [teacherProject]: !currentStatus }));
    } else {
        alert('Failed to update status');
    }
  };
  
  const handleAddProject = async (name: string) => {
    if (!name.trim()) return;
    if (projectList.includes(name.trim())) return alert('ชื่อโปรเจกต์ซ้ำกัน');
    const newName = name.trim();
    
    // Insert Project
    const { error } = await supabase.from('projects').insert({ name: newName, is_active: true });
    
    if (!error) {
        // Insert Default Criteria
        await supabase.from('criteria').insert({ project_name: newName, data: defaultTeacherCriteria });
        fetchData(); // Refresh all
    } else {
        alert('Failed to create project: ' + error.message);
    }
  };

  const handleEditProject = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const updatedName = newName.trim();
    
    // Cascading update if foreign keys configured properly, otherwise simplistic approach:
    // Supabase doesn't easily support PK updates with cascade in simple mode sometimes, but assume standard SQL behavior
    const { error } = await supabase.from('projects').update({ name: updatedName }).eq('name', oldName);
    
    if (!error) {
        fetchData();
    } else {
        alert('Update failed: ' + error.message);
    }
  };

  const handleDeleteProject = async (name: string) => {
    if (projectList.length <= 1) return alert('ต้องมีอย่างน้อย 1 โปรเจกต์');
    if (!confirm('Are you sure? This will delete all groups and scores associated with this project.')) return;

    const { error } = await supabase.from('projects').delete().eq('name', name);
    if (!error) {
        fetchData();
    } else {
        alert('Delete failed: ' + error.message);
    }
  };

  const updateProjectCriteria = async (newCriteria: TeacherCriterion[]) => {
    const { error } = await supabase.from('criteria').upsert({ project_name: teacherProject, data: newCriteria });
    if (!error) {
        setAllProjectCriteria(prev => ({ ...prev, [teacherProject]: newCriteria }));
    } else {
        alert('Failed to save criteria');
    }
  };

  const getGroupsByProject = (proj: string) => importedGroups.filter(g => g.project === proj);

  // --- Student Logic ---
  const handleStudentLogin = () => {
    if (!loginProject || !loginGroup || !loginMemberLabel) return alert('กรุณาเลือกข้อมูลให้ครบถ้วน');
    if (!projectStatus[loginProject]) return alert(`โปรเจกต์ "${loginProject}" ปิดรับการประเมินแล้ว กรุณาติดต่ออาจารย์`);
    if (loginMemberId && studentAuthInput.trim() !== loginMemberId) return alert('รหัสนิสิตไม่ถูกต้อง');
    setStudentSession({ project: loginProject, groupName: loginGroup, memberId: loginMemberId, memberLabel: loginMemberLabel });
    setView('student-dashboard');
    setStudentAuthInput('');
  };

  const handleStudentLogout = () => {
    setStudentSession(null); setLoginProject(''); setLoginGroup(''); setLoginMemberLabel(''); setLoginMemberId(''); setView('landing');
  };

  const startVote = (targetName: string) => {
    if (!studentSession) return;
    if (!projectStatus[studentSession.project]) { alert(`ระบบปิดรับการประเมินแล้ว`); handleStudentLogout(); return; }
    setTargetLabel(targetName);
    setCurrentScores(defaultCriteriaTemplate.map(c => ({...c})));
    setView('student-vote');
  };

  const handleScoreChange = (id: number, val: string) => { setCurrentScores(prev => prev.map(s => s.id === id ? { ...s, score: Number(val) } : s)); };

  const submitVote = async () => {
    if (!studentSession) return;
    setLoading(true);
    const totalRaw = currentScores.reduce((sum, s) => sum + s.score, 0);
    
    const newEval = {
        project_name: studentSession.project,
        group_name: studentSession.groupName,
        evaluator: studentSession.memberLabel,
        target: targetLabel,
        scores: currentScores,
        total_raw: totalRaw
    };

    const { error } = await supabase.from('peer_evals').insert(newEval);

    setLoading(false);
    if (!error) {
        fetchData(); // Refresh to see progress
        setStudentSuccessMsg(`บันทึกคะแนนให้ "${targetLabel}" เรียบร้อย`);
        setView('student-dashboard');
    } else {
        alert('Error submitting vote: ' + error.message);
    }
  };

  // --- Teacher Logic ---
  const handleGroupSelect = (groupName: string) => {
    const group = importedGroups.find(g => g.name === groupName && g.project === teacherProject);
    setCurrentGroup(group || null);
  };

  const calculateScores = () => {
    if (!currentGroup) return { rawGroupScore: 0, weightedGroupScore: 0, avgPeerRaw: 0, weightedIndivScore: 0, groupEvalsCount: 0 };
    const rawGroupScore = groupCriteria.reduce((sum, item) => sum + (item.score || 0), 0);
    const maxRawScore = groupCriteria.length * 5; 
    const weightedGroupScore = maxRawScore > 0 ? (rawGroupScore / maxRawScore) * 14 : 0;
    
    // Filter from local state (which is synced with DB)
    const groupEvals = peerEvaluations.filter(e => e.project === teacherProject && e.groupName === currentGroup.name);
    
    let avgPeerRaw = 0;
    if (groupEvals.length > 0) {
      const totalRaw = groupEvals.reduce((sum, e) => sum + e.totalRaw, 0);
      avgPeerRaw = totalRaw / groupEvals.length;
    }
    const weightedIndivScore = (avgPeerRaw / 15) * 6;
    return { rawGroupScore, weightedGroupScore, avgPeerRaw, weightedIndivScore, groupEvalsCount: groupEvals.length };
  };

  const saveFinalRecord = async () => {
    if (!currentGroup) return alert('กรุณาเลือกกลุ่ม');
    const scores = calculateScores();
    const totalScore = scores.weightedGroupScore + scores.weightedIndivScore;

    const payload = {
        project_name: teacherProject,
        group_name: currentGroup.name,
        data: scores,
        total_score: totalScore
    };

    // Upsert logic (replace if exists for this group/project) - Need a constraint or just insert
    // Ideally we use UPSERT based on unique key, but simple INSERT is safer for now.
    // Or Delete then Insert
    await supabase.from('teacher_evals').delete().match({ project_name: teacherProject, group_name: currentGroup.name });
    const { error } = await supabase.from('teacher_evals').insert(payload);

    if (!error) {
        fetchData();
        alert(`บันทึกผลการประเมินกลุ่ม ${currentGroup.name} (${teacherProject}) เรียบร้อย`);
        setGroupCriteria(groupCriteria.map(c => ({...c, score: 0}))); 
        setCurrentGroup(null);
    } else {
        alert('Save failed: ' + error.message);
    }
  };

  // --- Modals ---
  const CriteriaManagerModal = ({ onClose }: { onClose: () => void }) => {
      const [editingCriteria, setEditingCriteria] = useState<TeacherCriterion[]>(allProjectCriteria[teacherProject] || []);
      const handleChange = (id: number, field: keyof TeacherCriterion, value: any, optionIdx: number | null = null) => { 
        setEditingCriteria(prev => prev.map(c => { 
          if (c.id !== id) return c; 
          if (field === 'options' && optionIdx !== null) { 
            const newOpts = [...c.options]; 
            newOpts[optionIdx] = { ...newOpts[optionIdx], desc: value }; 
            return { ...c, options: newOpts }; 
          } 
          return { ...c, [field]: value }; 
        })); 
      };
      const addCriterion = () => { 
        const newId = editingCriteria.length > 0 ? Math.max(...editingCriteria.map(c => c.id)) + 1 : 1; 
        setEditingCriteria([...editingCriteria, { id: newId, name: 'หัวข้อใหม่', options: [{ score: 1, desc: '...' }, { score: 3, desc: '...' }, { score: 5, desc: '...' }] }]); 
      };
      const removeCriterion = (id: number) => { setEditingCriteria(editingCriteria.filter(c => c.id !== id)); };
      const saveChanges = () => { updateProjectCriteria(editingCriteria); onClose(); };
      return (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 h-[80vh] flex flex-col"><div className="flex justify-between items-center mb-4 pb-2 border-b"><div><h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Edit2 size={24} className="text-blue-600"/> แก้ไขเกณฑ์การประเมิน</h3><p className="text-sm text-slate-500">สำหรับโปรเจกต์: <span className="font-bold text-blue-600">{teacherProject}</span></p></div><button onClick={onClose}><X size={24} className="text-slate-400 hover:text-red-500"/></button></div><div className="flex-grow overflow-y-auto space-y-4 pr-2">{editingCriteria.map((c, idx) => (<div key={c.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative group"><button onClick={() => removeCriterion(c.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button><div className="mb-3"><label className="text-xs font-bold text-slate-400 uppercase">หัวข้อประเมิน</label><input type="text" value={c.name} onChange={(e) => handleChange(c.id, 'name', e.target.value)} className="w-full font-bold text-slate-700 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none py-1"/></div><div className="grid grid-cols-3 gap-3">{c.options.map((opt, optIdx) => (<div key={optIdx}><div className="text-xs font-bold text-slate-500 mb-1">ระดับ {opt.score} คะแนน</div><textarea value={opt.desc} onChange={(e) => handleChange(c.id, 'options', e.target.value, optIdx)} className="w-full text-sm p-2 border rounded bg-white h-20 resize-none focus:ring-1 focus:ring-blue-300 outline-none"/></div>))}</div></div>))}<button onClick={addCriterion} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"><Plus size={20}/> เพิ่มหัวข้อเกณฑ์</button></div><div className="pt-4 mt-2 border-t flex justify-end gap-3"><button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button><button onClick={saveChanges} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">บันทึกการแก้ไข</button></div></div></div>);
  };

  const ProjectManagerModal = ({ onClose }: { onClose: () => void }) => {
    const [newProjectName, setNewProjectName] = useState(''); const [editingId, setEditingId] = useState<string | null>(null); const [editName, setEditName] = useState(''); const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const startEdit = (name: string) => { setEditingId(name); setEditName(name); setDeleteConfirmId(null); }
    const saveEdit = (oldName: string) => { handleEditProject(oldName, editName); setEditingId(null); }
    const confirmDelete = (name: string) => { handleDeleteProject(name); setDeleteConfirmId(null); }
    return (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"><div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="text-lg font-bold flex items-center gap-2"><Settings size={20} className="text-slate-600"/> จัดการโปรเจกต์</h3><button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button></div><div className="flex gap-2 mb-6"><input type="text" className="flex-grow p-2 border rounded-lg text-sm" placeholder="ชื่อโปรเจกต์ใหม่..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} /><button onClick={() => { handleAddProject(newProjectName); setNewProjectName(''); }} className="bg-blue-600 text-white px-3 rounded-lg text-sm hover:bg-blue-700"><Plus size={18}/></button></div><div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">{projectList.map(proj => (<div key={proj} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group min-h-[50px]">{editingId === proj ? (<div className="flex-grow flex gap-2 mr-2 animate-in fade-in"><input className="flex-grow p-1 border rounded text-sm" value={editName} onChange={e => setEditName(e.target.value)} autoFocus /><button onClick={() => saveEdit(proj)} className="text-green-600"><Check size={16}/></button><button onClick={() => setEditingId(null)} className="text-red-400"><X size={16}/></button></div>) : (<><span className={`font-medium text-slate-700 ${deleteConfirmId === proj ? 'text-red-300 decoration-red-300 line-through' : ''}`}>{proj}</span><div className="flex gap-1 items-center">{deleteConfirmId === proj ? (<div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200"><span className="text-xs text-red-500 font-bold">ยืนยันลบ?</span><button onClick={() => confirmDelete(proj)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"><Check size={14} /></button><button onClick={() => setDeleteConfirmId(null)} className="p-1.5 bg-slate-200 text-slate-500 rounded hover:bg-slate-300"><X size={14} /></button></div>) : (<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => startEdit(proj)} className="p-1.5 hover:bg-white rounded text-slate-500 hover:text-blue-600"><Edit2 size={14}/></button><button onClick={() => projectList.length > 1 ? setDeleteConfirmId(proj) : alert('ต้องเหลืออย่างน้อย 1 โปรเจกต์')} className={`p-1.5 hover:bg-white rounded text-slate-500 hover:text-red-600 ${projectList.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}><Trash2 size={14}/></button></div>)}</div></>)}</div>))}</div></div></div>);
  };

  const ImportModal = ({ onClose }: { onClose: () => void }) => {
    const [text, setText] = useState(''); const [mode, setMode] = useState('new'); const [sourceProject, setSourceProject] = useState('');
    const availableProjects = [...new Set(importedGroups.map(g => g.project))].filter(p => p !== teacherProject);
    const handleReuse = async () => { if (!sourceProject) return alert('กรุณาเลือกโปรเจกต์ต้นทาง'); const sourceGroups = importedGroups.filter(g => g.project === sourceProject); if (sourceGroups.length === 0) return alert('ไม่พบข้อมูลกลุ่มในโปรเจกต์ที่เลือก'); 
        // Bulk Insert to Supabase
        const newGroupsPayload = sourceGroups.map(g => ({ project_name: teacherProject, name: g.name, members: g.membersArray }));
        const { error } = await supabase.from('groups').insert(newGroupsPayload);
        if(!error) { onClose(); fetchData(); alert(`คัดลอกกลุ่มเรียบร้อย`); } else { alert(error.message); }
    };
    const processImport = async () => { 
        const lines = text.split(/\n/); const groupsMap = new Map(); lines.forEach(line => { let cleanLine = line.trim().replace(/"/g, ''); if (!cleanLine) return; let parts = cleanLine.split(/\t/); if (parts.length === 1) { const match = cleanLine.match(/^(.+?)\s+(\d{3,})\s+(.+)$/); if (match) parts = [match[1], match[2], match[3]]; else { const spaceIdx = cleanLine.indexOf(' '); if(spaceIdx > 0) parts = [cleanLine.substring(0, spaceIdx), cleanLine.substring(spaceIdx+1)]; } } const groupName = parts[0]?.trim(); if (!groupName) return; let membersToAdd: Member[] = []; if (parts.length >= 3) { membersToAdd.push({ id: parts[1].trim(), name: parts[2].trim(), label: parts[2].trim() }); } else if (parts.length === 2) { const col2 = parts[1].trim(); const idNameMatch = col2.match(/^(\d{3,})\s+(.+)$/); if (idNameMatch) membersToAdd.push({ id: idNameMatch[1], name: idNameMatch[2], label: idNameMatch[2] }); else { const names = col2.split(/,|،/).map(n => n.trim()).filter(n => n); membersToAdd = names.map(n => ({ id: '', name: n, label: n })); } } if (groupsMap.has(groupName)) groupsMap.set(groupName, [...groupsMap.get(groupName), ...membersToAdd]); else groupsMap.set(groupName, membersToAdd); }); 
        const parsed = Array.from(groupsMap.entries()).map(([name, members]) => ({ project_name: teacherProject, name: name as string, members: members as Member[] })); 
        if (parsed.length > 0) { 
            const { error } = await supabase.from('groups').insert(parsed);
            if(!error) { onClose(); fetchData(); alert(`นำเข้าสำเร็จ`); } else { alert(error.message); }
        } else { alert('ไม่พบข้อมูลที่ถูกต้อง'); } 
    };
    return (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Upload size={20} className="text-blue-600"/> จัดการรายชื่อกลุ่ม</h3><div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded mb-4 text-sm flex justify-between items-center"><span><span className="font-bold">Project ปัจจุบัน:</span> {teacherProject}</span></div><div className="flex gap-2 mb-4 border-b border-slate-200"><button onClick={() => setMode('new')} className={`pb-2 px-4 text-sm font-bold transition-all ${mode === 'new' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Plus size={14} className="inline mr-1"/> นำเข้าใหม่ (Excel)</button><button onClick={() => availableProjects.length > 0 && setMode('reuse')} disabled={availableProjects.length === 0} className={`pb-2 px-4 text-sm font-bold transition-all ${mode === 'reuse' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'} ${availableProjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}><Copy size={14} className="inline mr-1"/> ใช้กลุ่มเดิม (Reuse)</button></div>{mode === 'new' ? (<div className="animate-in fade-in"><div className="text-sm text-slate-600 mb-2">Copy ข้อมูลจาก Excel มาวางได้เลย (ชื่อกลุ่ม | รหัส | ชื่อ)</div><textarea className="w-full h-40 border p-3 rounded mb-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder={`Group 1\t660123\tSomchai\nGroup 1\t660124\tSomsak`} value={text} onChange={e => setText(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button><button onClick={processImport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">ยืนยันนำเข้า</button></div></div>) : (<div className="animate-in fade-in py-4 text-center space-y-4"><div className="text-slate-600 text-sm">เลือกโปรเจกต์ต้นทางที่ต้องการคัดลอกรายชื่อกลุ่มมาใช้</div><select className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" value={sourceProject} onChange={e => setSourceProject(e.target.value)}><option value="">-- เลือกโปรเจกต์ต้นทาง --</option>{availableProjects.map((p, i) => <option key={i} value={p}>{p}</option>)}</select><div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button><button onClick={handleReuse} disabled={!sourceProject} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">คัดลอกข้อมูล</button></div></div>)}</div></div>);
  };

  const renderStudentLogin = () => {
    const projectGroups = getGroupsByProject(loginProject);
    const selectedGroupObj = projectGroups.find(g => g.name === loginGroup);
    const isClosed = loginProject && !projectStatus[loginProject];
    return (
      <div className="max-w-md mx-auto py-10 px-4 animate-in fade-in zoom-in-95 duration-300">
        <button onClick={() => setView('landing')} className="mb-6 text-slate-500 flex items-center gap-1 hover:text-slate-800"><ArrowRight className="rotate-180" size={16}/> กลับหน้าหลัก</button>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm"><User size={32} /></div><h2 className="text-xl font-bold">เข้าสู่ระบบนักเรียน</h2><p className="text-amber-100 text-sm">Peer Evaluation System</p></div>
          <div className="p-8 space-y-5">
            <div><label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Layers size={16} className="text-amber-500"/> 1. เลือกโปรเจกต์</label><select className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-amber-400 transition" value={loginProject} onChange={e => { setLoginProject(e.target.value); setLoginGroup(''); setLoginMemberLabel(''); setLoginMemberId(''); }}><option value="">-- เลือกโปรเจกต์ --</option>{projectList.map((p, i) => <option key={i} value={p}>{p}</option>)}</select></div>
            {isClosed && (<div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-center gap-2 text-red-600 text-sm"><AlertTriangle size={18}/> โปรเจกต์นี้ปิดรับการประเมินแล้ว</div>)}
            <div className={`transition-all duration-300 ${loginProject && !isClosed ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}><label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Users size={16} className="text-amber-500"/> 2. เลือกกลุ่มโครงงาน</label><select className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-amber-400 transition" value={loginGroup} onChange={e => { setLoginGroup(e.target.value); setLoginMemberLabel(''); setLoginMemberId(''); }}><option value="">-- เลือกกลุ่ม --</option>{projectGroups.length > 0 ? (projectGroups.map((g, i) => <option key={i} value={g.name}>{g.name}</option>)) : (<option disabled>ไม่มีข้อมูลกลุ่มในโปรเจกต์นี้</option>)}</select></div>
            <div className={`transition-all duration-300 ${loginGroup && !isClosed ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}><label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16} className="text-amber-500"/> 3. เลือกชื่อของคุณ</label><select className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-amber-400 transition" value={loginMemberLabel} onChange={e => { const member = selectedGroupObj?.membersArray.find(m => m.label === e.target.value); setLoginMemberLabel(member?.label || ''); setLoginMemberId(member?.id || ''); setStudentAuthInput(''); }}><option value="">-- เลือกชื่อผู้ประเมิน --</option>{selectedGroupObj?.membersArray.map((m, i) => <option key={i} value={m.label}>{m.label}</option>)}</select></div>
            {loginMemberId && !isClosed && (<div className="animate-in fade-in slide-in-from-top-2"><label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Key size={16} className="text-amber-500"/> 4. ยืนยันรหัสนิสิต (Password)</label><div className="relative"><Key size={18} className="absolute left-3 top-3.5 text-slate-400"/><input type="text" className="w-full pl-10 p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-400 font-mono tracking-widest transition" placeholder="Enter ID" value={studentAuthInput} onChange={e => setStudentAuthInput(e.target.value)}/></div></div>)}
            <button onClick={handleStudentLogin} disabled={!loginProject || !loginGroup || !loginMemberLabel || isClosed} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg shadow-slate-300 hover:bg-slate-900 disabled:opacity-50 disabled:shadow-none transition transform active:scale-95">เข้าสู่ระบบ</button>
          </div>
        </div>
      </div>
    );
  };

  const renderStudentDashboard = () => {
    if (!studentSession) return null;
    const groupObj = importedGroups.find(g => g.name === studentSession.groupName && g.project === studentSession.project);
    const peers = groupObj?.membersArray.filter(m => m.label !== studentSession.memberLabel) || [];
    const getStatus = (peerName: string) => { return peerEvaluations.some(e => e.project === studentSession.project && e.groupName === studentSession.groupName && e.evaluator === studentSession.memberLabel && e.target === peerName); };
    const evaluatedCount = peers.filter(p => getStatus(p.label)).length;
    const totalPeers = peers.length;
    const isAllDone = evaluatedCount === totalPeers && totalPeers > 0;

    return (
      <div className="max-w-2xl mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6"><div><h1 className="text-xl font-bold text-slate-800">Dashboard</h1><span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">{studentSession.project}</span></div><button onClick={handleStudentLogout} className="text-sm text-red-600 font-medium hover:bg-red-50 px-3 py-1 rounded-full border border-transparent hover:border-red-100 transition">ออกจากระบบ</button></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xl">{studentSession.memberLabel.charAt(0)}</div><div><p className="text-slate-500 text-xs uppercase tracking-wider">Welcome,</p><h2 className="text-lg font-bold text-slate-800">{studentSession.memberLabel}</h2><span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{studentSession.groupName}</span></div></div><div className="text-right"><p className="text-slate-400 text-xs">Progress</p><p className={`text-2xl font-bold ${isAllDone ? 'text-green-600' : 'text-slate-800'}`}>{evaluatedCount}/{totalPeers}</p></div></div>
        {studentSuccessMsg && (<div className="bg-green-100 border border-green-200 text-green-800 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2"><CheckCircle size={18} className="text-green-600" /> {studentSuccessMsg}</div>)}
        <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider ml-1">เพื่อนในทีมที่ต้องประเมิน</h3>
        <div className="space-y-3">{peers.length === 0 ? (<div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">ไม่มีสมาชิกอื่นในกลุ่ม</div>) : (peers.map((peer, idx) => { const isDone = getStatus(peer.label); return (<button key={idx} disabled={isDone} onClick={() => startVote(peer.label)} className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all text-left group ${isDone ? 'bg-slate-50 border-slate-200 opacity-60 cursor-default' : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer'}`}><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{isDone ? <Check size={16}/> : peer.label.charAt(0)}</div><span className={`font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{peer.label}</span></div><div>{isDone ? (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">เรียบร้อย</span>) : (<span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded group-hover:bg-amber-500 group-hover:text-white transition">ให้คะแนน</span>)}</div></button>); }))}</div>
        {isAllDone && (<div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6 text-center animate-in zoom-in-95"><div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3"><Trophy size={32} /></div><h3 className="text-lg font-bold text-green-800">ประเมินครบทุกคนแล้ว!</h3><p className="text-green-600 text-sm mb-4">ขอบคุณสำหรับความร่วมมือครับ</p><button onClick={handleStudentLogout} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">ออกจากระบบ</button></div>)}
      </div>
    );
  };

  const renderStudentVote = () => {
    return (
      <div className="max-w-xl mx-auto py-8 px-4 animate-in slide-in-from-right-4 duration-300">
         <button onClick={() => setView('student-dashboard')} className="mb-4 text-slate-500 flex items-center gap-1 hover:text-slate-800"><ArrowRight className="rotate-180" size={16}/> ย้อนกลับ</button>
         <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-amber-100">
            <div className="bg-amber-500 p-6 text-white flex justify-between items-center"><div><p className="text-amber-100 text-xs mb-1">กำลังให้คะแนน</p><h2 className="text-2xl font-bold">{targetLabel}</h2></div><div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><FileText size={20} /></div></div>
            <div className="p-6 space-y-8">
               {currentScores.map(criteria => (<div key={criteria.id}><div className="flex justify-between mb-2 items-end"><span className="font-bold text-slate-700">{criteria.name}</span><span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{criteria.score}/5</span></div><input type="range" min="0" max="5" step="1" className="w-full accent-amber-500 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={criteria.score} onChange={(e) => handleScoreChange(criteria.id, e.target.value)} /><div className="flex justify-between text-xs text-slate-400 mt-2 font-mono"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div></div>))}
               <button onClick={submitVote} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition flex items-center justify-center gap-2 text-lg"><CheckCircle size={24} /> บันทึกคะแนน</button>
            </div>
         </div>
      </div>
    );
  };

  // ==============================
  // 5. MAIN RENDER
  // ==============================
  if (loading && view === 'landing') {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={40}/><p className="text-slate-500 font-bold">Connecting to Database...</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Lock size={32} /></div>
             <h3 className="text-xl font-bold mb-2">{authMode === 'login' ? 'Teacher Login' : 'Register Teacher'}</h3>
             
             <div className="space-y-4 text-left">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <div className="relative">
                        <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="name@university.ac.th" />
                    </div>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                    <div className="relative">
                        <Key size={16} className="absolute left-3 top-3 text-slate-400" />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="••••••••" />
                    </div>
                 </div>
             </div>

             <button onClick={handleAuth} disabled={loading} className="w-full mt-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-70 flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={18}/> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
             </button>

             <div className="mt-4 text-xs text-slate-500">
                 {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                 <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-indigo-600 font-bold hover:underline">
                     {authMode === 'login' ? 'Register' : 'Login'}
                 </button>
             </div>
             <button onClick={() => setShowLoginModal(false)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showProjectManager && <ProjectManagerModal onClose={() => setShowProjectManager(false)} />}
      {showCriteriaModal && <CriteriaManagerModal onClose={() => setShowCriteriaModal(false)} />}

      {view === 'landing' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 p-4">
          <div className="text-center space-y-2"><h1 className="text-4xl font-extrabold text-slate-800">PeerEval Pro</h1><p className="text-slate-500">เลือกโหมดการใช้งานของคุณ</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button onClick={() => setView('student-login')} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-amber-400 text-left transition-all"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600 group-hover:scale-110 transition"><User size={24} /></div><h2 className="text-2xl font-bold text-slate-800 mb-2">สำหรับนักเรียน</h2><p className="text-slate-500 text-sm">เข้าสู่ระบบเพื่อประเมินเพื่อน (Login)</p></button>
            <button onClick={() => setShowLoginModal(true)} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-indigo-500 text-left transition-all"><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600 group-hover:scale-110 transition"><Lock size={24} /></div><h2 className="text-2xl font-bold text-slate-800 mb-2">สำหรับอาจารย์</h2><p className="text-slate-500 text-sm">ประเมินโครงงาน และสรุปคะแนน</p></button>
          </div>
        </div>
      )}

      {view === 'student-login' && renderStudentLogin()}
      {view === 'student-dashboard' && renderStudentDashboard()}
      {view === 'student-vote' && renderStudentVote()}

      {view === 'teacher' && (
        <div className="max-w-6xl mx-auto py-6 space-y-6 p-4">
           <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-600 flex flex-col md:flex-row justify-between items-center gap-4">
             <div><h1 className="text-xl font-bold text-slate-800">Teacher Dashboard</h1><p className="text-xs text-slate-500">Manage scores for multiple projects</p></div>
             <div className="flex items-center gap-3"><div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200"><span className="text-xs font-bold text-slate-500 uppercase px-2">Project:</span><select value={teacherProject} onChange={(e) => { setTeacherProject(e.target.value); setCurrentGroup(null); }} className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2 outline-none font-semibold cursor-pointer">{projectList.map((p, i) => <option key={i} value={p}>{p}</option>)}</select><button onClick={() => setShowProjectManager(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition" title="จัดการรายชื่อโปรเจกต์"><Settings size={18} /></button></div><button onClick={toggleProjectStatus} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-all ${projectStatus[teacherProject] ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`} title={projectStatus[teacherProject] ? "คลิกเพื่อปิดรับการประเมิน" : "คลิกเพื่อเปิดรับการประเมิน"}><Power size={16}/> {projectStatus[teacherProject] ? 'เปิดรับ (Open)' : 'ปิดรับ (Closed)'}</button></div>
             <div className="flex items-center gap-3"><button onClick={() => setShowImport(true)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 transition"><Upload size={16}/> นำเข้ากลุ่ม</button><button onClick={handleExportExcel} className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-2 rounded hover:bg-green-100 transition"><FileSpreadsheet size={16}/> Export Excel</button><button onClick={handleSignOut} className="flex items-center gap-1 text-sm bg-red-50 text-red-700 px-3 py-2 rounded hover:bg-red-100 transition"><LogOut size={16}/> ออกจากระบบ</button></div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             <div className="lg:col-span-8 space-y-6">
               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 min-h-[500px]">
                  <div className="mb-6 pb-6 border-b border-slate-100">
                    <label className="block text-sm font-bold text-slate-700 mb-2">เลือกกลุ่ม ({teacherProject})</label>
                    <select value={currentGroup?.name || ''} onChange={e => handleGroupSelect(e.target.value)} className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-200">
                      <option value="">-- เลือกกลุ่มที่จะประเมิน --</option>
                      {getGroupsByProject(teacherProject).map((g,i) => <option key={i} value={g.name}>{g.name}</option>)}
                    </select>
                    {currentGroup ? (<div className="mt-3 text-sm text-slate-600 bg-indigo-50 p-3 rounded-lg border border-indigo-100"><strong>สมาชิก:</strong> {currentGroup.membersString}</div>) : (<div className="mt-8 text-center text-slate-400 py-10"><Users size={48} className="mx-auto mb-2 opacity-20"/><p>เลือกกลุ่มด้านบนเพื่อเริ่มให้คะแนน</p></div>)}
                  </div>
                  {currentGroup && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-indigo-700 flex items-center gap-2 bg-indigo-50 p-2 rounded-lg w-fit pr-4"><FileText size={20}/> ส่วนที่ 1: คะแนนกลุ่ม (14 คะแนน)</h3><button onClick={() => setShowCriteriaModal(true)} className="text-xs flex items-center gap-1 bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 shadow-sm transition"><Pencil size={14}/> แก้ไขเกณฑ์</button></div>
                      {groupCriteria.map((item) => (
                        <div key={item.id} className="pb-4 border-b border-slate-50 last:border-0">
                          <div className="flex justify-between mb-2"><span className="font-medium text-slate-800">{item.name}</span><span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 rounded">{item.score}/5</span></div>
                          <div className="grid grid-cols-3 gap-2">{item.options.map(opt => (<button key={opt.score} onClick={() => setGroupCriteria(groupCriteria.map(c => c.id === item.id ? {...c, score: opt.score} : c))} className={`p-3 text-left rounded-lg border text-xs transition-all ${item.score === opt.score ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-50 hover:border-indigo-300'}`}><div className="font-bold text-sm mb-1">{opt.score} คะแนน</div><div className="opacity-90 leading-tight">{opt.desc}</div></button>))}</div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>
             </div>
             <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg sticky top-6">
                   <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-300 uppercase tracking-wider text-sm"><Calculator size={16}/> สรุปคะแนน ({teacherProject})</h3>
                   <div className="space-y-4 text-sm mb-6">
                     <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"><span className="text-slate-300">คะแนนกลุ่ม (14%)</span><span className="font-mono text-xl font-bold">{calculateScores().weightedGroupScore.toFixed(2)}</span></div>
                     <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"><div className="flex flex-col"><span className="text-slate-300">คะแนน Peer (6%)</span><span className="text-[10px] text-slate-400">จากเพื่อน {calculateScores().groupEvalsCount} คน</span></div><span className="font-mono text-xl font-bold">{calculateScores().weightedIndivScore.toFixed(2)}</span></div>
                     <div className="pt-4 border-t border-slate-600 flex justify-between items-end"><span className="text-indigo-400 font-bold text-lg">Total Score</span><span className="text-4xl font-bold tracking-tight">{(calculateScores().weightedGroupScore + calculateScores().weightedIndivScore).toFixed(2)}</span></div>
                   </div>
                   <button disabled={!currentGroup} onClick={saveFinalRecord} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/50 disabled:opacity-50 disabled:shadow-none transition transform active:scale-95 flex justify-center items-center gap-2"><Save size={18}/> บันทึกคะแนนกลุ่มนี้</button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 max-h-[400px] overflow-hidden flex flex-col">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 pb-2 border-b"><Trophy size={18} className="text-yellow-500"/> ประเมินแล้ว ({records.filter(r => r.project === teacherProject).length})</h3>
                  <div className="overflow-y-auto pr-1 space-y-2 flex-grow">
                    {records.filter(r => r.project === teacherProject).length === 0 ? (<p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูลในโปรเจกต์นี้</p>) : (records.filter(r => r.project === teacherProject).map(r => (<div key={r.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50 text-sm flex justify-between items-center hover:shadow-sm transition"><span className="font-medium text-slate-700">{r.groupName}</span><div className="text-right"><span className="font-bold text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 block">{r.totalScore.toFixed(2)}</span><span className="text-[10px] text-slate-400"><Clock size={10} className="inline mr-1"/>{new Date(r.id).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}</span></div></div>)))}
                  </div>
                </div>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
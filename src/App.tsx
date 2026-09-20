
import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, User, Users, Trophy, CheckCircle, Calculator, FileText, Upload, 
  Lock, LogOut, ArrowRight, Key, Check, Layers, Plus, Copy, Settings, 
  Edit2, Trash2, X, Pencil, FileSpreadsheet, Clock, Power, 
  AlertTriangle, Mail, Loader2
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ==============================
// SUPABASE CONFIG
// ==============================
const supabaseUrl = 'https://ewjbfxerlbnmreeywamg.supabase.co';
const supabaseKey = 'sb_publishable_5lfD7JnOoOJ7r-MGoFieKA_4Oh_QCHP';

const supabase = createClient(supabaseUrl, supabaseKey);

// บัญชีนิสิตใช้อีเมลที่สร้างจากรหัสนิสิต (ไม่ได้ใช้ส่งเมลจริง)
// ถ้าเปลี่ยนโดเมน ต้องแก้ให้ตรงกันทั้ง 3 ที่:
// public.student_email() ใน supabase/student-auth.sql และ supabase/functions/student-admin/index.ts
const STUDENT_EMAIL_DOMAIN = 'up.ac.th';
const studentEmailOf = (studentId: string) => `${studentId.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;

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
  section?: string; // SEC / ตอนเรียน — เพิ่มทีหลัง ข้อมูลเก่าจึงไม่มีฟิลด์นี้
  major?: string;   // สาขา — เช่นเดียวกัน
}

interface Group {
  id?: number;
  project: string;
  name: string;
  membersString: string;
  membersArray: Member[];
  myLabel?: string; // ชื่อของนิสิตที่ล็อกอินอยู่ในกลุ่มนี้ (มาจาก view my_groups)
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

// ประกาศนอก App เพราะคอมโพเนนต์ที่ประกาศข้างในจะถูก remount ทุกครั้งที่ App re-render
// ซึ่งจะล้างค่าที่พิมพ์ค้างไว้ในช่องรหัสผ่าน (เช่นตอน setLoading)
const ChangePasswordModal = ({ forced, loading, onSubmit, onClose, onLogout }: {
  forced: boolean;
  loading: boolean;
  onSubmit: (newPass: string, confirmPass: string) => void;
  onClose: () => void;
  onLogout: () => void;
}) => {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2"><Key size={20} className="text-amber-600"/> {forced ? 'ตั้งรหัสผ่านใหม่' : 'เปลี่ยนรหัสผ่าน'}</h3>
          {!forced && <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>}
        </div>
        {forced && <p className="text-sm text-slate-500 mb-4">คุณกำลังใช้รหัสผ่านเริ่มต้น ต้องตั้งรหัสใหม่ก่อนจึงจะใช้งานต่อได้</p>}
        <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); onSubmit(newPass, confirmPass); }}>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">รหัสผ่านใหม่</label>
            <input type="password" autoComplete="new-password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-amber-400 text-sm" placeholder="อย่างน้อย 6 ตัวอักษร"/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">ยืนยันรหัสผ่านใหม่</label>
            <input type="password" autoComplete="new-password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-amber-400 text-sm" placeholder="พิมพ์ซ้ำอีกครั้ง"/>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50 flex justify-center items-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin"/>} บันทึกรหัสผ่าน
          </button>
          {forced && <button type="button" onClick={onLogout} className="w-full text-xs text-slate-400 hover:text-slate-600">ออกจากระบบ</button>}
        </form>
      </div>
    </div>
  );
};

// แปลง error ดิบจาก Postgres/PostgREST เป็นคำแนะนำว่าต้องทำอะไร
// เกือบทุกกรณีเกิดจากยังรันไฟล์ SQL ในโฟลเดอร์ supabase/ ไม่ครบ
const explainDbError = (msg: string) => {
  if (/ON CONFLICT specification/i.test(msg))
    return 'ตาราง groups ยังไม่มี unique constraint ที่การนำเข้าต้องใช้\n\nรัน supabase/groups-unique.sql ขั้นที่ 3 ใน Supabase SQL Editor ก่อน แล้วลองใหม่';
  if (/Could not find the function|schema cache/i.test(msg))
    return 'ยังไม่ได้สร้างฟังก์ชันที่ต้องใช้ในฐานข้อมูล\n\nรันไฟล์ SQL ในโฟลเดอร์ supabase/ ให้ครบก่อน\n\n(' + msg + ')';
  if (/column .* does not exist/i.test(msg))
    return 'โครงสร้างฐานข้อมูลยังไม่ตรงกับเวอร์ชันของแอป\n\nรันไฟล์ SQL ในโฟลเดอร์ supabase/ ให้ครบก่อน\n\n(' + msg + ')';
  return msg;
};

// =========================================================
//  การอ่านรายชื่อนำเข้า
// =========================================================
//  รูปแบบมาตรฐาน 5 คอลัมน์: กลุ่ม, SEC, รหัสนิสิต, ชื่อ-นามสกุล, สาขา
//  รับได้ทั้งพิมพ์เอง วางจาก Excel (คั่นด้วย tab) ไฟล์ .csv และ .xlsx
//  ทุกทางถูกแปลงเป็น string[][] แล้วเข้าฟังก์ชันแปลงชุดเดียวกัน

// แยกคอลัมน์ในหนึ่งบรรทัด: มี tab ใช้ tab (วางจาก Excel) ไม่มีก็ใช้จุลภาค
// รองรับค่าที่ครอบด้วยเครื่องหมายคำพูด เผื่อชื่อหรือสาขามีจุลภาคอยู่ข้างใน
const splitImportLine = (line: string): string[] => {
  const delim = line.includes('\t') ? '\t' : ',';
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      cells.push(cur); cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map(c => c.trim());
};

const textToRows = (raw: string): string[][] =>
  raw.split(/\r?\n/).map(splitImportLine).filter(cells => cells.some(c => c !== ''));

// แถวหัวตารางไม่มีรหัสนิสิต (ตัวเลข 3 หลักขึ้นไป) แต่มีคำที่เป็นชื่อคอลัมน์
const looksLikeHeader = (cells: string[]) => {
  const joined = cells.join(' ').toLowerCase();
  if (/\d{3,}/.test(joined)) return false;
  return ['กลุ่ม', 'group', 'รหัส', 'sec', 'ชื่อ', 'สาขา', 'name'].some(h => joined.includes(h));
};

// แปลงแถวดิบเป็นกลุ่ม + สมาชิก
// คอลัมน์ที่ 2 เป็นรหัสนิสิต = ไฟล์รูปแบบเดิมที่ไม่มี SEC ยังนำเข้าได้
const rowsToGroups = (rows: string[][]) => {
  const groupsMap = new Map<string, Member[]>();
  rows.forEach((cells, idx) => {
    if (idx === 0 && looksLikeHeader(cells)) return;
    const groupName = (cells[0] ?? '').trim();
    if (!groupName) return;

    const hasSection = !/^\d{3,}$/.test((cells[1] ?? '').trim());
    const section = hasSection ? (cells[1] ?? '').trim() : '';
    const rest = hasSection ? cells.slice(2) : cells.slice(1);
    const id = (rest[0] ?? '').trim();
    const name = (rest[1] ?? '').trim();
    const major = (rest[2] ?? '').trim();
    if (!id && !name) return;

    const member: Member = { id, name, label: name, section, major };
    groupsMap.set(groupName, [...(groupsMap.get(groupName) ?? []), member]);
  });
  return groupsMap;
};

// สัดส่วนคะแนนของโปรเจกต์ อาจารย์กี่ % เพื่อนกี่ %
const WeightModal = ({ project, initial, busy, onSave, onClose }: {
  project: string;
  initial: { teacher: number; peer: number };
  busy: boolean;
  onSave: (w: { teacher: number; peer: number }) => void;
  onClose: () => void;
}) => {
  const [teacher, setTeacher] = useState(String(initial.teacher));
  const [peer, setPeer] = useState(String(initial.peer));
  const t = Number(teacher) || 0;
  const p = Number(peer) || 0;

  const submit = () => {
    if (t < 0 || p < 0) return alert('น้ำหนักต้องไม่ติดลบ');
    if (t + p <= 0) return alert('น้ำหนักรวมต้องมากกว่า 0');
    onSave({ teacher: t, peer: p });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20} className="text-indigo-600"/> สัดส่วนคะแนน</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">โปรเจกต์ <span className="font-bold">{project}</span></p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">คะแนนจากอาจารย์ (%)</label>
            <input type="number" min={0} step="0.5" value={teacher} onChange={e => setTeacher(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">คะแนนจากเพื่อน (%)</label>
            <input type="number" min={0} step="0.5" value={peer} onChange={e => setPeer(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center bg-slate-800 text-white p-3 rounded-lg">
          <span className="text-sm text-slate-300">รวมทั้งหมด</span>
          <span className="font-mono text-xl font-bold">{(t + p).toFixed(2).replace(/\.00$/, '')}%</span>
        </div>

        <p className="text-xs text-slate-500 mt-3 leading-relaxed">
          คะแนนดิบถูกคิดเป็นสัดส่วนก่อนคูณน้ำหนักเสมอ เปลี่ยนตัวเลขแล้วคะแนนทุกกลุ่มในโปรเจกต์นี้จะถูกคิดใหม่ทันที รวมกลุ่มที่ประเมินไปแล้ว
        </p>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 size={16} className="animate-spin"/>} บันทึก
          </button>
        </div>
      </div>
    </div>
  );
};

// เกณฑ์ที่นิสิตใช้ประเมินกันเอง แยกคนละชุดกับเกณฑ์ของอาจารย์
const StudentCriteriaModal = ({ project, initial, peerWeight, busy, onSave, onClose }: {
  project: string;
  initial: StudentCriterion[];
  peerWeight: number;
  busy: boolean;
  onSave: (rows: StudentCriterion[]) => void;
  onClose: () => void;
}) => {
  const [rows, setRows] = useState<StudentCriterion[]>(initial.map(c => ({ ...c })));
  const total = rows.reduce((s, r) => s + (Number(r.max) || 0), 0);

  const setRow = (i: number, patch: Partial<StudentCriterion>) =>
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = () => {
    const cleaned = rows
      .map(r => ({ name: r.name.trim(), max: Math.floor(Number(r.max) || 0), score: 0 }))
      .filter(r => r.name || r.max > 0);
    if (cleaned.length === 0) return alert('ต้องมีเกณฑ์อย่างน้อย 1 ข้อ');
    const noName = cleaned.filter(r => !r.name);
    if (noName.length > 0) return alert(`มีเกณฑ์ที่ไม่ได้ตั้งชื่อ ${noName.length} ข้อ`);
    const badMax = cleaned.filter(r => r.max < 1);
    if (badMax.length > 0) return alert(`คะแนนเต็มต้องมากกว่า 0: ${badMax.map(r => r.name).join(', ')}`);
    // ชื่อซ้ำจะยุบเป็นคอลัมน์เดียวกันตอน export และนิสิตก็แยกไม่ออกว่าข้อไหนเป็นข้อไหน
    const dupNames = cleaned.map(r => r.name).filter((n, i, arr) => arr.indexOf(n) !== i);
    if (dupNames.length > 0) return alert(`หัวข้อซ้ำกัน: ${Array.from(new Set(dupNames)).join(', ')}`);
    // ออก id ใหม่เรียงลำดับ ป้องกัน id ซ้ำหลังเพิ่ม/ลบหลายรอบ
    onSave(cleaned.map((r, i) => ({ ...r, id: i + 1 })));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2"><Users size={20} className="text-amber-600"/> เกณฑ์ประเมินเพื่อน</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">โปรเจกต์ <span className="font-bold">{project}</span> — เกณฑ์ชุดนี้คือสิ่งที่นิสิตเห็นตอนให้คะแนนเพื่อน</p>

        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase px-1 mb-1">
          <span className="col-span-8">หัวข้อ</span><span className="col-span-3">คะแนนเต็ม</span><span className="col-span-1"/>
        </div>
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input value={r.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="เช่น ความรับผิดชอบ"
                className="col-span-8 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-amber-400"/>
              <input type="number" min={1} value={r.max} onChange={e => setRow(i, { max: Number(e.target.value) })}
                className="col-span-3 p-2 border rounded text-sm font-mono outline-none focus:ring-2 focus:ring-amber-400"/>
              <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))} title="ลบเกณฑ์ข้อนี้"
                className="col-span-1 text-slate-300 hover:text-red-500 flex justify-center transition"><X size={16}/></button>
            </div>
          ))}
        </div>

        <button onClick={() => setRows(prev => [...prev, { id: prev.length + 1, name: '', max: 5, score: 0 }])}
          className="mt-3 text-xs text-amber-600 hover:underline flex items-center gap-1"><Plus size={12}/> เพิ่มเกณฑ์</button>

        <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-xs leading-relaxed">
          คะแนนเต็มรวม <span className="font-bold font-mono">{total}</span> คะแนน ระบบคิดเป็นสัดส่วนแล้วถ่วงเป็น <span className="font-bold font-mono">{peerWeight}%</span> ตามที่ตั้งไว้ในสัดส่วนคะแนนของโปรเจกต์นี้ ไม่ว่าคะแนนเต็มจะเป็นเท่าไร<br/>
          <span className="font-bold">คะแนนที่นิสิตส่งไปแล้วจะถูกคิดด้วยคะแนนเต็มใหม่ทันที</span> ถ้าแก้หลังเริ่มประเมินแล้ว ควรให้นิสิตประเมินใหม่
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button>
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 size={16} className="animate-spin"/>} บันทึกเกณฑ์
          </button>
        </div>
      </div>
    </div>
  );
};

// แก้ไข/ลบกลุ่มทีละกลุ่ม ประกาศนอก App ด้วยเหตุผลเดียวกับ ChangePasswordModal
// ทุกการบันทึกวิ่งผ่าน RPC เพราะต้องแก้หลายตารางพร้อมกันในทรานแซกชันเดียว
const GroupEditor = ({ group, project, onChanged }: { group: Group; project: string; onChanged: () => void }) => {
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState<Member[]>(group.membersArray.map(m => ({ ...m })));
  const [busy, setBusy] = useState(false);

  const setMember = (i: number, patch: Partial<Member>) =>
    setMembers(prev => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const save = async () => {
    // label คือตัวระบุตัวตนในคะแนน ตั้งให้ตรงกับชื่อเสมอเหมือนตอน import
    const cleaned = members
      .map(m => ({ id: m.id.trim(), name: m.name.trim(), label: m.name.trim(), section: (m.section ?? '').trim(), major: (m.major ?? '').trim() }))
      .filter(m => m.name || m.id);

    if (cleaned.length === 0) return alert('ต้องมีสมาชิกอย่างน้อย 1 คน');
    const noName = cleaned.filter(m => !m.name);
    if (noName.length > 0) return alert(`มีสมาชิกที่ไม่ได้กรอกชื่อ ${noName.length} คน`);
    const noId = cleaned.filter(m => !m.id).map(m => m.name);
    if (noId.length > 0) return alert(`ต้องมีรหัสนิสิตครบทุกคน ขาด: ${noId.join(', ')}`);
    const dupLabels = cleaned.map(m => m.label).filter((l, i, arr) => arr.indexOf(l) !== i);
    if (dupLabels.length > 0) return alert(`ชื่อซ้ำกันในกลุ่ม: ${Array.from(new Set(dupLabels)).join(', ')}`);
    const dupIds = cleaned.map(m => m.id).filter((v, i, arr) => arr.indexOf(v) !== i);
    if (dupIds.length > 0) return alert(`รหัสนิสิตซ้ำกันในกลุ่ม: ${Array.from(new Set(dupIds)).join(', ')}`);

    setBusy(true);
    const { error } = await supabase.rpc('save_group', {
      p_project: project, p_group_id: group.id, p_new_name: name.trim(), p_members: cleaned,
    });
    setBusy(false);
    if (error) return alert('บันทึกไม่สำเร็จ: ' + explainDbError(error.message));
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`ลบกลุ่ม "${group.name}"?\n\nคะแนนที่อาจารย์ให้ คะแนนที่เพื่อนประเมิน และเสียงโหวตของกลุ่มนี้จะถูกลบไปด้วยทั้งหมด กู้คืนไม่ได้`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_group', { p_project: project, p_group_id: group.id });
    setBusy(false);
    if (error) return alert('ลบไม่สำเร็จ: ' + explainDbError(error.message));
    onChanged();
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 space-y-3">
      <div className="flex gap-2 items-center">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อกลุ่ม"
          className="flex-grow p-2 border rounded text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"/>
        <button onClick={remove} disabled={busy} title="ลบกลุ่มนี้"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50 transition"><Trash2 size={16}/></button>
      </div>

      <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase px-1">
        <span className="col-span-2">SEC</span><span className="col-span-3">รหัสนิสิต</span><span className="col-span-3">ชื่อ-นามสกุล</span><span className="col-span-3">สาขา</span><span className="col-span-1"/>
      </div>
      {members.map((m, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={m.section ?? ''} onChange={e => setMember(i, { section: e.target.value })} placeholder="SEC-01"
            className="col-span-2 p-2 border rounded text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400"/>
          <input value={m.id} onChange={e => setMember(i, { id: e.target.value })} placeholder="68938494"
            className="col-span-3 p-2 border rounded text-sm font-mono outline-none focus:ring-2 focus:ring-blue-400"/>
          <input value={m.name} onChange={e => setMember(i, { name: e.target.value })} placeholder="ชื่อ-นามสกุล"
            className="col-span-3 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-400"/>
          <input value={m.major ?? ''} onChange={e => setMember(i, { major: e.target.value })} placeholder="สาขา"
            className="col-span-3 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-400"/>
          <button onClick={() => setMembers(prev => prev.filter((_, j) => j !== i))} title="ลบสมาชิก"
            className="col-span-1 text-slate-300 hover:text-red-500 flex justify-center transition"><X size={16}/></button>
        </div>
      ))}

      <button onClick={() => setMembers(prev => [...prev, { id: '', name: '', label: '', section: '', major: '' }])}
        className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12}/> เพิ่มสมาชิก</button>

      <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-200">
        <span className="text-[11px] text-slate-400 leading-tight">แก้รหัสนิสิตแล้วบัญชีเดิมของคนนั้นจะใช้ไม่ได้ ต้องกด "สร้างบัญชีนิสิต" ใหม่</span>
        <button onClick={save} disabled={busy}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 shrink-0">
          {busy && <Loader2 size={14} className="animate-spin"/>} บันทึก
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'landing' | 'teacher' | 'student-login' | 'student-dashboard' | 'student-vote'>('landing');
  
  const [projectList, setProjectList] = useState<string[]>([]);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>({});
  const [allProjectCriteria, setAllProjectCriteria] = useState<ProjectCriteriaMap>({});
  const [allStudentCriteria, setAllStudentCriteria] = useState<Record<string, StudentCriterion[]>>({});
  const [projectWeights, setProjectWeights] = useState<Record<string, { teacher: number; peer: number }>>({});
  const [records, setRecords] = useState<TeacherRecord[]>([]); 
  const [peerEvaluations, setPeerEvaluations] = useState<PeerEval[]>([]); 
  const [importedGroups, setImportedGroups] = useState<Group[]>([]); 

  const [, setSession] = useState<any>(null);
  const [teacherProject, setTeacherProject] = useState<string>(''); 
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null); 
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [showStudentCriteria, setShowStudentCriteria] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  
  const [groupCriteria, setGroupCriteria] = useState<TeacherCriterion[]>([]);

  const [projectVoteOpen, setProjectVoteOpen] = useState<ProjectStatus>({});
  const [votableGroups, setVotableGroups] = useState<{ project: string; name: string }[]>([]);
  const [myVote, setMyVote] = useState<Record<string, string>>({});
  const [voteResults, setVoteResults] = useState<{ project: string; group: string; votes: number }[]>([]);

  const [sessionRole, setSessionRole] = useState<'teacher' | 'student' | null>(null);
  const [studentIdInput, setStudentIdInput] = useState('');
  const [studentPasswordInput, setStudentPasswordInput] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null); 
  const [targetLabel, setTargetLabel] = useState('');
  const [currentScores, setCurrentScores] = useState<StudentCriterion[]>(defaultCriteriaTemplate.map(c => ({...c})));
  const [studentSuccessMsg, setStudentSuccessMsg] = useState('');

  // ข้อมูล Popular Vote ใช้ query ชุดเดียวกันทั้งอาจารย์และนิสิต ต่างกันที่ RLS คืนข้อมูลให้ไม่เท่ากัน
  // ไม่ throw เมื่อ error เพื่อให้หน้าอื่นยังทำงานได้ถ้ายังไม่ได้รัน popular-vote.sql
  const loadVoteData = async (userId: string) => {
    const [vg, mv, vr] = await Promise.all([
      supabase.from('votable_groups').select('*'),
      supabase.from('popular_votes').select('project_name, group_name').eq('voter_id', userId),
      supabase.from('popular_vote_results').select('*'),
    ]);
    if (vg.error || mv.error || vr.error) {
      console.error('Popular vote data unavailable:', vg.error?.message ?? mv.error?.message ?? vr.error?.message);
      return;
    }
    setVotableGroups((vg.data ?? []).map((g: any) => ({ project: g.project_name, name: g.name })));
    const mine: Record<string, string> = {};
    (mv.data ?? []).forEach((v: any) => mine[v.project_name] = v.group_name);
    setMyVote(mine);
    setVoteResults((vr.data ?? []).map((r: any) => ({ project: r.project_name, group: r.group_name, votes: r.votes })));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // RLS ไม่เปิดข้อมูลใดๆ ให้ anon อีกแล้ว ยังไม่ล็อกอินก็ไม่ต้องยิง query
        setProjectList([]); setProjectStatus({}); setImportedGroups([]);
        setPeerEvaluations([]); setRecords([]);
        return;
      }
      const isStudent = session.user.app_metadata?.role === 'student';

      // เกณฑ์การให้คะแนน อ่านได้ทั้งอาจารย์และนิสิต
      const { data: criteria, error: critErr } = await supabase.from('criteria').select('*');
      if (critErr) throw critErr;
      const criteriaMap: ProjectCriteriaMap = {};
      const studentMap: Record<string, StudentCriterion[]> = {};
      (criteria ?? []).forEach((c: any) => {
        criteriaMap[c.project_name] = c.data;
        // student_data เป็น null ในโปรเจกต์ที่ยังไม่เคยตั้งเกณฑ์เอง ใช้ค่าเริ่มต้นแทน
        if (Array.isArray(c.student_data) && c.student_data.length > 0) studentMap[c.project_name] = c.student_data;
      });
      setAllStudentCriteria(studentMap);

      if (isStudent) {
        // นิสิตอ่านตาราง groups/projects ตรงๆ ไม่ได้ ใช้ view my_groups ที่ตัดรหัสนิสิตออกแล้ว
        const { data: mine, error: mineErr } = await supabase.from('my_groups').select('*');
        if (mineErr) throw mineErr;

        setImportedGroups((mine ?? []).map((g: any) => ({
          id: g.id,
          project: g.project_name,
          name: g.name,
          myLabel: g.my_label,
          membersArray: (g.members ?? []) as Member[],
          membersString: ''
        })));

        const pList: string[] = Array.from(new Set((mine ?? []).map((g: any) => g.project_name)));
        const pStatus: ProjectStatus = {};
        const pVote: ProjectStatus = {};
        (mine ?? []).forEach((g: any) => { pStatus[g.project_name] = g.is_active; pVote[g.project_name] = !!g.vote_open; });
        setProjectList(pList);
        setProjectStatus(pStatus);
        setProjectVoteOpen(pVote);

        pList.forEach(p => { if (!criteriaMap[p]) criteriaMap[p] = JSON.parse(JSON.stringify(defaultTeacherCriteria)); });
        setAllProjectCriteria(criteriaMap);

        // view นี้คืนเฉพาะรายการที่ตัวเองเป็นผู้ประเมิน และไม่มีคอลัมน์คะแนน
        const { data: status, error: stErr } = await supabase.from('peer_eval_status').select('*');
        if (stErr) throw stErr;
        setPeerEvaluations((status ?? []).map((e: any) => ({
          project: e.project_name, groupName: e.group_name, evaluator: e.evaluator, target: e.target,
          scores: [], totalRaw: 0, timestamp: ''
        })));
        setRecords([]);
        await loadVoteData(session.user.id);
        return;
      }

      // ---------- ฝั่งอาจารย์ ----------
      // บัญชีที่ล็อกอินได้แต่ไม่อยู่ใน whitelist จะอ่านอะไรไม่ได้เลย
      // กันไว้ตรงนี้เพื่อให้ได้ข้อความบอกเหตุผล แทนที่จะเห็นหน้าว่างเปล่า
      const { data: teacherRow } = await supabase.from('teachers').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!teacherRow) {
        await supabase.auth.signOut();
        alert('บัญชีนี้ยังไม่ได้รับสิทธิ์อาจารย์ กรุณาติดต่อผู้ดูแลระบบ');
        return;
      }

      const { data: projects, error: projErr } = await supabase.from('projects').select('*');
      if (projErr) throw projErr;
      const pList: string[] = (projects ?? []).map((p: any) => p.name);
      const pStatus: ProjectStatus = {};
      const pVote: ProjectStatus = {};
      const pWeights: Record<string, { teacher: number; peer: number }> = {};
      (projects ?? []).forEach((p: any) => {
        pStatus[p.name] = p.is_active;
        pVote[p.name] = !!p.vote_open;
        // คอลัมน์น้ำหนักเพิ่มทีหลัง ถ้ายังไม่ได้รัน score-weights.sql จะเป็น undefined
        pWeights[p.name] = { teacher: Number(p.teacher_weight ?? 14), peer: Number(p.peer_weight ?? 6) };
      });
      setProjectList(pList);
      setProjectStatus(pStatus);
      setProjectVoteOpen(pVote);
      setProjectWeights(pWeights);
      if (pList.length > 0 && (!teacherProject || !pList.includes(teacherProject))) {
        setTeacherProject(pList[0]);
      }

      pList.forEach(p => { if (!criteriaMap[p]) criteriaMap[p] = JSON.parse(JSON.stringify(defaultTeacherCriteria)); });
      setAllProjectCriteria(criteriaMap);

      const { data: groups, error: grpErr } = await supabase.from('groups').select('*');
      if (grpErr) throw grpErr;
      setImportedGroups((groups ?? []).map((g: any) => ({
        id: g.id,
        project: g.project_name,
        name: g.name,
        membersArray: g.members,
        membersString: g.members.map((m: any) => m.id ? `${m.id} ${m.name}` : m.name).join(', ')
      })));

      const { data: pEvals, error: peErr } = await supabase.from('peer_evals').select('*');
      if (peErr) throw peErr;
      setPeerEvaluations((pEvals ?? []).map((e: any) => ({
        id: e.id,
        project: e.project_name,
        groupName: e.group_name,
        evaluator: e.evaluator,
        target: e.target,
        scores: e.scores,
        totalRaw: e.total_raw,
        timestamp: e.created_at
      })));

      const { data: tEvals, error: teErr } = await supabase.from('teacher_evals').select('*');
      if (teErr) throw teErr;
      setRecords((tEvals ?? []).map((e: any) => ({
        id: e.created_at,
        project: e.project_name,
        groupName: e.group_name,
        ...e.data,
        totalScore: e.total_score
      })));

      await loadVoteData(session.user.id);

    } catch (error: any) {
      console.error('Error fetching data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // INITIAL_SESSION ถูกยิงตอน subscribe เสมอ จึงไม่ต้องเรียก getSession() แยก
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === 'SIGNED_OUT' || !session) {
        setSessionRole(null); setStudentSession(null); setMustChangePassword(false);
        setView('landing');
        return;
      }

      // role มาจาก app_metadata ซึ่งแก้ได้เฉพาะ service_role นิสิตปลอมเป็นอาจารย์ไม่ได้
      const role = session.user.app_metadata?.role === 'student' ? 'student' : 'teacher';
      setSessionRole(role);
      setMustChangePassword(role === 'student' && !!session.user.user_metadata?.must_change_password);

      // เปลี่ยนหน้าเฉพาะตอนเพิ่งล็อกอินหรือเปิดแอปมาพร้อม session เดิม
      // ไม่ทำตอน TOKEN_REFRESHED ไม่งั้นนิสิตที่กำลังให้คะแนนอยู่จะถูกเด้งกลับ dashboard
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setShowLoginModal(false);
        setView(role === 'student' ? 'student-dashboard' : 'teacher');
      }
      fetchData();
    });
    return () => subscription.unsubscribe();
  }, []);

  // Realtime เรียก fetchData ผ่าน ref เสมอ ไม่งั้นจะเรียกตัวที่ถูก capture ไว้ตอน subscribe
  // ซึ่งมองเห็น teacherProject เป็นค่าเก่า แล้วจะรีเซ็ตโปรเจกต์ที่อาจารย์เลือกอยู่ทุกครั้งที่มี event
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;
  const refreshTimer = useRef<number | null>(null);
  const voteCardRef = useRef<HTMLDivElement | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  // นิสิตหลายคนกดส่งพร้อมกันได้ รวบ event ที่ถี่ๆ ให้ยิง fetchData ครั้งเดียว
  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => fetchDataRef.current(), 600);
  };

  useEffect(() => {
    if (sessionRole !== 'teacher') { setLiveConnected(false); return; }
    const channel = supabase
      .channel('teacher-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'peer_evals' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'popular_votes' }, scheduleRefresh)
      .subscribe(status => setLiveConnected(status === 'SUBSCRIBED'));
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [sessionRole]);

  // ความคืบหน้าการประเมินรายคน คำนวณฝั่ง client จากข้อมูลที่อาจารย์อ่านได้อยู่แล้ว
  // สมาชิกแต่ละคนต้องประเมินเพื่อนในกลุ่มทุกคนยกเว้นตัวเอง
  const evaluationProgress = (project: string) =>
    getGroupsByProject(project).map(g => {
      const required = Math.max(g.membersArray.length - 1, 0);
      const members = g.membersArray.map(m => {
        const done = peerEvaluations.filter(
          e => e.project === project && e.groupName === g.name && e.evaluator === m.label,
        ).length;
        return { label: m.label, done, required, complete: required > 0 && done >= required };
      });
      return { group: g.name, required, members, doneCount: members.filter(m => m.complete).length };
    });

  // โปรเจกต์ที่อาจารย์ปิดรับแล้วไม่ต้องให้นิสิตเลือก กรองที่ชั้น UI ไม่ใช่ที่ view my_groups
  // เพราะถ้าซ่อนตั้งแต่ระดับข้อมูล นิสิตที่กำลังใช้งานอยู่ตอนอาจารย์กดปิดจะเห็นหน้าว่างเปล่า
  // แทนที่จะเห็นข้อความบอกว่าปิดรับแล้ว
  const openStudentGroups = importedGroups.filter(g => projectStatus[g.project]);

  // นิสิตที่เหลือโปรเจกต์เปิดรับอยู่กลุ่มเดียวเข้า dashboard ได้เลย ถ้ามีหลายกลุ่มค่อยให้เลือก
  useEffect(() => {
    if (sessionRole !== 'student' || studentSession || openStudentGroups.length !== 1) return;
    const g = openStudentGroups[0];
    setStudentSession({ project: g.project, groupName: g.name, memberId: '', memberLabel: g.myLabel ?? '' });
  }, [sessionRole, openStudentGroups, studentSession]);

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

  const handleAuth = async () => {
    if (!email || !password) return alert('กรุณากรอก Email และ Password');
    if (password.length < 6) return alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');

    setLoading(true);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
            alert('Registration successful! Logging you in...');
        } else if (data.user) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันตัวตน');
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
      // คิดถ่วงน้ำหนักใหม่จากคะแนนดิบด้วยน้ำหนักและคะแนนเต็มปัจจุบัน
      // ไม่ใช้ค่าที่บันทึกไว้ตอนกดบันทึก ให้ตรงกับวิธีคิดในชีต Summary
      const teacherData = records.map(r => {
        const w = weightsOf(r.project);
        const tMax = teacherMaxOf(r.project);
        const pMax = peerMaxOf(r.project);
        const weightedGroup = tMax > 0 ? (r.rawGroupScore / tMax) * w.teacher : 0;
        const weightedPeer = pMax > 0 ? (r.avgPeerRaw / pMax) * w.peer : 0;
        return {
          "Project": r.project, "Group Name": r.groupName,
          "Raw Group Score": r.rawGroupScore, "คะแนนเต็มเกณฑ์อาจารย์": tMax,
          "Weighted Group Score": parseFloat(weightedGroup.toFixed(2)),
          "Avg Peer Score (Raw)": parseFloat(r.avgPeerRaw.toFixed(2)), "คะแนนเต็มเกณฑ์เพื่อน": pMax,
          "Weighted Peer Score": parseFloat(weightedPeer.toFixed(2)),
          "Total Score": parseFloat((weightedGroup + weightedPeer).toFixed(2)),
          "น้ำหนักกลุ่ม (%)": w.teacher, "น้ำหนักเพื่อน (%)": w.peer,
          "Peer Voters Count": r.groupEvalsCount,
          "Evaluation Time": new Date(r.id).toLocaleString('th-TH'),
        };
      });
      const studentData = peerEvaluations.map(p => {
        const scoreDetails: Record<string, number> = {};
        p.scores.forEach((s) => { scoreDetails[`${s.name}`] = s.score; });
        // คะแนนเต็มไม่คงที่อีกแล้ว (อาจารย์แก้เกณฑ์ได้) จึงใส่เป็นคอลัมน์แทนการฝังไว้ในหัวคอลัมน์
        return { "Project": p.project, "Group Name": p.groupName, "Evaluator": p.evaluator, "Target": p.target, "Total Score (Raw)": p.totalRaw, "คะแนนเต็ม": peerMaxOf(p.project), ...scoreDetails, "Evaluation Time": new Date(p.timestamp).toLocaleString('th-TH') };
      });
      const summaryData: any[] = [];
      const sortedGroups = [...importedGroups].sort((a, b) => a.project.localeCompare(b.project) || a.name.localeCompare(b.name));
      sortedGroups.forEach(group => {
          const teacherRecord = records.find(r => r.project === group.project && r.groupName === group.name);
          const w = weightsOf(group.project);
          // คิดใหม่จากคะแนนดิบด้วยน้ำหนักปัจจุบัน ไม่ใช้ค่าที่บันทึกไว้ตอนกดบันทึก
          // ไม่งั้นเปลี่ยนสัดส่วนแล้วกลุ่มที่ประเมินไปก่อนหน้าจะยังใช้น้ำหนักเดิม
          const teacherMax = teacherMaxOf(group.project);
          const groupScore = teacherRecord && teacherMax > 0
            ? (teacherRecord.rawGroupScore / teacherMax) * w.teacher
            : 0;
          group.membersArray.forEach(member => {
              const memberEvaluations = peerEvaluations.filter(e => e.project === group.project && e.groupName === group.name && e.target === member.label);
              const peerScoreWeighted = avgPeerRatio(group.project, memberEvaluations) * w.peer;
              const totalScore = groupScore + peerScoreWeighted;
              // ผลโหวตเป็นข้อมูลระดับกลุ่ม ติดมากับสมาชิกทุกคนในกลุ่มเดียวกัน
              const groupVote = rankedVotes(group.project).find(r => r.group === group.name);
              // จำนวนเพื่อนที่คนนี้ต้องประเมิน และประเมินไปแล้วกี่คน
              const required = Math.max(group.membersArray.length - 1, 0);
              const submitted = peerEvaluations.filter(e => e.project === group.project && e.groupName === group.name && e.evaluator === member.label).length;
              summaryData.push({
                "รหัส": member.id || '-', "ชื่อ-นามสกุล": member.name || member.label,
                "SEC": member.section || '-', "สาขา": member.major || '-',
                "ชื่อ Project": group.project, "ชื่อ กลุ่ม": group.name,
                "คะแนนกลุ่ม": parseFloat(groupScore.toFixed(2)),
                "คะแนนเพื่อน": parseFloat(peerScoreWeighted.toFixed(2)),
                "Total Percent": parseFloat(totalScore.toFixed(2)),
                "น้ำหนักกลุ่ม (%)": w.teacher,
                "น้ำหนักเพื่อน (%)": w.peer,
                "ประเมินเพื่อนแล้ว": `${submitted}/${required}`,
                "สถานะการประเมิน": required === 0 ? 'ไม่มีเพื่อนให้ประเมิน' : (submitted >= required ? 'ครบ' : 'ยังไม่ครบ'),
                "Popular Vote (เสียง)": groupVote?.votes ?? 0,
                "อันดับ Popular Vote": groupVote ? groupVote.rank : '-',
              });
          });
      });

      // สถานะเปิด/ปิดของแต่ละโปรเจกต์ ณ เวลาที่ export
      const projectData = projectList.map(p => ({
        "ชื่อ Project": p,
        "รับการประเมินเพื่อน": projectStatus[p] ? 'เปิด' : 'ปิด',
        "Popular Vote": projectVoteOpen[p] ? 'เปิด' : 'ปิด',
        "น้ำหนักอาจารย์ (%)": weightsOf(p).teacher,
        "น้ำหนักเพื่อน (%)": weightsOf(p).peer,
        "รวม (%)": weightsOf(p).teacher + weightsOf(p).peer,
        "คะแนนเต็มเกณฑ์อาจารย์": teacherMaxOf(p),
        "คะแนนเต็มเกณฑ์เพื่อน": peerMaxOf(p),
      }));

      // ผลโหวตทุกโปรเจกต์ รวมกลุ่มที่ยังไม่มีใครโหวต
      const voteData: any[] = [];
      projectList.forEach(p => {
        rankedVotes(p).forEach(r => {
          voteData.push({
            "ชื่อ Project": p, "ชื่อ กลุ่ม": r.group,
            "จำนวนเสียง": r.votes, "อันดับ": r.rank,
            "Top 3": r.rank <= 3 && r.votes > 0 ? 'ใช่' : '',
          });
        });
      });

      // ใครประเมินครบ ใครยังไม่ครบ แยกชีตเพื่อให้ filter ใน Excel ได้ง่าย
      const statusData: any[] = [];
      projectList.forEach(p => {
        evaluationProgress(p).forEach(g => {
          const groupObj = importedGroups.find(x => x.project === p && x.name === g.group);
          g.members.forEach(m => {
            const member = groupObj?.membersArray.find(mm => mm.label === m.label);
            statusData.push({
              "ชื่อ Project": p, "ชื่อ กลุ่ม": g.group,
              "รหัส": member?.id || '-', "ชื่อ-นามสกุล": member?.name || m.label,
              "SEC": member?.section || '-', "สาขา": member?.major || '-',
              "ประเมินแล้ว": m.done, "ต้องประเมิน": m.required,
              "สถานะ": m.required === 0 ? 'ไม่มีเพื่อนให้ประเมิน' : (m.complete ? 'ครบ' : 'ยังไม่ครบ'),
            });
          });
        });
      });

      // เกณฑ์แก้ไขได้แล้ว รายงานจึงต้องบันทึกไว้ด้วยว่ารอบนี้ใช้เกณฑ์อะไร
      const criteriaData: any[] = [];
      projectList.forEach(p => {
        (allProjectCriteria[p] ?? []).forEach((c, i) => criteriaData.push({
          "ชื่อ Project": p, "ชุดเกณฑ์": "อาจารย์ประเมินกลุ่ม", "ลำดับ": i + 1,
          "หัวข้อ": c.name, "คะแนนเต็ม": 5,
          "ตัวเลือก": (c.options ?? []).map(o => `${o.score} = ${o.desc}`).join(' | '),
        }));
        studentCriteriaOf(p).forEach((c, i) => criteriaData.push({
          "ชื่อ Project": p, "ชุดเกณฑ์": "นิสิตประเมินเพื่อน", "ลำดับ": i + 1,
          "หัวข้อ": c.name, "คะแนนเต็ม": c.max, "ตัวเลือก": '',
        }));
      });

      const wb = XLSX.utils.book_new();
      const addSheet = (rows: any[], name: string, emptyLabel: string) =>
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "Info": emptyLabel }]), name);

      addSheet(summaryData, "Summary", "No data");
      addSheet(teacherData, "Teacher_Evaluation", "No teacher data");
      addSheet(studentData, "Student_Peer_Evaluation", "No peer data");
      addSheet(statusData, "Evaluation_Status", "No status data");
      addSheet(voteData, "Popular_Vote", "No vote data");
      addSheet(criteriaData, "Criteria", "No criteria data");
      addSheet(projectData, "Projects", "No project data");
      XLSX.writeFile(wb, `Evaluation_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) { console.error("Export failed:", error); alert("ไม่สามารถโหลดไลบรารี Excel ได้"); }
  };

  const toggleProjectStatus = async () => {
    const currentStatus = projectStatus[teacherProject];
    const { error } = await supabase.from('projects').update({ is_active: !currentStatus }).eq('name', teacherProject);
    if (!error) { setProjectStatus(prev => ({ ...prev, [teacherProject]: !currentStatus })); }
    else { alert('Failed to update status'); }
  };

  // สวิตช์ Popular Vote แยกจาก is_active เพราะมักเปิดคนละช่วงกับการประเมินเพื่อน
  const toggleVoteOpen = async () => {
    const next = !projectVoteOpen[teacherProject];
    if (!next && !confirm(`ปิดโหวตของ "${teacherProject}"?\n\nเมื่อปิดแล้วนิสิตทุกคนในโปรเจกต์จะเห็นผลโหวตทันที`)) return;
    const { error } = await supabase.from('projects').update({ vote_open: next }).eq('name', teacherProject);
    if (error) return alert('เปลี่ยนสถานะโหวตไม่สำเร็จ: ' + error.message);
    setProjectVoteOpen(prev => ({ ...prev, [teacherProject]: next }));
    fetchData();
  };

  const castVote = async (project: string, groupName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    // upsert ทับแถวเดิมของตัวเอง เปลี่ยนใจได้โดยไม่เพิ่มจำนวนเสียง
    const { error } = await supabase.from('popular_votes').upsert(
      { project_name: project, group_name: groupName, voter_id: session.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'project_name,voter_id' },
    );
    setLoading(false);
    if (error) return alert('โหวตไม่สำเร็จ: ' + explainDbError(error.message));
    setMyVote(prev => ({ ...prev, [project]: groupName }));
    fetchData();
  };

  // เกณฑ์ที่นิสิตใช้ประเมินกันในโปรเจกต์นี้ ยังไม่เคยตั้งเองก็ใช้ค่าเริ่มต้นในโค้ด
  const studentCriteriaOf = (project: string): StudentCriterion[] =>
    allStudentCriteria[project] ?? defaultCriteriaTemplate;

  // สัดส่วนคะแนนของโปรเจกต์ ใช้ค่าเดิม 14/6 ถ้ายังไม่เคยตั้ง
  const weightsOf = (project: string) => projectWeights[project] ?? { teacher: 14, peer: 6 };

  // คะแนนเต็มฝั่งอาจารย์ = จำนวนเกณฑ์ x 5 (ทุกเกณฑ์มีตัวเลือกสูงสุด 5)
  const teacherMaxOf = (project: string) => (allProjectCriteria[project]?.length ?? 0) * 5;

  // คะแนนเต็มของโปรเจกต์ ตามเกณฑ์ที่ตั้งไว้ปัจจุบัน
  const peerMaxOf = (project: string) =>
    studentCriteriaOf(project).reduce((sum, c) => sum + (c.max || 0), 0);

  // สัดส่วนคะแนนเฉลี่ยที่ได้รับ (0-1) เทียบคะแนนเต็มปัจจุบันของโปรเจกต์
  const avgPeerRatio = (project: string, evals: PeerEval[]) => {
    const max = peerMaxOf(project);
    if (max <= 0 || evals.length === 0) return 0;
    const avgRaw = evals.reduce((sum, e) => sum + e.totalRaw, 0) / evals.length;
    return avgRaw / max;
  };

  // มีผลโหวตให้ดูหรือยัง — ระหว่างเปิดโหวต RLS จะไม่คืนผลให้นิสิตเลย
  const hasVoteResults = (project: string) => voteResults.some(r => r.project === project);

  // จัดอันดับแบบแข่งขัน: คะแนนเท่ากันได้อันดับเดียวกัน อันดับถัดไปข้ามตามจำนวนที่เสมอ (1, 2, 2, 4)
  // ตั้งต้นจากรายชื่อกลุ่มทั้งหมด กลุ่มที่ยังไม่มีใครโหวตจึงติดมาด้วยเป็น 0 เสียง
  // ไม่งั้นรายงานจะมองข้ามกลุ่มที่ไม่ได้คะแนนเลย
  const rankedVotes = (project: string) => {
    const rows = votableGroups
      .filter(g => g.project === project)
      .map(g => ({
        project,
        group: g.name,
        votes: voteResults.find(r => r.project === project && r.group === g.name)?.votes ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes || a.group.localeCompare(b.group));
    let rank = 0;
    let prevVotes = -1;
    return rows.map((r, i) => {
      if (r.votes !== prevVotes) { rank = i + 1; prevVotes = r.votes; }
      return { ...r, rank };
    });
  };
  
  const handleAddProject = async (name: string) => {
    if (!name.trim()) return;
    if (projectList.includes(name.trim())) return alert('ชื่อโปรเจกต์ซ้ำกัน');
    const { error } = await supabase.from('projects').insert({ name: name.trim(), is_active: true });
    if (!error) { await supabase.from('criteria').insert({ project_name: name.trim(), data: defaultTeacherCriteria }); fetchData(); }
    else { alert('Failed to create project: ' + error.message); }
  };

  const handleEditProject = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const { error } = await supabase.from('projects').update({ name: newName.trim() }).eq('name', oldName);
    if (!error) { fetchData(); } else { alert('Update failed: ' + error.message); }
  };

  const handleDeleteProject = async (name: string) => {
    if (projectList.length <= 1) return alert('ต้องมีอย่างน้อย 1 โปรเจกต์');
    if (!confirm('Are you sure? This will delete all groups and scores associated with this project.')) return;
    const { error } = await supabase.from('projects').delete().eq('name', name);
    if (!error) { fetchData(); } else { alert('Delete failed: ' + error.message); }
  };

  const updateProjectCriteria = async (newCriteria: TeacherCriterion[]) => {
    const { error } = await supabase.from('criteria').upsert({ project_name: teacherProject, data: newCriteria });
    if (!error) { setAllProjectCriteria(prev => ({ ...prev, [teacherProject]: newCriteria })); }
    else { alert('Failed to save criteria'); }
  };

  const getGroupsByProject = (proj: string) => importedGroups.filter(g => g.project === proj);

  const handleStudentLogin = async () => {
    const sid = studentIdInput.trim();
    if (!sid || !studentPasswordInput) return alert('กรุณากรอกรหัสนิสิตและรหัสผ่าน');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: studentEmailOf(sid),
      password: studentPasswordInput,
    });
    setLoading(false);
    // ไม่แยกว่า "ไม่มีบัญชี" หรือ "รหัสผ่านผิด" เพื่อไม่ให้ใช้หน้านี้ไล่เดาว่ามีนิสิตคนไหนอยู่ในระบบบ้าง
    if (error) return alert('รหัสนิสิตหรือรหัสผ่านไม่ถูกต้อง\n\nถ้าเพิ่งใช้ครั้งแรก รหัสผ่านเริ่มต้นคือรหัสนิสิตของคุณ');
    if (data.user?.app_metadata?.role !== 'student') {
      await supabase.auth.signOut();
      return alert('บัญชีนี้ไม่ใช่บัญชีนิสิต');
    }
    setStudentPasswordInput('');
  };

  const handleStudentLogout = async () => {
    await supabase.auth.signOut();
    setStudentSession(null); setStudentIdInput(''); setStudentPasswordInput(''); setView('landing');
  };

  // ยังต้องโหวตอยู่ไหม — เช็กว่ามีกลุ่มให้โหวตจริงด้วย ไม่งั้นนิสิตที่อยู่โปรเจกต์
  // ซึ่งมีกลุ่มเดียว (โหวตกลุ่มตัวเองไม่ได้) จะออกจากระบบไม่ได้เลย
  const needsVote = (project: string, ownGroup: string) =>
    !!projectVoteOpen[project]
    && !myVote[project]
    && votableGroups.some(g => g.project === project && g.name !== ownGroup);

  // ใช้กับปุ่มออกจากระบบในหน้า dashboard เท่านั้น
  // ปุ่มในโมดัลบังคับเปลี่ยนรหัสยังเรียก handleStudentLogout ตรงๆ ไม่งั้นนิสิต
  // ที่ยังไม่ได้ตั้งรหัสใหม่จะติดอยู่ในโมดัลโดยออกไม่ได้
  const requestStudentLogout = async () => {
    if (studentSession && needsVote(studentSession.project, studentSession.groupName)) {
      alert('กรุณาโหวต Popular Vote ก่อนออกจากระบบ\n\nเลือกโครงงานที่คุณชอบที่สุด 1 กลุ่ม (เปลี่ยนใจได้ภายหลัง)');
      voteCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    await handleStudentLogout();
  };

  // ใช้ได้ทั้งนิสิตและอาจารย์ เปลี่ยนรหัสของตัวเองเท่านั้น
  const handleChangeOwnPassword = async (newPass: string, confirmPass: string) => {
    if (newPass.length < 6) return alert('รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร');
    if (newPass !== confirmPass) return alert('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    if (sessionRole === 'student' && newPass.trim() === studentIdInput.trim()) {
      return alert('ห้ามตั้งรหัสผ่านเป็นรหัสนิสิตของตัวเอง');
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPass,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (error) return alert('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + error.message);
    setMustChangePassword(false);
    setShowChangePassword(false);
    alert('เปลี่ยนรหัสผ่านเรียบร้อย');
  };

  // งานที่ต้องใช้ service_role ทำผ่าน Edge Function เท่านั้น เรียกจากเบราว์เซอร์ตรงๆ ไม่ได้
  const callStudentAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('student-admin', { body });
    if (error) {
      // invoke คืนข้อความกลางๆ เมื่อ status ไม่ใช่ 2xx ต้องอ่าน body เองถึงจะได้เหตุผลจริง
      const detail = await (error as any).context?.json?.().catch(() => null);
      const msg = detail?.error ?? error.message;
      // fetch ล้มตั้งแต่ต้น = ไม่มีฟังก์ชันให้เรียก (CORS preflight ไม่มีใครตอบ)
      if (/Failed to send a request/i.test(msg)) {
        throw new Error('ยังไม่ได้ deploy Edge Function "student-admin"\n\nDashboard > Edge Functions > Deploy a new function แล้ววางโค้ดจาก supabase/functions/student-admin/index.ts\nหรือรัน: npx supabase functions deploy student-admin');
      }
      throw new Error(msg);
    }
    return data;
  };

  const handleProvisionStudents = async () => {
    if (!teacherProject) return;
    if (!confirm(`สร้างบัญชีนิสิตทั้งหมดในโปรเจกต์ "${teacherProject}"?\n\nรหัสผ่านเริ่มต้นของแต่ละคน = รหัสนิสิตของตัวเอง\nคนที่มีบัญชีอยู่แล้วจะถูกข้าม ไม่กระทบรหัสผ่านเดิม`)) return;
    setLoading(true);
    try {
      const r = await callStudentAdmin({ action: 'provision', project_name: teacherProject });
      // ฟังก์ชันตอบ 200 แต่รูปแบบไม่ตรง = โค้ดที่ deploy ไม่ใช่ของเรา (มักเป็นเทมเพลตตัวอย่าง)
      if (!r || !Array.isArray(r.created)) {
        setLoading(false);
        return alert(
          'Edge Function ตอบกลับมาในรูปแบบที่ไม่รู้จัก\n\n' +
          'น่าจะยังเป็นโค้ดตัวอย่างของ Supabase อยู่ ไม่ใช่โค้ดจาก supabase/functions/student-admin/index.ts\n' +
          'ลองวางโค้ดจากไฟล์นั้นทับแล้ว Deploy ใหม่\n\n' +
          'คำตอบที่ได้รับ: ' + JSON.stringify(r),
        );
      }
      const lines = [`สร้างบัญชีใหม่ ${r.created.length} คน`, `มีบัญชีอยู่แล้ว ${(r.existed ?? []).length} คน`];
      if (r.missingId?.length) lines.push(`\nข้ามเพราะไม่มีรหัสนิสิต ${r.missingId.length} คน:\n${r.missingId.join('\n')}`);
      if (r.failed?.length) lines.push(`\nไม่สำเร็จ ${r.failed.length} คน:\n${r.failed.map((f: any) => `${f.student_id}: ${f.reason}`).join('\n')}`);
      alert(lines.join('\n'));
    } catch (e: any) { alert('สร้างบัญชีไม่สำเร็จ: ' + e.message); }
    setLoading(false);
  };

  const saveWeights = async (w: { teacher: number; peer: number }) => {
    setLoading(true);
    const { error } = await supabase.from('projects')
      .update({ teacher_weight: w.teacher, peer_weight: w.peer })
      .eq('name', teacherProject);
    setLoading(false);
    if (error) return alert('บันทึกสัดส่วนไม่สำเร็จ: ' + explainDbError(error.message));
    setProjectWeights(prev => ({ ...prev, [teacherProject]: w }));
    setShowWeights(false);
    alert(`ตั้งสัดส่วนของ "${teacherProject}" เป็น อาจารย์ ${w.teacher}% + เพื่อน ${w.peer}% เรียบร้อย`);
  };

  const saveStudentCriteria = async (rows: StudentCriterion[]) => {
    setLoading(true);
    const { error } = await supabase.rpc('save_student_criteria', { p_project: teacherProject, p_data: rows });
    setLoading(false);
    if (error) return alert('บันทึกเกณฑ์ไม่สำเร็จ: ' + explainDbError(error.message));
    setAllStudentCriteria(prev => ({ ...prev, [teacherProject]: rows }));
    setShowStudentCriteria(false);
    alert('บันทึกเกณฑ์ประเมินเพื่อนเรียบร้อย');
  };

  const handleResetStudentPassword = async () => {
    const sid = prompt('กรอกรหัสนิสิตที่ต้องการรีเซ็ตรหัสผ่าน');
    if (!sid?.trim()) return;
    if (!confirm(`รีเซ็ตรหัสผ่านของ ${sid.trim()} กลับเป็นรหัสนิสิต?`)) return;
    setLoading(true);
    try {
      const r = await callStudentAdmin({ action: 'reset', student_id: sid.trim() });
      if (!r?.ok) {
        setLoading(false);
        return alert('Edge Function ตอบกลับมาในรูปแบบที่ไม่รู้จัก\n\nตรวจว่าโค้ดที่ deploy ตรงกับ supabase/functions/student-admin/index.ts\n\nคำตอบที่ได้รับ: ' + JSON.stringify(r));
      }
      alert(`รีเซ็ตเรียบร้อย\n\nรหัสผ่านใหม่ของ ${sid.trim()} คือรหัสนิสิตของตัวเอง\nระบบจะบังคับให้ตั้งรหัสใหม่ตอนเข้าครั้งถัดไป`);
    } catch (e: any) { alert('รีเซ็ตไม่สำเร็จ: ' + e.message); }
    setLoading(false);
  };

  const startVote = (targetName: string) => {
    if (!studentSession) return;
    if (!projectStatus[studentSession.project]) { alert(`ระบบปิดรับการประเมินแล้ว`); handleStudentLogout(); return; }
    setTargetLabel(targetName);
    setCurrentScores(studentCriteriaOf(studentSession.project).map(c => ({ ...c, score: 0 })));
    setView('student-vote');
  };

  const handleScoreChange = (id: number, val: string) => { setCurrentScores(prev => prev.map(s => s.id === id ? { ...s, score: Number(val) } : s)); };

  const submitVote = async () => {
    if (!studentSession) return;
    setLoading(true);
    const totalRaw = currentScores.reduce((sum, s) => sum + s.score, 0);
    const newEval = { project_name: studentSession.project, group_name: studentSession.groupName, evaluator: studentSession.memberLabel, target: targetLabel, scores: currentScores, total_raw: totalRaw };
    const { error } = await supabase.from('peer_evals').insert(newEval);
    setLoading(false);
    if (!error) { fetchData(); setStudentSuccessMsg(`บันทึกคะแนนให้ "${targetLabel}" เรียบร้อย`); setView('student-dashboard'); }
    else { alert('Error submitting vote: ' + error.message); }
  };

  const handleGroupSelect = (groupName: string) => {
    const group = importedGroups.find(g => g.name === groupName && g.project === teacherProject);
    setCurrentGroup(group || null);
  };

  const calculateScores = () => {
    if (!currentGroup) return { rawGroupScore: 0, weightedGroupScore: 0, avgPeerRaw: 0, weightedIndivScore: 0, groupEvalsCount: 0 };
    const rawGroupScore = groupCriteria.reduce((sum, item) => sum + (item.score || 0), 0);
    const w = weightsOf(teacherProject);
    const maxRawScore = groupCriteria.length * 5;
    const weightedGroupScore = maxRawScore > 0 ? (rawGroupScore / maxRawScore) * w.teacher : 0;
    const groupEvals = peerEvaluations.filter(e => e.project === teacherProject && e.groupName === currentGroup.name);
    let avgPeerRaw = 0;
    if (groupEvals.length > 0) {
      const totalRaw = groupEvals.reduce((sum, e) => sum + e.totalRaw, 0);
      avgPeerRaw = totalRaw / groupEvals.length;
    }
    const weightedIndivScore = avgPeerRatio(teacherProject, groupEvals) * w.peer;
    return { rawGroupScore, weightedGroupScore, avgPeerRaw, weightedIndivScore, groupEvalsCount: groupEvals.length };
  };

  const saveFinalRecord = async () => {
    if (!currentGroup) return alert('กรุณาเลือกกลุ่ม');
    const scores = calculateScores();
    const totalScore = scores.weightedGroupScore + scores.weightedIndivScore;
    const payload = { project_name: teacherProject, group_name: currentGroup.name, data: scores, total_score: totalScore };
    await supabase.from('teacher_evals').delete().match({ project_name: teacherProject, group_name: currentGroup.name });
    const { error } = await supabase.from('teacher_evals').insert(payload);
    if (!error) { fetchData(); alert(`บันทึกผลการประเมินกลุ่ม ${currentGroup.name} เรียบร้อย`); setGroupCriteria(groupCriteria.map(c => ({...c, score: 0}))); setCurrentGroup(null); }
    else { alert('Save failed: ' + error.message); }
  };

  const CriteriaManagerModal = ({ onClose }: { onClose: () => void }) => {
      const [editingCriteria, setEditingCriteria] = useState<TeacherCriterion[]>(allProjectCriteria[teacherProject] || []);
      const handleChange = (id: number, field: keyof TeacherCriterion, value: any, optionIdx: number | null = null) => { 
        setEditingCriteria(prev => prev.map(c => { if (c.id !== id) return c; if (field === 'options' && optionIdx !== null) { const newOpts = [...c.options]; newOpts[optionIdx] = { ...newOpts[optionIdx], desc: value }; return { ...c, options: newOpts }; } return { ...c, [field]: value }; })); 
      };
      const addCriterion = () => { const newId = editingCriteria.length > 0 ? Math.max(...editingCriteria.map(c => c.id)) + 1 : 1; setEditingCriteria([...editingCriteria, { id: newId, name: 'หัวข้อใหม่', options: [{ score: 1, desc: '...' }, { score: 3, desc: '...' }, { score: 5, desc: '...' }] }]); };
      const removeCriterion = (id: number) => { setEditingCriteria(editingCriteria.filter(c => c.id !== id)); };
      const saveChanges = () => { updateProjectCriteria(editingCriteria); onClose(); };
      return (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 h-[85vh] flex flex-col"><div className="flex justify-between items-center mb-4 pb-2 border-b"><div><h3 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Edit2 size={24} className="text-blue-600"/> แก้ไขเกณฑ์การประเมิน</h3><p className="text-sm text-slate-500">สำหรับโปรเจกต์: <span className="font-bold text-blue-600">{teacherProject}</span></p></div><button onClick={onClose}><X size={24} className="text-slate-400 hover:text-red-500"/></button></div><div className="flex-grow overflow-y-auto space-y-4 pr-2">{editingCriteria.map((c) => (<div key={c.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative group"><button onClick={() => removeCriterion(c.id)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button><div className="mb-3"><label className="text-xs font-bold text-slate-400 uppercase">หัวข้อประเมิน</label><input type="text" value={c.name} onChange={(e) => handleChange(c.id, 'name', e.target.value)} className="w-full font-bold text-slate-700 bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none py-1"/></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{c.options.map((opt, optIdx) => (<div key={optIdx}><div className="text-xs font-bold text-slate-500 mb-1">ระดับ {opt.score} คะแนน</div><textarea value={opt.desc} onChange={(e) => handleChange(c.id, 'options', e.target.value, optIdx)} className="w-full text-sm p-2 border rounded bg-white h-20 resize-none focus:ring-1 focus:ring-blue-300 outline-none"/></div>))}</div></div>))}<button onClick={addCriterion} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"><Plus size={20}/> เพิ่มหัวข้อเกณฑ์</button></div><div className="pt-4 mt-2 border-t flex justify-end gap-3"><button onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">ยกเลิก</button><button onClick={saveChanges} className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">บันทึกการแก้ไข</button></div></div></div>);
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
        const newGroupsPayload = sourceGroups.map(g => ({ project_name: teacherProject, name: g.name, members: g.membersArray }));
        const { error } = await supabase.from('groups').upsert(newGroupsPayload, { onConflict: 'project_name,name' });
        if(!error) { onClose(); fetchData(); alert(`คัดลอกกลุ่มเรียบร้อย`); } else { alert('คัดลอกไม่สำเร็จ: ' + explainDbError(error.message)); }
    };
    // อ่านไฟล์ .xlsx / .csv ด้วย SheetJS ตัวเดียวกับที่ใช้ตอน export
    // แล้วเทข้อมูลลงกล่องข้อความ ให้อาจารย์ตรวจและแก้ก่อนกดยืนยันได้
    const handleFile = async (file: File) => {
      try {
        const XLSX = await loadXLSX();
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
        const lines = rows
          .map(r => r.map((c: any) => String(c ?? '').trim()).join(', '))
          .filter(line => line.replace(/,/g, '').trim() !== '');
        if (lines.length === 0) return alert('ไม่พบข้อมูลในไฟล์');
        setText(lines.join('\n'));
      } catch (e: any) {
        alert('อ่านไฟล์ไม่สำเร็จ: ' + (e?.message ?? e));
      }
    };

    const processImport = async () => {
        const groupsMap = rowsToGroups(textToRows(text));
        const parsed = Array.from(groupsMap.entries()).map(([name, members]) => ({ project_name: teacherProject, name, members }));
        if (parsed.length === 0) return alert('ไม่พบข้อมูลที่ถูกต้อง');

        // ตรวจข้อมูลก่อนบันทึก: รหัสนิสิตใช้เป็นรหัสผ่าน และชื่อใช้เป็นตัวระบุตัวตนตอนให้คะแนน
        // ถ้าขาดรหัส หรือชื่อซ้ำกันในกลุ่ม ระบบจะทำงานผิดพลาดแบบเงียบๆ จึงต้องบล็อกไว้ตั้งแต่ตอนนำเข้า
        const problems: string[] = [];
        parsed.forEach(g => {
          const missingId = g.members.filter(m => !m.id?.trim()).map(m => m.name);
          if (missingId.length > 0) problems.push(`• กลุ่ม "${g.name}" ไม่มีรหัสนิสิต: ${missingId.join(', ')}`);

          const counts = new Map<string, number>();
          g.members.forEach(m => counts.set(m.label, (counts.get(m.label) || 0) + 1));
          const duplicates = Array.from(counts.entries()).filter(([, n]) => n > 1).map(([label, n]) => `${label} (${n} ครั้ง)`);
          if (duplicates.length > 0) problems.push(`• กลุ่ม "${g.name}" ชื่อซ้ำ: ${duplicates.join(', ')}`);
        });
        if (problems.length > 0) {
          return alert(`ไม่สามารถนำเข้าได้ พบปัญหา ${problems.length} รายการ\n\n${problems.join('\n')}\n\nรหัสนิสิตใช้เป็นรหัสผ่านของนิสิต จึงต้องมีครบทุกคน\nชื่อใช้แยกว่าใครประเมินใคร จึงห้ามซ้ำกันภายในกลุ่มเดียวกัน`);
        }

        const totalMembers = parsed.reduce((sum, g) => sum + g.members.length, 0);
        // upsert: นำเข้าชื่อกลุ่มเดิมซ้ำ = ทับของเดิม ไม่สร้างกลุ่มซ้ำ (ต้องมี unique constraint ที่ groups-unique.sql)
        const { error } = await supabase.from('groups').upsert(parsed, { onConflict: 'project_name,name' });
        if (error) return alert('นำเข้าไม่สำเร็จ: ' + explainDbError(error.message));
        onClose(); fetchData(); alert(`นำเข้าสำเร็จ ${parsed.length} กลุ่ม รวม ${totalMembers} คน`);
    };
    return (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6"><h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Upload size={20} className="text-blue-600"/> จัดการรายชื่อกลุ่ม</h3><div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded mb-4 text-sm flex justify-between items-center"><span><span className="font-bold">Project ปัจจุบัน:</span> {teacherProject}</span></div><div className="flex gap-2 mb-4 border-b border-slate-200"><button onClick={() => setMode('new')} className={`pb-2 px-4 text-sm font-bold transition-all ${mode === 'new' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Plus size={14} className="inline mr-1"/> นำเข้าใหม่ (Excel)</button><button onClick={() => availableProjects.length > 0 && setMode('reuse')} disabled={availableProjects.length === 0} className={`pb-2 px-4 text-sm font-bold transition-all ${mode === 'reuse' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'} ${availableProjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}><Copy size={14} className="inline mr-1"/> ใช้กลุ่มเดิม (Reuse)</button><button onClick={() => setMode('edit')} className={`pb-2 px-4 text-sm font-bold transition-all ${mode === 'edit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><Pencil size={14} className="inline mr-1"/> แก้ไข/ลบ</button></div>{mode === 'edit' ? (<div className="animate-in fade-in space-y-3 max-h-[60vh] overflow-y-auto pr-1">{getGroupsByProject(teacherProject).length === 0 ? (<p className="text-sm text-slate-400 py-8 text-center">ยังไม่มีกลุ่มในโปรเจกต์นี้ นำเข้ารายชื่อก่อน</p>) : getGroupsByProject(teacherProject).map(g => (<GroupEditor key={g.id} group={g} project={teacherProject} onChanged={() => { fetchData(); }} />))}</div>) : mode === 'new' ? (<div className="animate-in fade-in"><div className="text-sm text-slate-600 mb-1">เลือกไฟล์ หรือพิมพ์/วางข้อมูลเองก็ได้</div>
                <div className="text-xs text-slate-400 mb-2">รูปแบบ: <span className="font-mono">ชื่อกลุ่ม, SEC, รหัสนิสิต, ชื่อ-นามสกุล, สาขา</span> — มีหัวตารางในไฟล์ได้ ระบบจะข้ามให้</div>
                <label className="flex items-center justify-center gap-2 w-full mb-3 p-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 cursor-pointer transition">
                  <FileSpreadsheet size={18}/> เลือกไฟล์ .xlsx หรือ .csv
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}/>
                </label>
                <textarea className="w-full h-40 border p-3 rounded mb-4 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder={`Group-1, SEC-01, 68938494, นายสมชาย ใจดี, วิศวกรรมซอฟต์แวร์`} value={text} onChange={e => setText(e.target.value)}/><div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button><button onClick={processImport} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">ยืนยันนำเข้า</button></div></div>) : (<div className="animate-in fade-in py-4 text-center space-y-4"><div className="text-slate-600 text-sm">เลือกโปรเจกต์ต้นทาง</div><select className="w-full p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500" value={sourceProject} onChange={e => setSourceProject(e.target.value)}><option value="">-- เลือกโปรเจกต์ต้นทาง --</option>{availableProjects.map((p, i) => <option key={i} value={p}>{p}</option>)}</select><div className="flex justify-end gap-2 mt-4"><button onClick={onClose} className="px-4 py-2 text-gray-500 hover:bg-slate-50 rounded">ยกเลิก</button><button onClick={handleReuse} disabled={!sourceProject} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">คัดลอกข้อมูล</button></div></div>)}</div></div>);
  };

  const renderVoteResults = (project: string) => {
    const rows = rankedVotes(project);
    if (rows.length === 0) return <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีกลุ่มในโปรเจกต์นี้</p>;
    const total = rows.reduce((s, r) => s + r.votes, 0);
    if (total === 0) return <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีใครโหวต</p>;
    const max = rows[0].votes;
    // อันดับ 1-3 เน้นด้วยสี ทอง/เงิน/ทองแดง ที่เหลือเป็นสีกลาง
    const tone = (rank: number) =>
      rank === 1 ? { card: 'border-amber-300 bg-amber-50',  fill: 'bg-amber-400'  }
    : rank === 2 ? { card: 'border-slate-300 bg-slate-50',  fill: 'bg-slate-400'  }
    : rank === 3 ? { card: 'border-orange-300 bg-orange-50', fill: 'bg-orange-400' }
    :              { card: 'border-slate-100 bg-white',      fill: 'bg-slate-300'  };
    return (
      <div className="space-y-2">
        {rows.map((r, i) => {
          const t = tone(r.rank);
          return (
            <div key={i} className={`border rounded-lg p-3 transition ${t.card}`}>
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${t.fill}`}>{r.rank}</span>
                <span className={`flex-grow truncate ${r.rank <= 3 ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{r.group}</span>
                {r.rank === 1 && <Trophy size={16} className="text-amber-500 shrink-0"/>}
                <span className="font-mono font-bold text-slate-700 shrink-0">{r.votes}</span>
              </div>
              <div className="h-1.5 bg-white rounded-full mt-2 overflow-hidden border border-slate-100">
                <div className={`h-full rounded-full ${t.fill}`} style={{ width: `${max > 0 ? (r.votes / max) * 100 : 0}%` }} />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-slate-400 text-center pt-1">รวม {total} เสียง</p>
      </div>
    );
  };

  // ownGroup = กลุ่มของผู้โหวตในโปรเจกต์นี้ ส่ง null สำหรับอาจารย์ที่โหวตกลุ่มไหนก็ได้
  const renderVoteBallot = (project: string, ownGroup: string | null) => {
    const choices = votableGroups.filter(g => g.project === project && g.name !== ownGroup);
    const chosen = myVote[project];
    if (choices.length === 0) return <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีกลุ่มให้โหวต</p>;
    return (
      <div className="space-y-2">
        {choices.map((g, i) => {
          const selected = chosen === g.name;
          return (
            <button key={i} onClick={() => castVote(project, g.name)} disabled={loading}
              className={`w-full text-left p-3 rounded-lg border transition flex items-center gap-3 disabled:opacity-60 ${selected ? 'border-amber-400 bg-amber-50 font-bold text-amber-800' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700'}`}>
              <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`}>
                {selected && <Check size={12} className="text-white"/>}
              </span>
              <span className="flex-grow truncate">{g.name}</span>
            </button>
          );
        })}
        <p className="text-xs text-slate-400 text-center pt-1">{chosen ? 'เปลี่ยนใจได้จนกว่าจะปิดโหวต' : 'เลือกได้ 1 กลุ่ม'}</p>
      </div>
    );
  };

  const renderStudentLogin = () => {
    return (
      <div className="w-full max-w-md mx-auto py-10 px-4 animate-in fade-in zoom-in-95 duration-300">
        <button onClick={() => setView('landing')} className="mb-6 text-slate-500 flex items-center gap-1 hover:text-slate-800"><ArrowRight className="rotate-180" size={16}/> กลับหน้าหลัก</button>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center"><div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm"><User size={32} /></div><h2 className="text-xl font-bold">เข้าสู่ระบบนิสิต</h2><p className="text-amber-100 text-sm">Peer Evaluation System</p></div>
          <form className="p-8 space-y-5" onSubmit={e => { e.preventDefault(); handleStudentLogin(); }}>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><User size={16} className="text-amber-500"/> รหัสนิสิต</label>
              <div className="relative"><User size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                <input type="text" inputMode="numeric" autoComplete="username" className="w-full pl-10 p-3 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-amber-400 font-mono tracking-widest transition" placeholder="เช่น 660123" value={studentIdInput} onChange={e => setStudentIdInput(e.target.value)}/>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Key size={16} className="text-amber-500"/> รหัสผ่าน</label>
              <div className="relative"><Key size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                <input type="password" autoComplete="current-password" className="w-full pl-10 p-3 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-amber-400 transition" placeholder="••••••••" value={studentPasswordInput} onChange={e => setStudentPasswordInput(e.target.value)}/>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-xs leading-relaxed">
              เข้าใช้ครั้งแรก: รหัสผ่านคือ <span className="font-bold font-mono">รหัสนิสิตของคุณ</span> ระบบจะให้ตั้งรหัสใหม่ทันที<br/>
              ลืมรหัสผ่าน: แจ้งอาจารย์ผู้สอนเพื่อรีเซ็ตให้
            </div>
            <button type="submit" disabled={loading || !studentIdInput.trim() || !studentPasswordInput} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold shadow-lg shadow-slate-300 hover:bg-slate-900 disabled:opacity-50 transition transform active:scale-95 flex justify-center items-center gap-2">
              {loading && <Loader2 size={18} className="animate-spin"/>} เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  };


  const renderStudentDashboard = () => {
    // อยู่หลายโปรเจกต์ให้เลือกก่อน (ถ้ามีกลุ่มเดียว useEffect เลือกให้อัตโนมัติแล้ว)
    if (!studentSession) {
      return (
        <div className="w-full max-w-md mx-auto py-10 px-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layers size={20} className="text-amber-500"/> เลือกโครงงาน</h2>
            {openStudentGroups.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                {importedGroups.length === 0
                  ? 'ยังไม่พบกลุ่มของคุณในระบบ กรุณาติดต่ออาจารย์ผู้สอน'
                  : 'โปรเจกต์ของคุณปิดรับการประเมินแล้ว'}
              </p>
            ) : openStudentGroups.map((g, i) => (
              <button key={i} onClick={() => setStudentSession({ project: g.project, groupName: g.name, memberId: '', memberLabel: g.myLabel ?? '' })} className="w-full text-left p-4 border border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition">
                <div className="font-bold text-slate-800">{g.project}</div>
                <div className="text-sm text-slate-500">{g.name} · {g.myLabel}</div>
              </button>
            ))}
            <button onClick={handleStudentLogout} className="w-full text-sm text-red-600 hover:bg-red-50 py-2 rounded transition">ออกจากระบบ</button>
          </div>
        </div>
      );
    }
    const groupObj = importedGroups.find(g => g.name === studentSession.groupName && g.project === studentSession.project);
    const peers = groupObj?.membersArray.filter(m => m.label !== studentSession.memberLabel) || [];
    const getStatus = (peerName: string) => peerEvaluations.some(e => e.project === studentSession.project && e.groupName === studentSession.groupName && e.evaluator === studentSession.memberLabel && e.target === peerName);
    const evaluatedCount = peers.filter(p => getStatus(p.label)).length;
    const totalPeers = peers.length;
    const isAllDone = evaluatedCount === totalPeers && totalPeers > 0;

    return (
      <div className="w-full max-w-4xl mx-auto py-6 px-4">
        <div className="flex justify-between items-center mb-6"><div><h1 className="text-xl font-bold text-slate-800">Dashboard</h1><span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">{studentSession.project}</span></div><div className="flex items-center gap-2"><button onClick={() => setShowChangePassword(true)} className="text-sm text-slate-600 font-medium hover:bg-slate-100 px-3 py-1 rounded-full border border-slate-200 transition flex items-center gap-1"><Key size={14}/> เปลี่ยนรหัสผ่าน</button><button onClick={requestStudentLogout} className="text-sm text-red-600 font-medium hover:bg-red-50 px-3 py-1 rounded-full border border-transparent hover:border-red-100 transition">ออกจากระบบ</button></div></div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-bold text-xl">{studentSession.memberLabel.charAt(0)}</div><div><p className="text-slate-500 text-xs uppercase tracking-wider">Welcome,</p><h2 className="text-lg font-bold text-slate-800">{studentSession.memberLabel}</h2><span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{studentSession.groupName}</span></div></div><div className="text-center sm:text-right"><p className="text-slate-400 text-xs">Progress</p><p className={`text-2xl font-bold ${isAllDone ? 'text-green-600' : 'text-slate-800'}`}>{evaluatedCount}/{totalPeers}</p></div></div>
        {studentSuccessMsg && (<div className="bg-green-100 border border-green-200 text-green-800 p-3 rounded-xl mb-6 flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2"><CheckCircle size={18} className="text-green-600" /> {studentSuccessMsg}</div>)}
        {!projectStatus[studentSession.project] && (<div className="bg-red-50 border border-red-200 p-3 rounded-xl mb-6 flex items-center gap-2 text-red-600 text-sm font-medium"><AlertTriangle size={18}/> โปรเจกต์นี้ปิดรับการประเมินแล้ว</div>)}
        <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider ml-1">เพื่อนในทีมที่ต้องประเมิน</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{peers.length === 0 ? (<div className="col-span-2 p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">ไม่มีสมาชิกอื่นในกลุ่ม</div>) : (peers.map((peer, idx) => { const isDone = getStatus(peer.label); return (<button key={idx} disabled={isDone} onClick={() => startVote(peer.label)} className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all text-left group ${isDone ? 'bg-slate-50 border-slate-200 opacity-60 cursor-default' : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer'}`}><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{isDone ? <Check size={16}/> : peer.label.charAt(0)}</div><span className={`font-medium ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{peer.label}</span></div><div>{isDone ? (<span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">เรียบร้อย</span>) : (<span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded group-hover:bg-amber-500 group-hover:text-white transition">ให้คะแนน</span>)}</div></button>); }))}</div>
        {isAllDone && (() => {
          const pending = needsVote(studentSession.project, studentSession.groupName);
          return (
            <div className={`mt-8 border rounded-xl p-6 text-center animate-in zoom-in-95 ${pending ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${pending ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}><Trophy size={32} /></div>
              <h3 className={`text-lg font-bold ${pending ? 'text-amber-800' : 'text-green-800'}`}>ประเมินครบทุกคนแล้ว!</h3>
              {pending ? (<>
                <p className="text-sm text-amber-700 mb-3">เหลืออีกขั้นเดียว — โหวต Popular Vote ก่อนออกจากระบบ</p>
                <button onClick={() => voteCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-600 transition">ไปโหวต</button>
              </>) : (
                <button onClick={requestStudentLogout} className="mt-2 bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition">ออกจากระบบ</button>
              )}
            </div>
          );
        })()}

        {/* อยู่ท้ายสุด เพราะการประเมินเพื่อนเป็นงานหลักที่นิสิตต้องทำให้ครบ */}
        {/* แสดงเมื่อกำลังเปิดโหวต หรือปิดโหวตแล้วและ RLS ปล่อยผลออกมาให้เห็น */}
        {(projectVoteOpen[studentSession.project] || hasVoteResults(studentSession.project)) && (
          <div ref={voteCardRef} className={`bg-white rounded-2xl shadow-sm p-6 mt-6 border ${needsVote(studentSession.project, studentSession.groupName) ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'}`}>
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Trophy size={18} className="text-amber-500"/> Popular Vote</h3>
            {projectVoteOpen[studentSession.project] ? (<>
              <p className="text-xs text-slate-500 mb-4 mt-1">โหวตโครงงานที่คุณชอบที่สุด โหวตกลุ่มตัวเองไม่ได้ ผลจะเปิดเผยเมื่ออาจารย์ปิดโหวต</p>
              {renderVoteBallot(studentSession.project, studentSession.groupName)}
            </>) : (<>
              <p className="text-xs text-slate-500 mb-4 mt-1">ปิดโหวตแล้ว — ผลอย่างเป็นทางการ</p>
              {renderVoteResults(studentSession.project)}
            </>)}
          </div>
        )}
      </div>
    );
  };

  const renderStudentVote = () => {
    return (
      <div className="w-full max-w-2xl mx-auto py-8 px-4 animate-in slide-in-from-right-4 duration-300">
         <button onClick={() => setView('student-dashboard')} className="mb-4 text-slate-500 flex items-center gap-1 hover:text-slate-800"><ArrowRight className="rotate-180" size={16}/> ย้อนกลับ</button>
         <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-amber-100">
            <div className="bg-amber-500 p-6 text-white flex justify-between items-center"><div><p className="text-amber-100 text-xs mb-1">กำลังให้คะแนน</p><h2 className="text-2xl font-bold">{targetLabel}</h2></div><div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><FileText size={20} /></div></div>
            <div className="p-6 space-y-8">
               {currentScores.map(criteria => (<div key={criteria.id}><div className="flex justify-between mb-2 items-end"><span className="font-bold text-slate-700">{criteria.name}</span><span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{criteria.score}/{criteria.max}</span></div><input type="range" min="0" max={criteria.max} step="1" className="w-full accent-amber-500 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer" value={criteria.score} onChange={(e) => handleScoreChange(criteria.id, e.target.value)} /></div>))}
               <button onClick={submitVote} className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-900 transition flex items-center justify-center gap-2 text-lg"><CheckCircle size={24} /> บันทึกคะแนน</button>
            </div>
         </div>
      </div>
    );
  };

  if (loading && view === 'landing') {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={40}/><p className="text-slate-500 font-bold">Connecting to Database...</p></div></div>;
  }

  return (
    <div className="w-full min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center animate-in zoom-in-95">
             <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600"><Lock size={32} /></div>
             <h3 className="text-xl font-bold mb-2">{authMode === 'login' ? 'Teacher Login' : 'Register Teacher'}</h3>
             <div className="space-y-4 text-left">
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Email</label><div className="relative"><Mail size={16} className="absolute left-3 top-3 text-slate-400" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="name@university.ac.th" /></div></div>
                 <div><label className="text-xs font-bold text-slate-500 uppercase">Password</label><div className="relative"><Key size={16} className="absolute left-3 top-3 text-slate-400" /><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="••••••••" /></div></div>
             </div>
             <button onClick={handleAuth} disabled={loading} className="w-full mt-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-70 flex justify-center items-center gap-2">{loading ? <Loader2 className="animate-spin" size={18}/> : (authMode === 'login' ? 'Sign In' : 'Create Account')}</button>
             {/* ปุ่มสมัครสมาชิกถูกถอดออก เพราะต้องปิด signup ใน Supabase เพื่อกันคนสมัครอีเมลสวมรอยเป็นนิสิต
                 บัญชีอาจารย์สร้างจาก Supabase Dashboard แล้วเพิ่มลงตาราง teachers */}
             <div className="mt-4 text-xs text-slate-400">บัญชีอาจารย์สร้างโดยผู้ดูแลระบบเท่านั้น</div>
             <button onClick={() => setShowLoginModal(false)} className="mt-4 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showProjectManager && <ProjectManagerModal onClose={() => setShowProjectManager(false)} />}
      {showCriteriaModal && <CriteriaManagerModal onClose={() => setShowCriteriaModal(false)} />}
      {showWeights && (
        <WeightModal
          project={teacherProject}
          initial={weightsOf(teacherProject)}
          busy={loading}
          onSave={saveWeights}
          onClose={() => setShowWeights(false)}
        />
      )}
      {showStudentCriteria && (
        <StudentCriteriaModal
          project={teacherProject}
          initial={studentCriteriaOf(teacherProject)}
          peerWeight={weightsOf(teacherProject).peer}
          busy={loading}
          onSave={saveStudentCriteria}
          onClose={() => setShowStudentCriteria(false)}
        />
      )}
      {/* บังคับตั้งรหัสใหม่มาก่อน ปิดไม่ได้จนกว่าจะเปลี่ยน */}
      {(mustChangePassword || showChangePassword) && (
        <ChangePasswordModal
          forced={mustChangePassword}
          loading={loading}
          onSubmit={handleChangeOwnPassword}
          onClose={() => setShowChangePassword(false)}
          onLogout={handleStudentLogout}
        />
      )}

      {view === 'landing' && (
        <div className="w-full flex flex-col items-center justify-center flex-grow py-12 px-4 space-y-8">
          <div className="text-center space-y-2"><h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 tracking-tight">ระบบประเมิน Project </h1><p className="text-slate-500 text-lg">กรุณาเลือกบทบาทผู้ประเมิน คุณคือใคร?</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <button onClick={() => setView('student-login')} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-amber-400 text-left transition-all"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600 group-hover:scale-110 transition"><User size={24} /></div><h2 className="text-2xl font-bold text-slate-800 mb-2">สำหรับนิสิต</h2><p className="text-slate-500 text-sm">เข้าสู่ระบบเพื่อประเมินเพื่อนร่วมทีม (Peer Evaluation)</p></button>
            <button onClick={() => setShowLoginModal(true)} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border-2 border-transparent hover:border-indigo-500 text-left transition-all"><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600 group-hover:scale-110 transition"><Lock size={24} /></div><h2 className="text-2xl font-bold text-slate-800 mb-2">สำหรับอาจารย์</h2><p className="text-slate-500 text-sm">ประเมินโครงงาน จัดการกลุ่ม และสรุปคะแนนรวมทั้งหมด</p></button>
          </div>
        </div>
      )}

      {view === 'student-login' && renderStudentLogin()}
      {view === 'student-dashboard' && renderStudentDashboard()}
      {view === 'student-vote' && renderStudentVote()}

      {view === 'teacher' && (
        <div className="w-full max-w-[1400px] mx-auto py-6 space-y-6 px-4 flex-grow">
           <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-600 flex flex-col xl:flex-row justify-between items-center gap-4">
             <div><h1 className="text-xl font-bold text-slate-800">Teacher Dashboard</h1><p className="text-xs text-slate-500 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${liveConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}/>{liveConnected ? 'อัปเดตสดเมื่อนิสิตส่งคะแนนหรือโหวต' : 'ไม่ได้เชื่อมต่อแบบเรียลไทม์'}</p></div>
             <div className="flex flex-wrap items-center justify-center gap-3"><div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200"><span className="text-xs font-bold text-slate-500 uppercase px-2">Project:</span><select value={teacherProject} onChange={(e) => { setTeacherProject(e.target.value); setCurrentGroup(null); }} className="bg-white border border-slate-300 text-slate-700 text-sm rounded-md p-2 outline-none font-semibold cursor-pointer">{projectList.map((p, i) => <option key={i} value={p}>{p}</option>)}</select><button onClick={() => setShowProjectManager(true)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition"><Settings size={18} /></button></div><button onClick={toggleProjectStatus} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-all ${projectStatus[teacherProject] ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}><Power size={16}/> {projectStatus[teacherProject] ? 'เปิดรับ (Open)' : 'ปิดรับ (Closed)'}</button><button onClick={toggleVoteOpen} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-all ${projectVoteOpen[teacherProject] ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}><Trophy size={16}/> {projectVoteOpen[teacherProject] ? 'โหวตเปิด' : 'โหวตปิด'}</button></div>
             <div className="flex flex-wrap items-center justify-center gap-3"><button onClick={() => setShowImport(true)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded hover:bg-blue-100 transition"><Upload size={16}/> นำเข้ากลุ่ม</button><button onClick={() => setShowStudentCriteria(true)} className="flex items-center gap-1 text-sm bg-amber-50 text-amber-700 px-3 py-2 rounded hover:bg-amber-100 transition"><Pencil size={16}/> เกณฑ์ประเมินเพื่อน</button><button onClick={() => setShowWeights(true)} className="flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 px-3 py-2 rounded hover:bg-indigo-100 transition"><Calculator size={16}/> สัดส่วนคะแนน ({weightsOf(teacherProject).teacher}/{weightsOf(teacherProject).peer})</button><button onClick={handleProvisionStudents} className="flex items-center gap-1 text-sm bg-amber-50 text-amber-700 px-3 py-2 rounded hover:bg-amber-100 transition"><Users size={16}/> สร้างบัญชีนิสิต</button><button onClick={handleResetStudentPassword} className="flex items-center gap-1 text-sm bg-slate-100 text-slate-700 px-3 py-2 rounded hover:bg-slate-200 transition"><Key size={16}/> รีเซ็ตรหัสนิสิต</button><button onClick={handleExportExcel} className="flex items-center gap-1 text-sm bg-green-50 text-green-700 px-3 py-2 rounded hover:bg-green-100 transition"><FileSpreadsheet size={16}/> Export Excel</button><button onClick={handleSignOut} className="flex items-center gap-1 text-sm bg-red-50 text-red-700 px-3 py-2 rounded hover:bg-red-100 transition"><LogOut size={16}/> ออกจากระบบ</button></div>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
             <div className="lg:col-span-8 space-y-6">
               {/* เดิมเกณฑ์จะโผล่ต่อเมื่อเลือกกลุ่มแล้วเท่านั้น ย้ายมาแสดงตลอดเพื่อให้ตรวจก่อนเริ่มประเมินได้ */}
               <details open className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                 <summary className="flex justify-between items-start gap-3 cursor-pointer list-none">
                   <div>
                     <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18} className="text-indigo-500"/> เกณฑ์ให้คะแนนของอาจารย์</h3>
                     <p className="text-xs text-slate-500 mt-1">
                       ใช้ร่วมกัน <span className="font-bold">ทุกกลุ่ม</span> ใน {teacherProject} · {(allProjectCriteria[teacherProject] ?? []).length} ข้อ · เต็ม {teacherMaxOf(teacherProject)} คะแนน → ถ่วงเป็น {weightsOf(teacherProject).teacher}%
                     </p>
                   </div>
                   <button onClick={e => { e.preventDefault(); e.stopPropagation(); setShowCriteriaModal(true); }}
                     className="text-xs flex items-center gap-1 bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 shadow-sm transition shrink-0"><Pencil size={14}/> แก้ไขเกณฑ์</button>
                 </summary>
                 <div className="mt-4 space-y-3">
                   {(allProjectCriteria[teacherProject] ?? []).length === 0 ? (
                     <p className="text-sm text-slate-400 py-4 text-center">ยังไม่มีเกณฑ์ในโปรเจกต์นี้</p>
                   ) : (allProjectCriteria[teacherProject] ?? []).map((c, i) => (
                     <div key={i} className="border border-slate-100 rounded-lg p-3 bg-slate-50/60">
                       <div className="font-bold text-sm text-slate-700 mb-2">{c.name}</div>
                       <div className="flex flex-wrap gap-2">
                         {(c.options ?? []).map((o, j) => (
                           <span key={j} className="text-xs bg-white border border-slate-200 rounded-full px-2.5 py-1 text-slate-600">
                             <span className="font-mono font-bold text-indigo-600">{o.score}</span> · {o.desc}
                           </span>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
               </details>

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
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{item.options.map(opt => (<button key={opt.score} onClick={() => setGroupCriteria(groupCriteria.map(c => c.id === item.id ? {...c, score: opt.score} : c))} className={`p-3 text-left rounded-lg border text-xs transition-all ${item.score === opt.score ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105' : 'bg-white text-slate-600 hover:bg-slate-50 hover:border-indigo-300'}`}><div className="font-bold text-sm mb-1">{opt.score} คะแนน</div><div className="opacity-90 leading-tight">{opt.desc}</div></button>))}</div>
                        </div>
                      ))}
                    </div>
                  )}
               </div>

               <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2"><CheckCircle size={18} className="text-indigo-500"/> สถานะการประเมินของนิสิต</h3>
                 <p className="text-xs text-slate-500 mb-4 mt-1">นับจากจำนวนเพื่อนที่แต่ละคนต้องประเมิน ชื่อที่ขึ้นสีแดงคือยังไม่ครบ</p>
                 {evaluationProgress(teacherProject).length === 0 ? (
                   <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีกลุ่มในโปรเจกต์นี้</p>
                 ) : (
                   <div className="space-y-4">
                     {evaluationProgress(teacherProject).map((g, i) => (
                       <div key={i} className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                         <div className="flex justify-between items-center mb-3 gap-2">
                           <span className="font-bold text-slate-700 text-sm truncate">{g.group}</span>
                           <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${g.doneCount === g.members.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                             ครบแล้ว {g.doneCount}/{g.members.length} คน
                           </span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                           {g.members.map((m, j) => (
                             <span key={j} title={`ประเมินแล้ว ${m.done} จาก ${m.required} คน`}
                               className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${m.complete ? 'bg-white border-slate-200 text-slate-500' : 'bg-red-50 border-red-200 text-red-700 font-medium'}`}>
                               {m.complete ? <Check size={12} className="text-green-500"/> : <Clock size={12}/>}
                               {m.label}
                               <span className="font-mono opacity-70">{m.done}/{m.required}</span>
                             </span>
                           ))}
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
             <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                   <h3 className="font-bold text-slate-700 flex items-center gap-2"><Trophy size={18} className="text-amber-500"/> Popular Vote ({teacherProject})</h3>
                   <p className="text-xs text-slate-500 mb-4 mt-1">{projectVoteOpen[teacherProject] ? 'กำลังเปิดโหวต — นิสิตยังไม่เห็นผล คุณเห็นสด' : 'ปิดโหวตอยู่ — นิสิตในโปรเจกต์นี้เห็นผลแล้ว'}</p>
                   {renderVoteResults(teacherProject)}
                   {projectVoteOpen[teacherProject] && (
                     <div className="mt-5 pt-4 border-t border-slate-100">
                       <p className="text-xs font-bold text-slate-500 uppercase mb-2">เสียงของคุณ</p>
                       {renderVoteBallot(teacherProject, null)}
                     </div>
                   )}
                </div>
                <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg">
                   <h3 className="font-bold flex items-center gap-2 mb-6 text-slate-300 uppercase tracking-wider text-sm"><Calculator size={16}/> สรุปคะแนน ({teacherProject})</h3>
                   <div className="space-y-4 text-sm mb-6">
                     <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"><span className="text-slate-300">คะแนนกลุ่ม ({weightsOf(teacherProject).teacher}%)</span><span className="font-mono text-xl font-bold">{calculateScores().weightedGroupScore.toFixed(2)}</span></div>
                     <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"><div className="flex flex-col"><span className="text-slate-300">คะแนน Peer ({weightsOf(teacherProject).peer}%)</span><span className="text-[10px] text-slate-400">จากเพื่อน {calculateScores().groupEvalsCount} คน</span></div><span className="font-mono text-xl font-bold">{calculateScores().weightedIndivScore.toFixed(2)}</span></div>
                     <div className="pt-4 border-t border-slate-600 flex justify-between items-end"><span className="text-indigo-400 font-bold text-lg">Total Score</span><span className="text-4xl font-bold tracking-tight">{(calculateScores().weightedGroupScore + calculateScores().weightedIndivScore).toFixed(2)}</span></div>
                   </div>
                   <button disabled={!currentGroup} onClick={saveFinalRecord} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 transition transform active:scale-95 flex justify-center items-center gap-2"><Save size={18}/> บันทึกคะแนนกลุ่มนี้</button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 max-h-[500px] overflow-hidden flex flex-col">
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

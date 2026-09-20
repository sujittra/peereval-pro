// =========================================================
//  Edge Function: student-admin
// =========================================================
//  งานที่ต้องใช้ service_role key ซึ่งเรียกจากเบราว์เซอร์ไม่ได้
//    - provision : สร้างบัญชีนิสิตทั้งโปรเจกต์จากรายชื่อที่อาจารย์ import
//    - reset     : รีเซ็ตรหัสผ่านนิสิตกลับเป็นรหัสนิสิต
//
//  ทุก action ตรวจก่อนว่าผู้เรียกอยู่ในตาราง teachers จริง
//
//  deploy:  supabase functions deploy student-admin
//  (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ถูกใส่ให้อัตโนมัติ ไม่ต้องตั้งเอง)
// =========================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

// ต้องตรงกับ public.student_email() ใน SQL และ STUDENT_EMAIL_DOMAIN ใน App.tsx
const STUDENT_EMAIL_DOMAIN = 'up.ac.th';
const studentEmail = (studentId: string) => `${studentId.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // ---- ตรวจสิทธิ์ผู้เรียก: ต้องเป็นอาจารย์เท่านั้น ----
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'ไม่พบ authorization header' }, 401);

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller.user) return json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }, 401);

    const { data: teacher } = await admin
      .from('teachers')
      .select('user_id')
      .eq('user_id', caller.user.id)
      .maybeSingle();
    if (!teacher) return json({ error: 'เฉพาะอาจารย์เท่านั้น' }, 403);

    const body = await req.json().catch(() => ({}));

    // =====================================================
    //  provision: สร้างบัญชีนิสิตทั้งโปรเจกต์
    // =====================================================
    if (body.action === 'provision') {
      const projectName = String(body.project_name ?? '').trim();
      if (!projectName) return json({ error: 'ต้องระบุ project_name' }, 400);

      const { data: groups, error: groupsErr } = await admin
        .from('groups')
        .select('name, members')
        .eq('project_name', projectName);
      if (groupsErr) return json({ error: groupsErr.message }, 500);
      if (!groups?.length) return json({ error: `ไม่พบกลุ่มในโปรเจกต์ "${projectName}"` }, 404);

      // รวมรายชื่อจากทุกกลุ่ม ตัดคนที่ไม่มีรหัสนิสิต และคนที่ซ้ำ (อยู่หลายกลุ่ม)
      const roster = new Map<string, string>(); // student_id -> name
      const missingId: string[] = [];
      for (const g of groups) {
        for (const m of (g.members ?? []) as Array<{ id?: string; name?: string }>) {
          const sid = (m.id ?? '').trim();
          if (!sid) { missingId.push(`${g.name}: ${m.name ?? '(ไม่มีชื่อ)'}`); continue; }
          if (!roster.has(sid)) roster.set(sid, (m.name ?? '').trim());
        }
      }
      if (roster.size === 0) return json({ error: 'ไม่มีนิสิตที่มีรหัสนิสิตในโปรเจกต์นี้', missingId }, 400);

      const created: string[] = [];
      const existed: string[] = [];
      const failed: Array<{ student_id: string; reason: string }> = [];

      for (const [sid, name] of roster) {
        const { error } = await admin.auth.admin.createUser({
          email: studentEmail(sid),
          password: sid,
          email_confirm: true,
          // app_metadata แก้ได้เฉพาะ service_role — นิสิตปลอมตัวเป็นคนอื่นไม่ได้
          app_metadata: { role: 'student', student_id: sid },
          user_metadata: { must_change_password: true, display_name: name },
        });
        if (!error) { created.push(sid); continue; }

        // createUser คืน error เมื่ออีเมลซ้ำ = มีบัญชีอยู่แล้ว ไม่ถือว่าผิดพลาด
        const msg = error.message ?? '';
        if (/already|exist|registered|duplicate/i.test(msg)) existed.push(sid);
        else failed.push({ student_id: sid, reason: msg });
      }

      return json({ ok: true, project_name: projectName, created, existed, failed, missingId });
    }

    // =====================================================
    //  reset: รีเซ็ตรหัสผ่านกลับเป็นรหัสนิสิต
    // =====================================================
    if (body.action === 'reset') {
      const studentId = String(body.student_id ?? '').trim();
      if (!studentId) return json({ error: 'ต้องระบุ student_id' }, 400);

      const { data: userId, error: lookupErr } = await admin.rpc('auth_user_id_by_email', {
        p_email: studentEmail(studentId),
      });
      if (lookupErr) return json({ error: lookupErr.message }, 500);
      if (!userId) return json({ error: `ไม่พบบัญชีของรหัสนิสิต ${studentId}` }, 404);

      const { error: updateErr } = await admin.auth.admin.updateUserById(userId as string, {
        password: studentId,
        user_metadata: { must_change_password: true },
      });
      if (updateErr) return json({ error: updateErr.message }, 500);

      return json({ ok: true, student_id: studentId });
    }

    return json({ error: `ไม่รู้จัก action "${body.action ?? ''}"` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

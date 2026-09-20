-- =========================================================
--  peereval-pro : Row Level Security policies
-- =========================================================
--  รันทั้งไฟล์ใน Supabase Dashboard > SQL Editor
--  ทั้งไฟล์ห่อด้วย transaction ถ้ามี statement ไหนพัง จะ rollback ทั้งหมด
--  (สำคัญ: ถ้าเปิด RLS แล้ว policy ไม่ครบ เว็บจะอ่านข้อมูลไม่ได้ทันที)
--
--  โมเดลสิทธิ์ที่ใช้:
--    anon          = ผู้เข้าชมทั่วไป + นิสิต (แอปไม่ได้ล็อกอินนิสิตผ่าน supabase.auth)
--    authenticated = บัญชีที่ล็อกอินผ่าน Supabase Auth
--    is_teacher()  = บัญชีที่ล็อกอิน "และ" อยู่ในตาราง teachers (ดูส่วนที่ 1)
-- =========================================================

begin;

-- =========================================================
--  ส่วนที่ 0: ลบ policy ชุดเก่าทิ้งให้หมด  << ห้ามข้าม
-- =========================================================
--  RLS รวม policy แบบ OR ไม่ใช่ AND
--  ถ้าแถวไหนผ่าน policy ตัวใดตัวหนึ่ง = เข้าถึงได้ทันที
--  policy ชุดเก่าให้สิทธิ์ role 'public' ซึ่งครอบคลุม anon ด้วย
--  ถ้าไม่ลบทิ้ง policy ใหม่ทั้งหมดจะไม่มีผลอะไรเลย

drop policy if exists "Public Read Projects"         on public.projects;
drop policy if exists "Teacher Manage Projects"      on public.projects;

drop policy if exists "Public Read Criteria"         on public.criteria;
drop policy if exists "Teacher Manage Criteria"      on public.criteria;

drop policy if exists "Public Read Groups"           on public.groups;
drop policy if exists "Teacher Manage Groups"        on public.groups;

drop policy if exists "Public Read Peer Evals"       on public.peer_evals;
drop policy if exists "Public Insert Peer Evals"     on public.peer_evals;
drop policy if exists "Teacher Manage Peer Evals"    on public.peer_evals;

drop policy if exists "Public Read Teacher Evals"    on public.teacher_evals;
drop policy if exists "Teacher Manage Teacher Evals" on public.teacher_evals;


-- =========================================================
--  ส่วนที่ 1: ตาราง whitelist อาจารย์
-- =========================================================
--  จำเป็น เพราะหน้าแอปเปิดให้ "สมัครสมาชิก" ได้ (authMode: 'register')
--  ถ้าให้สิทธิ์ตาม role 'authenticated' เฉยๆ ใครก็ตามที่กดสมัคร
--  จะได้สิทธิ์อาจารย์เต็มทันที policy ทั้งหมดจะไร้ความหมาย

create table if not exists public.teachers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

-- อ่านได้เฉพาะแถวของตัวเอง เพิ่ม/ลบอาจารย์ทำผ่าน Dashboard เท่านั้น
drop policy if exists teachers_read_self on public.teachers;
create policy teachers_read_self on public.teachers
  for select to authenticated
  using (user_id = auth.uid());

-- ฟังก์ชันตรวจสิทธิ์ ใช้ security definer เพื่อให้อ่านตาราง teachers ได้
-- โดยไม่ติด RLS ของตัวเอง
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teachers t where t.user_id = auth.uid()
  );
$$;

revoke all on function public.is_teacher() from public;
grant execute on function public.is_teacher() to authenticated;

-- ---------------------------------------------------------
--  ลงทะเบียนบัญชีอาจารย์  <<< แก้อีเมลตรงนี้ก่อนรัน
-- ---------------------------------------------------------
insert into public.teachers (user_id, email)
select id, email from auth.users
where email = 'sujittra.sa@up.ac.th'
on conflict (user_id) do nothing;


-- =========================================================
--  ส่วนที่ 2: เปิด RLS ทุกตาราง
-- =========================================================
alter table public.projects      enable row level security;
alter table public.criteria      enable row level security;
alter table public.groups        enable row level security;
alter table public.peer_evals    enable row level security;
alter table public.teacher_evals enable row level security;


-- =========================================================
--  ส่วนที่ 3: projects  (ชื่อโปรเจกต์ + สถานะเปิด/ปิด)
-- =========================================================
--  อ่าน: สาธารณะ — หน้า login ของนิสิตต้องใช้ทำ dropdown เลือกโปรเจกต์
--  เขียน: อาจารย์เท่านั้น

drop policy if exists projects_select_public  on public.projects;
drop policy if exists projects_write_teacher  on public.projects;

create policy projects_select_public on public.projects
  for select to anon, authenticated
  using (true);

create policy projects_write_teacher on public.projects
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- =========================================================
--  ส่วนที่ 4: criteria  (เกณฑ์การให้คะแนนของแต่ละโปรเจกต์)
-- =========================================================
--  อ่าน: สาธารณะ — นิสิตต้องเห็นเกณฑ์ตอนกรอกแบบประเมิน
--  เขียน: อาจารย์เท่านั้น (โค้ดใช้ .upsert() จึงต้องได้ทั้ง insert และ update)

drop policy if exists criteria_select_public on public.criteria;
drop policy if exists criteria_write_teacher on public.criteria;

create policy criteria_select_public on public.criteria
  for select to anon, authenticated
  using (true);

create policy criteria_write_teacher on public.criteria
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- =========================================================
--  ส่วนที่ 5: groups  (รายชื่อกลุ่มและสมาชิก)
-- =========================================================
--  อ่าน: สาธารณะ — หน้า login ต้องใช้ทำ dropdown เลือกกลุ่มและชื่อตัวเอง
--  เขียน: อาจารย์เท่านั้น (import จาก Excel)
--
--  !! ข้อจำกัดที่ยังแก้ไม่ได้ด้วย RLS ดูหมายเหตุท้ายไฟล์ !!

drop policy if exists groups_select_public on public.groups;
drop policy if exists groups_write_teacher on public.groups;

create policy groups_select_public on public.groups
  for select to anon, authenticated
  using (true);

create policy groups_write_teacher on public.groups
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- =========================================================
--  ส่วนที่ 6: peer_evals  (คะแนนที่นิสิตให้เพื่อน)  << ตารางที่อ่อนไหวที่สุด
-- =========================================================
--  insert: นิสิต (anon) ส่งคะแนนได้
--  select: อาจารย์เท่านั้น — นิสิตห้ามเห็นคะแนนที่เพื่อนให้กัน
--  update/delete: ไม่ประกาศ policy = ไม่มีใครทำได้ผ่าน API
--                 (กันนิสิตแก้/ลบคะแนนที่ส่งไปแล้ว)

drop policy if exists peer_evals_insert_student on public.peer_evals;
drop policy if exists peer_evals_select_teacher on public.peer_evals;

create policy peer_evals_insert_student on public.peer_evals
  for insert to anon, authenticated
  with check (true);

create policy peer_evals_select_teacher on public.peer_evals
  for select to authenticated
  using (public.is_teacher());

-- ---------------------------------------------------------
--  view สำหรับให้นิสิตเช็คว่า "ประเมินใครไปแล้วบ้าง"
-- ---------------------------------------------------------
--  หน้า student dashboard ต้องรู้สถานะนี้ แต่ไม่ควรเห็นคะแนน
--  view นี้เปิดเฉพาะ 4 คอลัมน์ที่ไม่มีคะแนน (ไม่มี scores / total_raw)
--  security_invoker = off  ตั้งใจให้ view ข้าม RLS ของตารางแม่
--  ความปลอดภัยมาจากการที่ view เลือกเฉพาะคอลัมน์ที่ปลอดภัย

drop view if exists public.peer_eval_status;

create view public.peer_eval_status
with (security_invoker = off) as
  select project_name, group_name, evaluator, target
  from public.peer_evals;

revoke all on public.peer_eval_status from anon, authenticated;
grant select on public.peer_eval_status to anon, authenticated;


-- =========================================================
--  ส่วนที่ 7: teacher_evals  (คะแนนที่อาจารย์ให้)
-- =========================================================
--  อาจารย์เท่านั้นทุกอย่าง นิสิตไม่ต้องอ่านเลย
--  (โค้ดใช้ records เฉพาะในหน้าอาจารย์: สรุปผล, export, dashboard)

drop policy if exists teacher_evals_all_teacher on public.teacher_evals;

create policy teacher_evals_all_teacher on public.teacher_evals
  for all to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

commit;


-- =========================================================
--  หมายเหตุ: สิ่งที่ RLS แก้ให้ไม่ได้
-- =========================================================
--
--  1. รหัสนิสิตถูกส่งมาที่เบราว์เซอร์ทุกคน
--     แอปใช้รหัสนิสิตเป็น "รหัสผ่าน" (App.tsx:372) แต่ตรวจฝั่ง client
--     โดยเทียบกับ groups.members ที่โหลดมาทั้งก้อนแล้ว
--     ส่วนที่ 5 จึงยังต้องเปิด select ให้ anon = ใครก็เปิด devtools
--     ดูรหัสนิสิตของทุกคนได้ แล้วสวมรอยประเมินแทนเพื่อนได้
--
--     ทางแก้จริงต้องย้ายการตรวจสอบไปฝั่ง server:
--       - view ที่ตัดคอลัมน์ id ออกจาก members (ให้ dropdown ใช้แค่ชื่อ)
--       - RPC แบบ security definer ที่รับรหัสนิสิตไปตรวจแล้วคืน token
--       - หรือใช้ Supabase Anonymous Sign-in ออก session จริงให้นิสิต
--     ทั้งหมดนี้ต้องแก้โค้ด React ด้วย ไม่ใช่แค่ SQL
--
--  2. นิสิตยังส่งคะแนนปลอมได้
--     peer_evals เปิด insert ให้ anon แบบไม่มีเงื่อนไข เพราะ RLS
--     ไม่มีทางรู้ว่า anon คนไหนเป็นใคร จึงกันการ spam insert ไม่ได้
--     (แต่กันการ "อ่าน" และ "แก้/ลบ" ได้แล้ว ซึ่งเป็นความเสี่ยงหลัก)
--     แก้ได้ด้วยวิธีเดียวกับข้อ 1 คือให้นิสิตมี session จริง
--
--  3. ต้องแก้โค้ดที่ App.tsx:189 ด้วย ไม่งั้นหน้านิสิตจะพัง
--     ดูรายละเอียดในคำตอบของ Claude
-- =========================================================

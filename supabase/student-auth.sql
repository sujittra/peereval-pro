-- =========================================================
--  peereval-pro : ระบบบัญชีนิสิต (Supabase Auth)
-- =========================================================
--  รันหลังจาก policies.sql และ groups-unique.sql แล้วเท่านั้น
--
--  โมเดล:
--    - นิสิต 1 คน = 1 บัญชีใน Supabase Auth
--    - อีเมล = <รหัสนิสิต>@up.ac.th  (สร้างอัตโนมัติ ไม่ได้ใช้ส่งจริง)
--    - รหัสผ่านเริ่มต้น = รหัสนิสิต บังคับเปลี่ยนตอนเข้าครั้งแรก
--    - บัญชีถูกสร้างโดย Edge Function เท่านั้น (ใช้ service_role)
--      *** ต้องปิด "Allow new users to sign up" ใน Supabase Dashboard ***
--      ไม่งั้นใครก็สมัครอีเมล <รหัสนิสิตคนอื่น>@up.ac.th แล้วสวมรอยได้
--
--  ตัวตนของนิสิตอ่านจาก app_metadata ใน JWT ซึ่งแก้ได้เฉพาะ service_role
--  (ถ้าเก็บใน user_metadata นิสิตจะแก้เองได้ = ปลอมตัวเป็นคนอื่นได้)
-- =========================================================

begin;

-- =========================================================
--  ส่วนที่ 1: ฟังก์ชันระบุตัวตนนิสิต
-- =========================================================

create or replace function public.current_student_id()
returns text
language sql
stable
as $$
  select nullif(
    case
      when coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'student'
        then coalesce(auth.jwt() -> 'app_metadata' ->> 'student_id', '')
      else ''
    end, '');
$$;

grant execute on function public.current_student_id() to authenticated;

-- อีเมลของบัญชีนิสิต ใช้ร่วมกันทั้ง SQL และ Edge Function
-- ถ้าเปลี่ยนโดเมน ต้องแก้ทั้ง 3 ที่: ฟังก์ชันนี้, Edge Function, STUDENT_EMAIL_DOMAIN ใน App.tsx
create or replace function public.student_email(p_student_id text)
returns text
language sql
immutable
as $$
  select lower(trim(p_student_id)) || '@up.ac.th';
$$;


-- =========================================================
--  ส่วนที่ 2: view กลุ่มของนิสิตคนที่ล็อกอินอยู่
-- =========================================================
--  แทนการให้ anon อ่านตาราง groups ทั้งก้อน
--  ตัดคอลัมน์ id (รหัสนิสิต) ออกจาก members เพื่อไม่ให้เพื่อนร่วมกลุ่ม
--  เห็นรหัสของกันและกัน เหลือแค่ชื่อที่ใช้แสดงผล
--
--  security_invoker = off  ตั้งใจให้ view ข้าม RLS ของ groups
--  ความปลอดภัยมาจากเงื่อนไข where ที่ผูกกับ current_student_id()

drop view if exists public.my_groups;

create view public.my_groups
with (security_invoker = off) as
select
  g.id,
  g.project_name,
  g.name,
  p.is_active,
  -- ชื่อของตัวเองในกลุ่มนี้ ใช้เป็น evaluator ตอนส่งคะแนน
  (select mm ->> 'label'
     from jsonb_array_elements(g.members) mm
    where mm ->> 'id' = public.current_student_id()
    limit 1) as my_label,
  -- รายชื่อเพื่อนร่วมกลุ่ม เฉพาะชื่อ ไม่มีรหัสนิสิต
  (select jsonb_agg(jsonb_build_object('name', m ->> 'name', 'label', m ->> 'label') order by ord)
     from jsonb_array_elements(g.members) with ordinality as t(m, ord)) as members
from public.groups g
join public.projects p on p.name = g.project_name
where public.current_student_id() is not null
  and exists (
    select 1 from jsonb_array_elements(g.members) mm
     where mm ->> 'id' = public.current_student_id()
  );

revoke all on public.my_groups from anon, authenticated;
grant select on public.my_groups to authenticated;


-- =========================================================
--  ส่วนที่ 3: ปิดการอ่านของ anon
-- =========================================================
--  หน้าล็อกอินใหม่ใช้ "รหัสนิสิต + รหัสผ่าน" ไม่ต้องมี dropdown
--  จึงไม่ต้องเปิดข้อมูลอะไรให้ผู้ที่ยังไม่ล็อกอินอีกต่อไป

drop policy if exists projects_select_public on public.projects;
drop policy if exists criteria_select_public on public.criteria;
drop policy if exists groups_select_public   on public.groups;

-- projects: ชื่อโปรเจกต์ไม่ใช่ความลับ แต่ไม่มีเหตุให้ anon เห็น
create policy projects_select_authed on public.projects
  for select to authenticated
  using (true);

-- criteria: นิสิตต้องเห็นเกณฑ์ตอนกรอกแบบประเมิน
create policy criteria_select_authed on public.criteria
  for select to authenticated
  using (true);

-- groups: อาจารย์เท่านั้น นิสิตใช้ view my_groups แทน
create policy groups_select_teacher on public.groups
  for select to authenticated
  using (public.is_teacher());


-- =========================================================
--  ส่วนที่ 4: บังคับว่า evaluator ต้องเป็นตัวนิสิตเองจริง
-- =========================================================
--  !! policy ในส่วนนี้ถูกแทนที่แล้วโดย fix-group-lookup-rls.sql !!
--  ที่นี่ query ตาราง groups ตรงๆ ซึ่งใช้ไม่ได้ เพราะส่วนที่ 3 ด้านบน
--  เพิ่งปิดไม่ให้นิสิตอ่าน groups และ RLS บังคับกับ subquery ใน policy ด้วย
--  ทำให้ exists() เป็น false เสมอ นิสิตส่งคะแนนไม่ได้
--  ต้องรัน fix-group-lookup-rls.sql ต่อท้ายเสมอ
--  เดิม anon insert อะไรก็ได้ เพราะ RLS ไม่รู้ว่าใครเป็นใคร
--  ตอนนี้ตรวจได้แล้วว่า รหัสนิสิตใน JWT อยู่ในกลุ่มนั้นจริง
--  และชื่อที่อ้างเป็น evaluator ตรงกับ label ของตัวเองในกลุ่มนั้น

drop policy if exists peer_evals_insert_student on public.peer_evals;

create policy peer_evals_insert_student on public.peer_evals
  for insert to authenticated
  with check (
    exists (
      select 1
        from public.groups g,
             lateral jsonb_array_elements(g.members) m
       where g.project_name = peer_evals.project_name
         and g.name         = peer_evals.group_name
         and m ->> 'id'     = public.current_student_id()
         and m ->> 'label'  = peer_evals.evaluator
    )
  );


-- =========================================================
--  ส่วนที่ 5: view สถานะการประเมินของตัวเอง
-- =========================================================
--  แทนของเดิมที่เปิดให้ทุกคนเห็นสถานะของทุกคน
--  ตอนนี้จำกัดเหลือเฉพาะรายการที่ตัวเองเป็นผู้ประเมิน

drop view if exists public.peer_eval_status;

create view public.peer_eval_status
with (security_invoker = off) as
select e.project_name, e.group_name, e.evaluator, e.target
from public.peer_evals e
where public.current_student_id() is not null
  and exists (
    select 1
      from public.groups g,
           lateral jsonb_array_elements(g.members) m
     where g.project_name = e.project_name
       and g.name         = e.group_name
       and m ->> 'id'     = public.current_student_id()
       and m ->> 'label'  = e.evaluator
  );

revoke all on public.peer_eval_status from anon, authenticated;
grant select on public.peer_eval_status to authenticated;


-- =========================================================
--  ส่วนที่ 5.5: ฟังก์ชันช่วยสำหรับ Edge Function
-- =========================================================
--  supabase-js ฝั่ง admin ไม่มี API ค้นหา user จากอีเมลโดยตรง
--  (listUsers แบ่งหน้า ถ้านิสิตเยอะจะต้องวนหลายรอบ)
--  ฟังก์ชันนี้อ่าน auth.users ให้ เรียกได้เฉพาะ service_role เท่านั้น

create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

commit;


-- =========================================================
--  ส่วนที่ 6: กันการส่งคะแนนซ้ำ  (รันแยก ตรวจก่อน)
-- =========================================================
--  ขั้นที่ 1 เช็คว่ามีข้อมูลซ้ำค้างอยู่ไหม ถ้าได้ 0 แถวข้ามไปขั้นที่ 3

-- select project_name, group_name, evaluator, target, count(*)
-- from public.peer_evals
-- group by project_name, group_name, evaluator, target
-- having count(*) > 1;

--  ขั้นที่ 2 ลบซ้ำ (เก็บแถวล่าสุดไว้ 1 แถว) — ข้ามถ้าขั้นที่ 1 ได้ 0 แถว
--  !! ลบถาวร เปลี่ยน delete เป็น select ดูก่อนได้ !!

-- delete from public.peer_evals e
-- where exists (
--   select 1 from public.peer_evals e2
--    where e2.project_name = e.project_name
--      and e2.group_name   = e.group_name
--      and e2.evaluator    = e.evaluator
--      and e2.target       = e.target
--      and e2.ctid         > e.ctid
-- );

--  ขั้นที่ 3 เพิ่ม constraint

-- do $$
-- begin
--   if not exists (
--     select 1 from pg_constraint
--      where conname = 'peer_evals_one_vote_unique'
--        and conrelid = 'public.peer_evals'::regclass
--   ) then
--     alter table public.peer_evals
--       add constraint peer_evals_one_vote_unique
--       unique (project_name, group_name, evaluator, target);
--   end if;
-- end $$;

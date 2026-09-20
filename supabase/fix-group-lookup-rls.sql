-- =========================================================
--  peereval-pro : แก้ policy ที่ query ตาราง groups ตรงๆ
-- =========================================================
--  รันได้เลย ไม่ต้องรันไฟล์อื่นก่อน (ต้องเคยรัน student-auth.sql และ
--  popular-vote.sql มาแล้ว)
--
--  ปัญหา:
--  RLS บังคับกับ "ทุกตารางที่ policy ไปอ่าน" ไม่ใช่เฉพาะตารางเจ้าของ policy
--  ตั้งแต่ student-auth.sql เปลี่ยน groups เป็นอ่านได้เฉพาะอาจารย์
--  subquery ที่ policy ของ peer_evals และ popular_votes ใช้ไปอ่าน groups
--  จึงคืน 0 แถวเสมอเมื่อผู้เรียกเป็นนิสิต ทำให้ exists() เป็น false
--  ผลคือนิสิตส่งคะแนนไม่ได้: new row violates row-level security policy
--
--  วิธีแก้:
--  ย้ายการอ่าน groups ไปไว้ในฟังก์ชัน security definer ซึ่งทำงานด้วยสิทธิ์
--  ของเจ้าของฟังก์ชัน จึงข้าม RLS ของ groups ได้ ตัวฟังก์ชันเองยังผูกกับ
--  current_student_id() อยู่ นิสิตจึงตรวจได้เฉพาะเรื่องของตัวเองเหมือนเดิม
-- =========================================================

begin;

-- ---------------------------------------------------------
--  ฟังก์ชันช่วย
-- ---------------------------------------------------------

-- ชื่อที่อ้างเป็นผู้ประเมิน เป็นชื่อของนิสิตคนที่ล็อกอินอยู่ในกลุ่มนั้นจริงหรือไม่
create or replace function public.is_my_label(p_project text, p_group text, p_label text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.groups g,
           lateral jsonb_array_elements(g.members) m
     where g.project_name = p_project
       and g.name         = p_group
       and m ->> 'id'     = public.current_student_id()
       and m ->> 'label'  = p_label
  );
$$;

-- กลุ่มนี้มีอยู่จริงในโปรเจกต์นี้หรือไม่ (ใช้ตอนโหวต)
create or replace function public.group_exists(p_project text, p_group text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
     where g.project_name = p_project and g.name = p_group
  );
$$;

grant execute on function public.is_my_label(text, text, text) to authenticated;
grant execute on function public.group_exists(text, text)      to authenticated;


-- ---------------------------------------------------------
--  peer_evals: ส่งคะแนนให้เพื่อน
-- ---------------------------------------------------------
--  เงื่อนไขเหมือนเดิมทุกอย่าง เปลี่ยนแค่วิธีอ่าน groups

drop policy if exists peer_evals_insert_student on public.peer_evals;

create policy peer_evals_insert_student on public.peer_evals
  for insert to authenticated
  with check (
    public.is_my_label(peer_evals.project_name, peer_evals.group_name, peer_evals.evaluator)
  );


-- ---------------------------------------------------------
--  popular_votes: โหวตและเปลี่ยนใจ
-- ---------------------------------------------------------

drop policy if exists popular_votes_insert on public.popular_votes;
drop policy if exists popular_votes_update on public.popular_votes;

create policy popular_votes_insert on public.popular_votes
  for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.name = popular_votes.project_name and p.vote_open
    )
    and public.group_exists(popular_votes.project_name, popular_votes.group_name)
    and (
      public.is_teacher()
      or (
        public.student_in_project(popular_votes.project_name)
        and not public.is_own_group(popular_votes.project_name, popular_votes.group_name)
      )
    )
  );

create policy popular_votes_update on public.popular_votes
  for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.name = popular_votes.project_name and p.vote_open
    )
    and public.group_exists(popular_votes.project_name, popular_votes.group_name)
    and (
      public.is_teacher()
      or (
        public.student_in_project(popular_votes.project_name)
        and not public.is_own_group(popular_votes.project_name, popular_votes.group_name)
      )
    )
  );

commit;


-- =========================================================
--  หมายเหตุ: projects ไม่ต้องแก้
-- =========================================================
--  policy ข้างบนยังอ่าน public.projects ตรงๆ อยู่ ซึ่งไม่เป็นไร
--  เพราะ projects_select_authed เปิดให้ authenticated อ่านได้ทุกแถว
--  (using (true)) นิสิตจึงเห็นแถวที่ subquery ต้องใช้

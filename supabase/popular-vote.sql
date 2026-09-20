-- =========================================================
--  peereval-pro : Popular Vote
-- =========================================================
--  รันหลัง policies.sql, groups-unique.sql และ student-auth.sql
--
--  กติกา:
--    - เปิด/ปิดแยกตามโปรเจกต์ คนละสวิตช์กับ is_active (การประเมินเพื่อน)
--    - อาจารย์และนิสิตโหวตได้คนละ 1 เสียงต่อโปรเจกต์ เปลี่ยนใจได้จนกว่าจะปิด
--    - นิสิตโหวตกลุ่มตัวเองไม่ได้ (อาจารย์โหวตกลุ่มไหนก็ได้)
--    - ระหว่างเปิดโหวต: อาจารย์เห็นผลสด นิสิตเห็นแค่ว่าตัวเองโหวตอะไร
--    - ปิดโหวตแล้ว: นิสิตในโปรเจกต์นั้นเห็นผลรวมทั้งหมด
--
--  เงื่อนไขทุกข้อบังคับที่ RLS ไม่ใช่แค่ที่ UI เพราะ publishable key
--  อยู่ในเบราว์เซอร์ ใครก็ยิง API ตรงได้
-- =========================================================

begin;

-- =========================================================
--  ส่วนที่ 1: สวิตช์เปิด/ปิดโหวต
-- =========================================================

alter table public.projects
  add column if not exists vote_open boolean not null default false;


-- =========================================================
--  ส่วนที่ 2: ตารางเก็บคะแนนโหวต
-- =========================================================
--  unique (project_name, voter_id) = 1 คน 1 เสียงต่อโปรเจกต์
--  การเปลี่ยนใจทำด้วย upsert ทับแถวเดิม ไม่ได้เพิ่มแถวใหม่

create table if not exists public.popular_votes (
  id           bigserial primary key,
  project_name text not null,
  group_name   text not null,
  voter_id     uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint popular_votes_one_per_project unique (project_name, voter_id)
);

create index if not exists popular_votes_project_idx
  on public.popular_votes (project_name, group_name);

alter table public.popular_votes enable row level security;


-- =========================================================
--  ส่วนที่ 3: ฟังก์ชันช่วยตรวจสิทธิ์
-- =========================================================

-- นิสิตคนที่ล็อกอินอยู่ในโปรเจกต์นี้หรือไม่
create or replace function public.student_in_project(p_project text)
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
       and m ->> 'id' = public.current_student_id()
  );
$$;

-- กลุ่มนี้เป็นกลุ่มของนิสิตคนที่ล็อกอินอยู่หรือไม่
create or replace function public.is_own_group(p_project text, p_group text)
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
  );
$$;

grant execute on function public.student_in_project(text) to authenticated;
grant execute on function public.is_own_group(text, text) to authenticated;


-- =========================================================
--  ส่วนที่ 4: RLS ของ popular_votes
-- =========================================================
--  !! policy insert/update ในส่วนนี้ถูกแทนที่แล้วโดย fix-group-lookup-rls.sql !!
--  ท่อนที่เช็กว่ากลุ่มมีอยู่จริง query ตาราง groups ตรงๆ ซึ่งนิสิตอ่านไม่ได้
--  ทำให้โหวตไม่ผ่าน ต้องรัน fix-group-lookup-rls.sql ต่อท้ายเสมอ

drop policy if exists popular_votes_select on public.popular_votes;
drop policy if exists popular_votes_insert on public.popular_votes;
drop policy if exists popular_votes_update on public.popular_votes;

-- อ่าน: อาจารย์เห็นทุกแถว (ผลสด) นิสิตเห็นแค่เสียงของตัวเอง
create policy popular_votes_select on public.popular_votes
  for select to authenticated
  using (voter_id = auth.uid() or public.is_teacher());

-- โหวต: เฉพาะตอนเปิดโหวต และกลุ่มที่โหวตต้องมีอยู่จริง
create policy popular_votes_insert on public.popular_votes
  for insert to authenticated
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.name = popular_votes.project_name and p.vote_open
    )
    and exists (
      select 1 from public.groups g
       where g.project_name = popular_votes.project_name
         and g.name         = popular_votes.group_name
    )
    and (
      public.is_teacher()
      or (
        public.student_in_project(popular_votes.project_name)
        and not public.is_own_group(popular_votes.project_name, popular_votes.group_name)
      )
    )
  );

-- เปลี่ยนใจ: เงื่อนไขเดียวกับตอนโหวต และแก้ได้เฉพาะแถวของตัวเอง
create policy popular_votes_update on public.popular_votes
  for update to authenticated
  using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (
      select 1 from public.projects p
       where p.name = popular_votes.project_name and p.vote_open
    )
    and exists (
      select 1 from public.groups g
       where g.project_name = popular_votes.project_name
         and g.name         = popular_votes.group_name
    )
    and (
      public.is_teacher()
      or (
        public.student_in_project(popular_votes.project_name)
        and not public.is_own_group(popular_votes.project_name, popular_votes.group_name)
      )
    )
  );

-- ไม่ประกาศ policy delete = ไม่มีใครลบเสียงโหวตผ่าน API ได้


-- =========================================================
--  ส่วนที่ 5: รายชื่อกลุ่มที่โหวตได้
-- =========================================================
--  นิสิตอ่านตาราง groups ตรงๆ ไม่ได้ แต่ต้องเห็นรายชื่อกลุ่มทั้งโปรเจกต์
--  เพื่อเลือกโหวต view นี้คืนแค่ชื่อโปรเจกต์กับชื่อกลุ่ม ไม่มีรายชื่อสมาชิก

drop view if exists public.votable_groups;

create view public.votable_groups
with (security_invoker = off) as
select distinct g.project_name, g.name
from public.groups g
where public.is_teacher()
   or public.student_in_project(g.project_name);

revoke all on public.votable_groups from anon, authenticated;
grant select on public.votable_groups to authenticated;


-- =========================================================
--  ส่วนที่ 6: ผลโหวต
-- =========================================================
--  อาจารย์เห็นตลอดเวลา นิสิตเห็นเฉพาะโปรเจกต์ของตัวเองและต่อเมื่อปิดโหวตแล้ว
--  การนับทำในฐานข้อมูล นิสิตจึงไม่มีทางเห็นว่าใครโหวตให้ใคร

drop view if exists public.popular_vote_results;

create view public.popular_vote_results
with (security_invoker = off) as
select
  v.project_name,
  v.group_name,
  count(*)::int as votes
from public.popular_votes v
join public.projects p on p.name = v.project_name
where public.is_teacher()
   or (p.vote_open = false and public.student_in_project(v.project_name))
group by v.project_name, v.group_name;

revoke all on public.popular_vote_results from anon, authenticated;
grant select on public.popular_vote_results to authenticated;


-- =========================================================
--  ส่วนที่ 7: my_groups ต้องคืน vote_open ด้วย
-- =========================================================
--  สร้างใหม่ทับของเดิมจาก student-auth.sql เพิ่มคอลัมน์ vote_open
--  เพราะนิสิตรู้สถานะโปรเจกต์จาก view นี้ทางเดียว

drop view if exists public.my_groups;

create view public.my_groups
with (security_invoker = off) as
select
  g.id,
  g.project_name,
  g.name,
  p.is_active,
  p.vote_open,
  (select mm ->> 'label'
     from jsonb_array_elements(g.members) mm
    where mm ->> 'id' = public.current_student_id()
    limit 1) as my_label,
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

commit;


-- =========================================================
--  ตรวจผล
-- =========================================================
-- select name, is_active, vote_open from public.projects order by name;
-- select tablename, policyname, cmd, roles from pg_policies
--  where schemaname = 'public' and tablename = 'popular_votes';

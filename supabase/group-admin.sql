-- =========================================================
--  peereval-pro : แก้ไข/ลบกลุ่มจากหน้าอาจารย์
-- =========================================================
--  รันหลัง popular-vote.sql
--
--  ทำไมต้องเป็น RPC ไม่ใช่ update ตรงๆ จากเบราว์เซอร์:
--  ตาราง peer_evals / teacher_evals / popular_votes อ้างกลุ่มด้วย "ข้อความ"
--  (project_name + group_name) ไม่ใช่ foreign key และอ้างตัวนิสิตด้วย label
--  การเปลี่ยนชื่อกลุ่มหรือชื่อสมาชิกจึงต้องตามแก้ทุกตารางพร้อมกัน
--  ถ้าปล่อยให้ client ยิงทีละ update แล้วพังกลางทาง ข้อมูลจะไม่ตรงกัน
--  ฟังก์ชันเดียวจบ = อยู่ใน transaction เดียว สำเร็จหรือล้มเหลวทั้งก้อน
--
--  security definer เพราะต้องแก้ popular_votes ที่ไม่มี policy update/delete
--  ให้ใคร แต่ละฟังก์ชันจึงตรวจ is_teacher() เองที่บรรทัดแรก
-- =========================================================

begin;

-- =========================================================
--  save_group : เปลี่ยนชื่อกลุ่ม + เขียนทับรายชื่อสมาชิก
-- =========================================================
--  p_members = jsonb array ของ { id, name, label, major }

create or replace function public.save_group(
  p_project   text,
  p_group_id  bigint,
  p_new_name  text,
  p_members   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_name    text;
  v_old_members jsonb;
  v_new_name    text := trim(p_new_name);
  r             record;
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะอาจารย์เท่านั้น';
  end if;
  if coalesce(v_new_name, '') = '' then
    raise exception 'ชื่อกลุ่มต้องไม่ว่าง';
  end if;
  if jsonb_typeof(p_members) <> 'array' then
    raise exception 'รูปแบบรายชื่อสมาชิกไม่ถูกต้อง';
  end if;

  select name, members into v_old_name, v_old_members
    from public.groups
   where id = p_group_id and project_name = p_project;

  if v_old_name is null then
    raise exception 'ไม่พบกลุ่มนี้ในโปรเจกต์ %', p_project;
  end if;

  if v_new_name <> v_old_name
     and exists (select 1 from public.groups
                  where project_name = p_project and name = v_new_name) then
    raise exception 'มีกลุ่มชื่อ "%" อยู่แล้วในโปรเจกต์นี้', v_new_name;
  end if;

  -- เปลี่ยนชื่อสมาชิก: จับคู่คนเดิมด้วยรหัสนิสิต แล้วตามแก้ชื่อในคะแนนที่บันทึกไว้แล้ว
  -- (คะแนนอ้างตัวคนด้วย label ถ้าไม่ตามแก้ คะแนนเก่าจะหาเจ้าของไม่เจอ)
  for r in
    select o ->> 'label' as old_label,
           n ->> 'label' as new_label
      from jsonb_array_elements(v_old_members) o
      join jsonb_array_elements(p_members)     n
        on n ->> 'id' = o ->> 'id'
     where coalesce(o ->> 'id', '') <> ''
       and (o ->> 'label') is distinct from (n ->> 'label')
  loop
    update public.peer_evals
       set evaluator = r.new_label
     where project_name = p_project and group_name = v_old_name and evaluator = r.old_label;

    update public.peer_evals
       set target = r.new_label
     where project_name = p_project and group_name = v_old_name and target = r.old_label;
  end loop;

  -- เปลี่ยนชื่อกลุ่ม: ตามแก้ทุกตารางที่อ้างชื่อกลุ่มเป็นข้อความ
  if v_new_name <> v_old_name then
    update public.peer_evals
       set group_name = v_new_name
     where project_name = p_project and group_name = v_old_name;

    update public.teacher_evals
       set group_name = v_new_name
     where project_name = p_project and group_name = v_old_name;

    update public.popular_votes
       set group_name = v_new_name
     where project_name = p_project and group_name = v_old_name;
  end if;

  update public.groups
     set name = v_new_name, members = p_members
   where id = p_group_id;
end;
$$;


-- =========================================================
--  delete_group : ลบกลุ่มพร้อมข้อมูลที่ผูกอยู่
-- =========================================================
--  ลบคะแนนและเสียงโหวตของกลุ่มด้วย ไม่งั้นจะเหลือแถวที่ชี้ไปยังกลุ่มที่ไม่มีอยู่
--  ทำให้ยอดรวมในรายงานเพี้ยน

create or replace function public.delete_group(
  p_project  text,
  p_group_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะอาจารย์เท่านั้น';
  end if;

  select name into v_name
    from public.groups
   where id = p_group_id and project_name = p_project;

  if v_name is null then
    raise exception 'ไม่พบกลุ่มนี้ในโปรเจกต์ %', p_project;
  end if;

  delete from public.peer_evals    where project_name = p_project and group_name = v_name;
  delete from public.teacher_evals where project_name = p_project and group_name = v_name;
  delete from public.popular_votes where project_name = p_project and group_name = v_name;
  delete from public.groups        where id = p_group_id;
end;
$$;


revoke all on function public.save_group(text, bigint, text, jsonb) from public, anon;
revoke all on function public.delete_group(text, bigint)            from public, anon;
grant execute on function public.save_group(text, bigint, text, jsonb) to authenticated;
grant execute on function public.delete_group(text, bigint)            to authenticated;

commit;

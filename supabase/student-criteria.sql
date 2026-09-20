-- =========================================================
--  peereval-pro : เกณฑ์ที่นิสิตใช้ประเมินกันเอง
-- =========================================================
--  รันหลัง group-admin.sql
--
--  เดิมเกณฑ์ฝั่งนิสิตเป็นค่าคงที่ในโค้ด (defaultCriteriaTemplate)
--  3 ข้อ ข้อละ 5 คะแนน รวม 15 แก้ไม่ได้จากหน้าเว็บ
--  ย้ายมาเก็บในตาราง criteria คอลัมน์ student_data แยกจาก data
--  ที่เก็บเกณฑ์ของอาจารย์อยู่แล้ว จะได้ตั้งต่างกันในแต่ละโปรเจกต์
--
--  โปรเจกต์ที่ student_data เป็น null แอปจะใช้ค่าเริ่มต้นในโค้ดแทน
--  จึงไม่ต้อง migrate ข้อมูลเก่า
-- =========================================================

begin;

alter table public.criteria
  add column if not exists student_data jsonb;


-- =========================================================
--  save_student_criteria
-- =========================================================
--  ใช้ RPC แทน upsert จาก client เพราะแถวของโปรเจกต์อาจยังไม่มี
--  (โปรเจกต์ที่ไม่เคยแก้เกณฑ์อาจารย์เลยจะไม่มีแถวใน criteria)
--  ถ้า upsert ตรงๆ จะเสี่ยงเขียนทับคอลัมน์ data ของอาจารย์เป็นค่าว่าง

create or replace function public.save_student_criteria(
  p_project text,
  p_data    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_teacher() then
    raise exception 'เฉพาะอาจารย์เท่านั้น';
  end if;
  if jsonb_typeof(p_data) <> 'array' then
    raise exception 'รูปแบบเกณฑ์ไม่ถูกต้อง';
  end if;
  if jsonb_array_length(p_data) = 0 then
    raise exception 'ต้องมีเกณฑ์อย่างน้อย 1 ข้อ';
  end if;

  if exists (select 1 from public.criteria where project_name = p_project) then
    update public.criteria set student_data = p_data where project_name = p_project;
  else
    insert into public.criteria (project_name, data, student_data)
    values (p_project, '[]'::jsonb, p_data);
  end if;
end;
$$;

revoke all on function public.save_student_criteria(text, jsonb) from public, anon;
grant execute on function public.save_student_criteria(text, jsonb) to authenticated;

commit;


-- =========================================================
--  หมายเหตุ
-- =========================================================
--  แอปคิดคะแนนถ่วงน้ำหนักจากคะแนนเต็มของ "เกณฑ์ปัจจุบัน" เสมอ
--  แก้เกณฑ์หลังนิสิตเริ่มประเมินแล้ว คะแนนที่ส่งไปก่อนหน้าจะถูกคิดใหม่
--  ด้วยคะแนนเต็มใหม่ ถ้าไม่ต้องการแบบนั้นให้ลบคะแนนเดิมแล้วให้ประเมินใหม่:
--
-- delete from public.peer_evals where project_name = 'ชื่อโปรเจกต์';
--
--  ตรวจว่ามีโปรเจกต์ไหนตั้งเกณฑ์นิสิตเองแล้วบ้าง:
-- select project_name,
--        jsonb_array_length(coalesce(student_data, '[]'::jsonb)) as student_criteria_count
--   from public.criteria order by project_name;

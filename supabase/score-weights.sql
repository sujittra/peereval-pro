-- =========================================================
--  peereval-pro : สัดส่วนคะแนนรายโปรเจกต์
-- =========================================================
--  รันหลัง student-criteria.sql
--
--  เดิมน้ำหนักคะแนนเป็นค่าคงที่ในโค้ด: อาจารย์ 14% + เพื่อน 6% = 20%
--  ย้ายมาเก็บรายโปรเจกต์ จะได้ตั้งต่างกันในแต่ละวิชา/แต่ละรอบ
--
--  ค่า default ตรงกับของเดิม โปรเจกต์ที่มีอยู่แล้วจึงได้ 14/6 อัตโนมัติ
--  ไม่ต้อง migrate และคะแนนที่คำนวณไว้ไม่เปลี่ยน
--
--  ไม่ต้องแก้ policy: อาจารย์เขียน projects ได้อยู่แล้วผ่าน
--  projects_write_teacher ส่วนนิสิตไม่ต้องรู้ค่าพวกนี้เพราะไม่เห็นคะแนน
-- =========================================================

begin;

alter table public.projects
  add column if not exists teacher_weight numeric(5,2) not null default 14,
  add column if not exists peer_weight    numeric(5,2) not null default 6;

-- กันค่าติดลบ ส่วนเพดานรวมปล่อยให้อาจารย์ตัดสินใจเอง
-- (บางวิชาอาจอยากให้รวมเป็น 100 แทน 20)
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'projects_weights_non_negative'
       and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_weights_non_negative
      check (teacher_weight >= 0 and peer_weight >= 0);
  end if;
end $$;

commit;


-- ตรวจผล
-- select name, teacher_weight, peer_weight, teacher_weight + peer_weight as total
--   from public.projects order by name;

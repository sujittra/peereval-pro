-- =========================================================
--  peereval-pro : unique constraint สำหรับตาราง groups
-- =========================================================
--  ทำให้ upsert ใน ImportModal ทำงานได้ (onConflict: 'project_name,name')
--  นำเข้าชื่อกลุ่มเดิมซ้ำจะกลายเป็น "ทับของเดิม" แทนการสร้างกลุ่มซ้ำ
--
--  !! อย่ารันรวดเดียว ให้ทำทีละขั้นตามลำดับด้านล่าง !!
--
--  ขั้นที่ 1 = ตรวจอย่างเดียว / ขั้นที่ 3 = ของจริง ต้องรัน
--  ขั้นที่ 2 รันเฉพาะเมื่อขั้นที่ 1 มีแถวออกมา
--  ถ้าไม่รันขั้นที่ 3 การนำเข้ารายชื่อจะขึ้น error ว่า
--  "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- =========================================================


-- ---------------------------------------------------------
--  ขั้นที่ 1: เช็คว่ามีกลุ่มซ้ำค้างอยู่ก่อนไหม  (ต้องรันก่อนเสมอ)
-- ---------------------------------------------------------
--  ถ้าได้ 0 แถว ข้ามไปขั้นที่ 3 ได้เลย
--  ถ้ามีแถวออกมา ต้องจัดการให้เหลือกลุ่มละ 1 แถวก่อน ไม่งั้นขั้นที่ 3 จะ error

select project_name, name, count(*) as จำนวนแถวซ้ำ
from public.groups
group by project_name, name
having count(*) > 1
order by project_name, name;


-- ---------------------------------------------------------
--  ขั้นที่ 2: ลบแถวซ้ำ  (ข้ามถ้าขั้นที่ 1 ได้ 0 แถว)
-- ---------------------------------------------------------
--  !! เป็นการลบข้อมูลถาวร ตรวจผลขั้นที่ 1 ให้แน่ใจก่อน !!
--  เก็บแถวที่เข้ามาทีหลังสุดของแต่ละ (project_name, name) ไว้ 1 แถว
--  ใช้ ctid เทียบเพราะไม่ต้องรู้ว่าคอลัมน์ id เป็น type อะไร
--
--  ดูก่อนว่าจะลบแถวไหนบ้าง — เปลี่ยน delete เป็น select ตรวจก่อนได้:
--
--    select * from public.groups g
--    where exists (select 1 from public.groups g2
--                  where g2.project_name = g.project_name
--                    and g2.name = g.name and g2.ctid > g.ctid);

-- delete from public.groups g
-- where exists (
--   select 1 from public.groups g2
--   where g2.project_name = g.project_name
--     and g2.name         = g.name
--     and g2.ctid         > g.ctid
-- );


-- ---------------------------------------------------------
--  ขั้นที่ 3: เพิ่ม unique constraint
-- ---------------------------------------------------------
--  ห่อด้วย DO block เพื่อให้รันซ้ำได้โดยไม่ error
--  (alter table ... add constraint ไม่มี if not exists)

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'groups_project_name_unique'
      and conrelid = 'public.groups'::regclass
  ) then
    alter table public.groups
      add constraint groups_project_name_unique unique (project_name, name);
  end if;
end $$;

-- ตรวจผล ต้องได้ 1 แถว
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.groups'::regclass
  and contype = 'u';


-- =========================================================
--  ขั้นที่ 4 (ไม่บังคับ): หานิสิตที่ไม่มีรหัสในข้อมูลเดิม
-- =========================================================
--  หลังแก้โค้ดแล้ว คนที่ไม่มีรหัสนิสิตจะล็อกอินไม่ได้ (fail closed)
--  query นี้ช่วยหาว่ามีใครบ้าง จะได้นำเข้ารายชื่อกลุ่มนั้นใหม่
--  ถ้าคอลัมน์ members เป็น type json (ไม่ใช่ jsonb)
--  ให้เปลี่ยน jsonb_array_elements เป็น json_array_elements

select g.project_name, g.name as group_name, m->>'name' as member_name
from public.groups g,
     lateral jsonb_array_elements(g.members) m
where coalesce(m->>'id', '') = ''
order by g.project_name, g.name;

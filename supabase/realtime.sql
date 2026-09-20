-- =========================================================
--  peereval-pro : เปิด Realtime ให้หน้า dashboard อาจารย์
-- =========================================================
--  รันหลัง popular-vote.sql
--
--  ทำให้หน้าอาจารย์อัปเดตเองเมื่อนิสิตส่งคะแนนหรือโหวต โดยไม่ต้อง refresh
--
--  Realtime เคารพ RLS: แอปส่ง event ให้เฉพาะแถวที่ผู้ฟังมีสิทธิ์อ่าน
--  อาจารย์อ่าน peer_evals/popular_votes ได้ทุกแถวจึงได้รับ event ครบ
--  ส่วนนิสิตอ่านได้เฉพาะของตัวเอง จะไม่ได้รับ event ของคนอื่น
-- =========================================================

-- เพิ่มตารางเข้า publication ของ Realtime
-- ห่อด้วย DO block เพราะ add table ซ้ำจะ error (ไม่มี if not exists)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'peer_evals'
  ) then
    alter publication supabase_realtime add table public.peer_evals;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'popular_votes'
  ) then
    alter publication supabase_realtime add table public.popular_votes;
  end if;
end $$;

-- REPLICA IDENTITY FULL ทำให้ event ของ update/delete ส่งค่าคอลัมน์เดิมมาด้วย
-- จำเป็นต่อการที่ Realtime จะตรวจ RLS กับแถวก่อนแก้ไขได้ถูกต้อง
-- (popular_votes มี update ตอนนิสิตเปลี่ยนใจ)
alter table public.popular_votes replica identity full;

-- ตรวจผล ต้องได้ 2 แถว
select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
 order by tablename;

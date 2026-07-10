-- ============================================
-- 정엘미디어 Supabase 데이터베이스 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- ============================================

-- 1) 채널 테이블
create table if not exists channels (
  slug text primary key,
  name text not null,
  emoji text default '📰',
  sort int default 0
);

insert into channels (slug, name, emoji, sort) values
  ('architect', '아키텍트리포트', '🏛️', 1),
  ('taxbrief',  '세법브리핑',     '🧾', 2),
  ('taxsaving', '절세전략',       '💰', 3),
  ('caselaw',   '판례·예규',      '⚖️', 4),
  ('century',   '100년기업스토리','🏭', 5),
  ('column',    '정엘칼럼',       '🖋️', 6),
  ('tv',        '정엘TV',         '📺', 7)
on conflict (slug) do nothing;

-- 2) 기사 테이블
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lede text default '',                 -- 요약(부제)
  content text default '',              -- 본문 (HTML)
  channel_slug text references channels(slug),
  author text default '정엘 편집국',
  thumbnail_url text default '',
  youtube_id text default '',           -- 유튜브 영상 ID (있으면 정엘TV 갤러리 노출)
  is_featured boolean default false,    -- 메인 히어로 노출
  published boolean default false,
  views int default 0,
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_articles_pub on articles (published, published_at desc);
create index if not exists idx_articles_ch on articles (channel_slug);

-- 3) 조회수 증가 함수
create or replace function increment_views(article_id uuid)
returns void language sql security definer as $$
  update articles set views = views + 1 where id = article_id;
$$;

-- 4) RLS (행 수준 보안)
alter table channels enable row level security;
alter table articles enable row level security;

-- 누구나 채널 조회 가능
create policy "channels_public_read" on channels for select using (true);

-- 발행된 기사만 공개 조회
create policy "articles_public_read" on articles
  for select using (published = true);

-- 로그인한 관리자는 모든 기사 조회/작성/수정/삭제 가능
create policy "articles_admin_all" on articles
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5) 이미지 스토리지 버킷
insert into storage.buckets (id, name, public)
  values ('article-images', 'article-images', true)
on conflict (id) do nothing;

create policy "img_public_read" on storage.objects
  for select using (bucket_id = 'article-images');
create policy "img_admin_write" on storage.objects
  for insert with check (bucket_id = 'article-images' and auth.role() = 'authenticated');
create policy "img_admin_update" on storage.objects
  for update using (bucket_id = 'article-images' and auth.role() = 'authenticated');
create policy "img_admin_delete" on storage.objects
  for delete using (bucket_id = 'article-images' and auth.role() = 'authenticated');

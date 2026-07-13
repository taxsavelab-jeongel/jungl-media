-- ============================================
-- 가업승계저널 Supabase 데이터베이스 스키마
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

-- ============================================
-- 6) 회원 시스템 (profiles / resources) — 2026-07 추가
-- 주의: 회원가입 도입으로 인해 auth.role() = 'authenticated' 는
-- 더 이상 "관리자"를 의미하지 않는다 (일반 회원도 로그인하면 authenticated).
-- 따라서 관리자 판별은 아래 is_admin() 함수(관리자 이메일 확인)로 통일한다.
-- ============================================

create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'taxsavelab@gmail.com'
  );
$$;

-- articles_admin_all 정책은 위 4)에서 auth.role()='authenticated' 로 생성되었으나,
-- 아래로 교체되어야 함 (본 스키마 파일 4)번 정책도 신규 설치 시 아래 버전을 사용할 것):
--   drop policy if exists "articles_admin_all" on articles;
--   create policy "articles_admin_all" on articles
--     for all using (is_admin()) with check (is_admin());

-- 6-1) 회원 프로필 (auth.users 와 1:1)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  company text,
  interest text,
  profile_completed boolean default false,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_self_select" on profiles
  for select using (auth.uid() = id);
create policy "profiles_self_insert" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_self_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 신규 가입 시 자동으로 profiles row 생성
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 6-2) 회원 전용 자료실
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  file_url text not null,
  thumbnail_url text default '',
  published boolean default true,
  created_at timestamptz default now()
);

alter table resources enable row level security;

-- 조회: 로그인한 회원 전체 / 쓰기: 관리자만
create policy "resources_authenticated_read" on resources
  for select using (auth.role() = 'authenticated' and published = true);
create policy "resources_admin_write" on resources
  for all using (is_admin()) with check (is_admin());

-- article-images 스토리지 쓰기 정책도 관리자 전용으로 교체 (신규 설치 시):
--   drop policy if exists "img_admin_write" on storage.objects;
--   create policy "img_admin_write" on storage.objects
--     for insert with check (bucket_id = 'article-images' and is_admin());
--   drop policy if exists "img_admin_update" on storage.objects;
--   create policy "img_admin_update" on storage.objects
--     for update using (bucket_id = 'article-images' and is_admin());
--   drop policy if exists "img_admin_delete" on storage.objects;
--   create policy "img_admin_delete" on storage.objects
--     for delete using (bucket_id = 'article-images' and is_admin());

-- ============================================
-- 7) 기자단 시스템 (역할 + 기사 승인 워크플로우) — 2026-07 추가
-- ============================================
-- profiles 추가 컬럼: role('member'|'reporter'|'editor'), reporter_status('pending'|'approved'|'rejected'),
--   reporter_pen_name, reporter_bio, reporter_applied_at, reporter_reject_reason
-- profiles 추가 컬럼(2026-07-12, 전문가 필진): reporter_type('reporter'|'expert'),
--   reporter_title(직함: 세무사·회계사 등), reporter_org(소속: 정엘가업승계연구소 등)
--   전문가 기사 서명: "이름 직함 (소속)" 형태로 articles.author 에 저장 (write.html)
-- articles 추가 컬럼: status('writing'|'review'|'published'|'rejected'), author_id(uuid→auth.users),
--   reject_reason, submitted_at

-- 승인된 기자 판별
create or replace function is_approved_reporter()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'reporter' and reporter_status = 'approved');
$$;

-- articles 기자 정책 (public_read=published, admin_all=is_admin() 유지에 추가)
--   기자: 본인 소유 조회 / 미발행 초안 작성(writing,review) / 본인 초안 수정(반려 포함, published=true 불가) / 본인 미발행 초안 삭제
create policy "articles_reporter_select_own" on articles for select using (author_id = auth.uid());
create policy "articles_reporter_insert" on articles for insert with check (
  is_approved_reporter() and author_id = auth.uid() and published = false and status in ('writing','review'));
create policy "articles_reporter_update_own" on articles for update
  using (author_id = auth.uid() and status in ('writing','review','rejected'))
  with check (author_id = auth.uid() and published = false and status in ('writing','review'));
create policy "articles_reporter_delete_own" on articles for delete
  using (author_id = auth.uid() and status in ('writing','review','rejected') and published = false);

-- 스토리지: 관리자 OR 승인기자 업로드 허용
create policy "img_writer_write" on storage.objects for insert
  with check (bucket_id = 'article-images' and (is_admin() or is_approved_reporter()));

-- Edge Function: generate-article (AI 기사 초안 생성, ANTHROPIC_API_KEY 시크릿 필요)
--   승인 기자/관리자만 호출, 주제→기사작성표준 프롬프트로 title/lede/content(HTML) 반환.

-- ============================================
-- 8) 경제지표 (홈 우측 '오늘의 지표' 박스) — 2026-07 추가
-- ============================================
create table if not exists market_indicators (
  key text primary key, label text not null,
  value text default '', delta text default '', sort int default 0,
  updated_at timestamptz default now()
);
insert into market_indicators (key,label,value,delta,sort) values
  ('kospi','코스피','','',1),('kosdaq','코스닥','','',2),('base_rate','기준금리','','',3)
on conflict (key) do nothing;
alter table market_indicators enable row level security;
create policy "mi_public_read" on market_indicators for select using (true);
create policy "mi_admin_write" on market_indicators for all using (is_admin()) with check (is_admin());
-- 환율(원/달러·원/엔·원/유로)은 프런트에서 frankfurter.app 무료 API로 실시간 표시(관리 불필요).

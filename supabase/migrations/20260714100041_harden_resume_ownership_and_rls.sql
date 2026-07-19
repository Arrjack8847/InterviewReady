begin;

update public.resumes
set analysis_status = 'failed'
where analysis_status not in ('pending', 'processing', 'completed', 'failed');

alter table public.resumes
  drop constraint if exists resumes_analysis_status_check;

alter table public.resumes
  add constraint resumes_analysis_status_check
  check (analysis_status in ('pending', 'processing', 'completed', 'failed'));

drop index if exists public.answers_session_id_question_id_idx;
drop index if exists public.speech_metrics_session_id_created_at_idx;
drop index if exists public.visual_metrics_session_id_created_at_idx;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update
  set
    name = excluded.name,
    email = excluded.email,
    updated_at = pg_catalog.now();

  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter policy "Users can read own profile"
on public.profiles to authenticated
using (id = (select auth.uid()));

alter policy "Users can insert own profile"
on public.profiles to authenticated
with check (id = (select auth.uid()));

alter policy "Users can update own profile"
on public.profiles to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy "Users can read own resumes"
on public.resumes to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can insert own resumes"
on public.resumes to authenticated
with check (user_id = (select auth.uid()));

alter policy "Users can update own resumes"
on public.resumes to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy "Users can delete own resumes"
on public.resumes to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can read own interview sessions"
on public.interview_sessions to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can insert own interview sessions"
on public.interview_sessions to authenticated
with check (
  user_id = (select auth.uid())
  and (
    resume_id is null
    or exists (
      select 1
      from public.resumes resume
      where resume.id = interview_sessions.resume_id
        and resume.user_id = (select auth.uid())
    )
  )
);

alter policy "Users can update own interview sessions"
on public.interview_sessions to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    resume_id is null
    or exists (
      select 1
      from public.resumes resume
      where resume.id = interview_sessions.resume_id
        and resume.user_id = (select auth.uid())
    )
  )
);

alter policy "Users can delete own interview sessions"
on public.interview_sessions to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can read own answers"
on public.answers to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can insert own answers"
on public.answers to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = answers.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can update own answers"
on public.answers to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = answers.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can delete own answers"
on public.answers to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can read own speech metrics"
on public.speech_metrics to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can insert own speech metrics"
on public.speech_metrics to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = speech_metrics.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can update own speech metrics"
on public.speech_metrics to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = speech_metrics.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can delete own speech metrics"
on public.speech_metrics to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can read own visual metrics"
on public.visual_metrics to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can insert own visual metrics"
on public.visual_metrics to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = visual_metrics.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can update own visual metrics"
on public.visual_metrics to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.interview_sessions session
    where session.id = visual_metrics.session_id
      and session.user_id = (select auth.uid())
  )
);

alter policy "Users can delete own visual metrics"
on public.visual_metrics to authenticated
using (user_id = (select auth.uid()));

alter policy "Users can read own resume files"
on storage.objects to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = 'resumes'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

alter policy "Users can upload own resume files"
on storage.objects to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = 'resumes'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

alter policy "Users can update own resume files"
on storage.objects to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = 'resumes'
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = 'resumes'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

alter policy "Users can delete own resume files"
on storage.objects to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = 'resumes'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.resumes,
  public.interview_sessions,
  public.answers,
  public.speech_metrics,
  public.visual_metrics
to authenticated;

commit;

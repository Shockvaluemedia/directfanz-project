import Link from 'next/link';
import { CommunityHome } from '@/components/stage/community-home';
import { FormatStrip } from '@/components/stage/format-strip';
import { Eyebrow, primaryButton, secondaryButton } from '@/components/stage/primitives';

export const dynamic = 'force-dynamic';

// "/" opens on the community home. Until a community is set up, it shows a
// short stage landing with the same positioning instead of a 404.
export default async function Home() {
  const home = await CommunityHome();
  if (home) return home;

  return (
    <div className='stage min-h-screen'>
      <section className='stage-spotlight border-b border-stage-line'>
        <div className='mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32'>
          <Eyebrow>DirectFanz</Eyebrow>
          <h1 className='stage-display mt-5 max-w-4xl text-[clamp(3.25rem,9vw,7.5rem)] text-stage-text'>
            Music and film, released here first.
          </h1>
          <p className='mt-6 max-w-xl text-lg leading-relaxed text-stage-muted'>
            Singles, projects, shorts, documentaries and films go straight from the artist to you,
            before they reach any streaming service.
          </p>
          <div className='mt-10 flex flex-col gap-3 sm:flex-row'>
            <Link
              href='/auth/signup?role=fan'
              className={`${primaryButton} min-h-12 px-6 text-base`}
            >
              Join as a fan
            </Link>
            <Link href='/auth/signin' className={`${secondaryButton} min-h-12 px-6 text-base`}>
              Sign in
            </Link>
          </div>
        </div>
      </section>
      <FormatStrip />
    </div>
  );
}

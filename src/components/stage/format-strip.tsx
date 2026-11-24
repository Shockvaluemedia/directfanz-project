import { Clapperboard, Disc3, Film, Music2, Video } from 'lucide-react';
import { Eyebrow } from './primitives';

const GROUPS = [
  {
    label: 'Music',
    formats: [
      { icon: Music2, name: 'Singles' },
      { icon: Disc3, name: 'Projects' },
    ],
  },
  {
    label: 'Video',
    formats: [
      { icon: Video, name: 'Shorts' },
      { icon: Clapperboard, name: 'Documentaries' },
      { icon: Film, name: 'Films' },
    ],
  },
];

/** What releases here: the formats the stage is built for. */
export function FormatStrip({ className = '' }: { className?: string }) {
  return (
    <section className={`border-b border-stage-line ${className}`}>
      <div className='mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_2fr] lg:items-center lg:px-8'>
        <div>
          <Eyebrow>Released here first</Eyebrow>
          <p className='mt-2 text-2xl font-bold tracking-tight text-stage-text'>
            Music and film, straight from the artist.
          </p>
        </div>
        <div className='flex flex-wrap gap-x-10 gap-y-5'>
          {GROUPS.map(group => (
            <div key={group.label}>
              <p className='font-mono text-[11px] uppercase tracking-[0.18em] text-stage-subtle'>
                {group.label}
              </p>
              <ul className='mt-2 flex flex-wrap gap-2'>
                {group.formats.map(({ icon: Icon, name }) => (
                  <li
                    key={name}
                    className='inline-flex items-center gap-2 rounded-control border border-stage-line bg-stage-surface px-3 py-2 text-sm text-stage-text'
                  >
                    <Icon aria-hidden className='h-4 w-4 text-stage-pulse' />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

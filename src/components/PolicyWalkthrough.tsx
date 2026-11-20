import { useRef, useState } from 'react';
import transcript from '../content/policyWalkthrough.json';
import { Card, CardBody, CardHeader } from './ui/core';
import { cn } from '../lib/utils';
import { activeEntry, mmss, type TranscriptEntry } from '../lib/walkthrough';

const ENTRIES: readonly TranscriptEntry[] = transcript.entries;
const MEDIA = `${import.meta.env.BASE_URL}media/policy-walkthrough`;

/**
 * Captioned walkthrough video for policy makers, with a timed transcript that seeks the video.
 * The video is not downloaded until the viewer presses play (preload="none").
 */
export function PolicyWalkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(-1);
  const active = activeEntry(ENTRIES, now);
  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t;
    setNow(t);
    void v.play().catch(() => undefined);
  };
  return (
    <Card className="no-print mb-6">
      <CardHeader
        title="Walkthrough for policy makers"
        subtitle="Three captioned minutes: from an assumption about automation to the financing gap, the rate each instrument needs, and its economic cost."
      />
      <CardBody className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <video
            ref={video}
            controls
            playsInline
            preload="none"
            poster={`${MEDIA}.jpg`}
            className="aspect-video w-full rounded-lg bg-slate-900"
            aria-label="Walkthrough for policy makers (captions are part of the video; transcript alongside)"
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            data-testid="walkthrough-video"
          >
            <source src={`${MEDIA}.mp4`} type="video/mp4" />
            Your browser cannot play this video. <a href={`${MEDIA}.mp4`}>Download the MP4</a>.
          </video>
          <p className="mt-2 text-xs text-slate-500">
            Recorded from this app with the Cyprus 2026 defaults; the numbers in the captions were read from
            the screen during recording. If the data or model change, the live tool is authoritative. Model
            simulations under stated assumptions, not forecasts.
          </p>
        </div>
        <section aria-labelledby="walkthrough-transcript" className="min-w-0">
          <h3 id="walkthrough-transcript" className="mb-2 text-sm font-semibold">
            Transcript
          </h3>
          <ol
            className="max-h-96 space-y-1 overflow-y-auto pr-1 text-sm"
            data-testid="walkthrough-transcript"
          >
            {ENTRIES.map((e, i) => (
              <li
                key={e.t}
                aria-current={i === active ? 'true' : undefined}
                className={cn('rounded-md px-2 py-1', i === active && 'bg-teal-50 dark:bg-teal-950/50')}
              >
                <button
                  type="button"
                  onClick={() => seek(e.t)}
                  className="tabular mr-2 text-xs font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400"
                  aria-label={`Play from ${mmss(e.t)}`}
                >
                  {mmss(e.t)}
                </button>
                {e.step && <span className="font-semibold">{e.step}: </span>}
                {e.text}
              </li>
            ))}
          </ol>
        </section>
      </CardBody>
    </Card>
  );
}

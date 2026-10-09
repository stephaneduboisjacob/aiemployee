'use client';

import Image from 'next/image';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-page">
      <div className="system-card">
        <Image src="/product/errors/workflow-retry.webp" alt="" width={360} height={240} priority />
        <span className="system-eyebrow">WORKSPACE RECOVERY</span>
        <h1>Let’s restore this view.</h1>
        <p>Your work is saved in the workspace. Reload this view to reconnect.</p>
        <button className="system-action" onClick={() => reset()}>Retry connection <span aria-hidden="true">↻</span></button>
      </div>
    </main>
  );
}

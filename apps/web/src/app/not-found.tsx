import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="system-page">
      <div className="system-card">
        <Image src="/product/errors/not-found.webp" alt="" width={360} height={240} priority />
        <span className="system-eyebrow">404 · ROUTE NOT FOUND</span>
        <h1>This page isn’t on the route.</h1>
        <p>The workspace is still here. Return to the operations overview and keep work moving.</p>
        <Link className="system-action" href="/">Return to overview <span aria-hidden="true">→</span></Link>
      </div>
    </main>
  );
}

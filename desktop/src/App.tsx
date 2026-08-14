import { useEffect, useState } from 'react';
import { HomePage } from '@/components/home-page';
import { ReviewQueue } from '@/components/review-queue';
import { CardView } from '@/components/card-view';
import { ModuleNav } from '@/components/module-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { GithubLink } from '@/components/github-link';
import { SettingsPage } from '@/components/settings-page';

// 极简 hash 路由：#/ / #/:category / #/:category/quiz / #/:category/browse
function parseHash(): string[] {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  return path.split('/').filter(Boolean);
}

export default function App() {
  const [parts, setParts] = useState<string[]>(parseHash());

  useEffect(() => {
    const onChange = () => setParts(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // 滚动到顶部（切页时）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [parts.join('/')]);

  let page;
  if (parts.length === 0) {
    page = <HomePage />;
  } else if (parts[0] === 'settings') {
    page = <SettingsPage />;
  } else if (parts.length === 1) {
    page = <ReviewQueue category={parts[0]} />;
  } else if (parts[1] === 'quiz') {
    page = <CardView category={parts[0]} />;
  } else if (parts[1] === 'browse') {
    page = <ModuleNav category={parts[0]} />;
  } else {
    page = <ReviewQueue category={parts[0]} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <GithubLink />
        <ModeToggle />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-6">{page}</div>
    </div>
  );
}

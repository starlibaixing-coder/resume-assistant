import { useState, useEffect } from 'react';
import { HomePage } from '@/components/home-page';
import { ReviewQueue } from '@/components/review-queue';
import { CardView } from '@/components/card-view';
import { ModuleNav } from '@/components/module-nav';
import { AppShell } from '@/components/app-shell';
import { SettingsPage } from '@/components/settings-page';
import { GeneratePage } from '@/components/generate-page';
import { DraftsPage } from '@/components/drafts-page';

// 极简 hash 路由：#/ / #/:category / #/:category/quiz / #/:category/browse / #/generate|drafts|settings
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

  let page;
  if (parts.length === 0) {
    page = <HomePage />;
  } else if (parts[0] === 'settings') {
    page = <SettingsPage />;
  } else if (parts[0] === 'generate') {
    page = <GeneratePage />;
  } else if (parts[0] === 'drafts') {
    page = <DraftsPage />;
  } else if (parts.length === 1) {
    page = <ReviewQueue category={parts[0]} />;
  } else if (parts[1] === 'quiz') {
    page = <CardView category={parts[0]} />;
  } else if (parts[1] === 'browse') {
    page = <ModuleNav category={parts[0]} />;
  } else {
    page = <ReviewQueue category={parts[0]} />;
  }

  return <AppShell>{page}</AppShell>;
}

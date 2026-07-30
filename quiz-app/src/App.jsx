import { useEffect, useState } from 'react';
import CategoryList from './components/CategoryList.jsx';
import ReviewQueue from './components/ReviewQueue.jsx';
import CardView from './components/CardView.jsx';
import ModuleNav from './components/ModuleNav.jsx';

// 极简 hash 路由：#/ / #/:category / #/:category/quiz / #/:category/browse
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return parts;
}

export default function App() {
  const [parts, setParts] = useState(parseHash());

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
    page = <CategoryList />;
  } else if (parts.length === 1) {
    page = <ReviewQueue category={parts[0]} />;
  } else if (parts[1] === 'quiz') {
    page = <CardView category={parts[0]} />;
  } else if (parts[1] === 'browse') {
    page = <ModuleNav category={parts[0]} />;
  } else {
    page = <ReviewQueue category={parts[0]} />;
  }

  return <div className="app">{page}</div>;
}

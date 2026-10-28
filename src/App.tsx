import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Placeholder from './features/Placeholder';
import BizRoot from './features/biz/BizRoot';
import BookPage from './features/book/BookPage';
import HomePage from './features/home/HomePage';
import MyPage from './features/me/MyPage';
import SearchPage from './features/search/SearchPage';
import AboutPage from './features/legal/AboutPage';
import AccessibilityPage from './features/legal/AccessibilityPage';
import ContactPage from './features/legal/ContactPage';
import PrivacyPage from './features/legal/PrivacyPage';
import TermsPage from './features/legal/TermsPage';

// אתר הלקוחות (בית, חיפוש, דף עסק), צד העסק, ואדמין (אבן דרך 7).
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/b/:slug" element={<BookPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/biz/*" element={<BizRoot />} />
        <Route path="/admin/*" element={<Placeholder title="אדמין" note="אבן דרך 7" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// מעבר בין דפים מתחיל מראש הדף (ולא נשאר בגלילה של הדף הקודם, למשל בקישורי התחתית)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

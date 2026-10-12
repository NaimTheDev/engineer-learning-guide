import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import CurriculumPage from '@/pages/CurriculumPage';
import Dashboard from '@/pages/Dashboard';
import LessonPage from '@/pages/LessonPage';
import ReadinessPage from '@/pages/ReadinessPage';
import SettingsPage from '@/pages/SettingsPage';
import { ProgressProvider } from '@/state/ProgressContext';
import { ThemeProvider } from '@/state/ThemeContext';

export function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/curriculum" element={<CurriculumPage />} />
        <Route path="/lesson/:slug" element={<LessonPage />} />
        <Route path="/lesson/:slug/:step" element={<LessonPage />} />
        <Route path="/readiness" element={<ReadinessPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

/**
 * HashRouter keeps every route under `#/…`, so GitHub Pages (static hosting
 * with no rewrite rules) serves index.html for any deep link or refresh.
 */
export default function App() {
  return (
    <ThemeProvider>
      <ProgressProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </ProgressProvider>
    </ThemeProvider>
  );
}

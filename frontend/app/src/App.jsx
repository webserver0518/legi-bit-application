import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import RequireAuth from './components/RequireAuth';
import AdminPage from './pages/AdminPage';
import CasesPage from './pages/CasesPage';
import ClientsPage from './pages/ClientsPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicHomePage from './pages/PublicHomePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<PublicHomePage />} />
        <Route path="login" element={<LoginPage />} />
      </Route>

      <Route
        path="/app"
        element={<RequireAuth />}
      >
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="admin/*" element={<AdminPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

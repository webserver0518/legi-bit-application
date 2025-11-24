import { Route, Routes } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import RequireAuth from './components/RequireAuth';
import AdminPage from './pages/AdminPage';
import CasesPage from './pages/CasesPage';
import ClientsPage from './pages/ClientsPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import FilesListPage from './pages/files/FilesListPage';
import FileUploadPage from './pages/files/FileUploadPage';
import FilePreviewPage from './pages/files/FilePreviewPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PublicHomePage from './pages/PublicHomePage';
import CasesListPage from './pages/cases/CasesListPage';
import CaseDetailsPage from './pages/cases/CaseDetailsPage';
import CaseCreatePage from './pages/cases/CaseCreatePage';
import CaseEditPage from './pages/cases/CaseEditPage';
import ClientsListPage from './pages/clients/ClientsListPage';
import ClientDetailsPage from './pages/clients/ClientDetailsPage';
import ClientCreatePage from './pages/clients/ClientCreatePage';
import ClientEditPage from './pages/clients/ClientEditPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import OfficeSettingsPage from './pages/admin/OfficeSettingsPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<PublicHomePage />} />
        <Route path="login" element={<LoginPage />} />
      </Route>

      <Route path="/app" element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="cases" element={<CasesPage />}>
            <Route index element={<CasesListPage />} />
            <Route path="new" element={<CaseCreatePage />} />
            <Route path=":caseSerial" element={<CaseDetailsPage />} />
            <Route path=":caseSerial/edit" element={<CaseEditPage />} />
          </Route>
          <Route path="clients" element={<ClientsPage />}>
            <Route index element={<ClientsListPage />} />
            <Route path="new" element={<ClientCreatePage />} />
            <Route path=":clientSerial" element={<ClientDetailsPage />} />
            <Route path=":clientSerial/edit" element={<ClientEditPage />} />
          </Route>
          <Route path="files" element={<FilesPage />}>
            <Route index element={<FilesListPage />} />
            <Route path="upload" element={<FileUploadPage />} />
            <Route path="preview/:fileSerial" element={<FilePreviewPage />} />
          </Route>
          <Route path="admin" element={<AdminPage />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="office" element={<OfficeSettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

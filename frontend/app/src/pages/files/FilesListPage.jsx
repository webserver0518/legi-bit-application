import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import filesApi from '../../api/filesApi';

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('he-IL');
  } catch (e) {
    return value;
  }
}

function FilesListPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [caseFilter, setCaseFilter] = useState('');

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await filesApi.getOfficeFiles();
        setFiles(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err.message || 'טעינת הקבצים נכשלה');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter((file) => {
      if (caseFilter && `${file.case_serial}` !== `${caseFilter}`) return false;
      if (!term) return true;
      return [file.name, file.description, file.status, file.content_type, file.serial]
        .filter(Boolean)
        .map((v) => `${v}`.toLowerCase())
        .some((v) => v.includes(term));
    });
  }, [caseFilter, files, search]);

  const download = async (file) => {
    try {
      const res = await filesApi.getFileUrl({
        caseSerial: file.case_serial,
        fileSerial: file.serial,
        fileName: file.name,
      });
      const url = res.data;
      if (url) {
        window.open(url, '_blank', 'noreferrer');
      }
    } catch (err) {
      setError(err.message || 'שליפת הקובץ נכשלה');
    }
  };

  const deleteFile = async (file) => {
    if (!window.confirm('למחוק את הקובץ?')) return;
    try {
      await filesApi.deleteFile({
        caseSerial: file.case_serial,
        fileSerial: file.serial,
        fileName: file.name,
      });
      setFiles((prev) => prev.filter((f) => f.serial !== file.serial));
    } catch (err) {
      setError(err.message || 'מחיקת הקובץ נכשלה');
    }
  };

  return (
    <div dir="rtl">
      <div className="row g-2 mb-3 align-items-end">
        <div className="col-12 col-md-4">
          <label className="form-label">חיפוש</label>
          <input
            type="text"
            className="form-control"
            placeholder="חיפוש לפי שם, תיאור או סטטוס"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label">מספר תיק</label>
          <input
            type="number"
            className="form-control"
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            placeholder="לדוגמה 123"
          />
        </div>
        <div className="col-6 col-md-3 d-flex align-items-end">
          <button
            type="button"
            className="btn btn-outline-primary w-100"
            onClick={() => navigate('/app/files/upload')}
          >
            ⬆️ העלאה חדשה
          </button>
        </div>
      </div>

      {loading && <div>טוען...</div>}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-muted">לא נמצאו קבצים תואמים.</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>שם</th>
                <th>תיק</th>
                <th>סוג</th>
                <th>סטטוס</th>
                <th>תיאור</th>
                <th>נוצר</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((file) => (
                <tr key={file.serial}>
                  <td>{file.name}</td>
                  <td>{file.case_serial || '-'}</td>
                  <td>{file.content_type || '-'}</td>
                  <td>{file.status || '-'}</td>
                  <td className="text-truncate" style={{ maxWidth: '180px' }}>
                    {file.description || '-'}
                  </td>
                  <td>{formatDate(file.created_at)}</td>
                  <td className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => download(file)}
                    >
                      צפייה/הורדה
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() =>
                        navigate(`/app/files/preview/${file.serial}`, { state: { file } })
                      }
                    >
                      פרטים
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteFile(file)}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default FilesListPage;

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import filesApi from '../../api/filesApi';

function FilePreviewPage() {
  const navigate = useNavigate();
  const { fileSerial } = useParams();
  const location = useLocation();
  const fileFromState = location.state?.file;

  const [file, setFile] = useState(fileFromState || null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFile = async () => {
      if (fileFromState || !fileSerial) return;
      try {
        const res = await filesApi.getOfficeFiles();
        const allFiles = Array.isArray(res.data) ? res.data : [];
        const match = allFiles.find((item) => `${item.serial}` === `${fileSerial}`);
        if (match) setFile(match);
      } catch (err) {
        setError(err.message || 'טעינת הקובץ נכשלה');
      }
    };

    fetchFile();
  }, [fileFromState, fileSerial]);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!file) return;
      setLoading(true);
      setError('');
      try {
        const res = await filesApi.getFileUrl({
          caseSerial: file.case_serial,
          fileSerial: file.serial,
          fileName: file.name,
        });
        setUrl(res.data || '');
      } catch (err) {
        setError(err.message || 'שליפת הקובץ נכשלה');
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [file]);

  return (
    <div dir="rtl">
      <button type="button" className="btn btn-link px-0 mb-3" onClick={() => navigate(-1)}>
        ← חזרה לרשימה
      </button>

      <div className="card shadow-sm">
        <div className="card-body">
          <h3 className="h5 mb-3">פרטי קובץ</h3>
          {!file && (
            <div className="text-muted">
              לא נשלחו פרטי קובץ. חזרו לרשימה ובחרו שוב קובץ לצפייה.
            </div>
          )}

          {file && (
            <>
              <dl className="row mb-3">
                <dt className="col-sm-3">שם</dt>
                <dd className="col-sm-9">{file.name}</dd>

                <dt className="col-sm-3">מספר תיק</dt>
                <dd className="col-sm-9">{file.case_serial || '-'}</dd>

                <dt className="col-sm-3">סוג תוכן</dt>
                <dd className="col-sm-9">{file.content_type || '-'}</dd>

                <dt className="col-sm-3">תיאור</dt>
                <dd className="col-sm-9">{file.description || '-'}</dd>

                <dt className="col-sm-3">סטטוס</dt>
                <dd className="col-sm-9">{file.status || '-'}</dd>
              </dl>

              {loading && <div>טוען קישור חתום...</div>}
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              {url && (
                <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
                  צפייה / הורדה
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewPage;

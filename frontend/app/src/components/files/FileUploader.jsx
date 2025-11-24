import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import filesApi, { buildObjectKey } from '../../api/filesApi';

const initialQueueItem = (file) => ({
  id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
  file,
  status: 'pending',
  progress: 0,
  error: '',
  fileSerial: null,
  key: '',
});

async function uploadWithProgress(url, fields, file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    Object.entries(fields || {}).forEach(([k, v]) => {
      formData.append(k, v);
    });
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = false;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.min(99, percent));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error('העלאה נכשלה (S3 החזיר שגיאה).'));
      }
    };

    xhr.onerror = () => reject(new Error('העלאה נכשלה (שגיאת רשת).'));
    xhr.send(formData);
  });
}

function FileUploader({ caseSerial, clientSerial }) {
  const [officeSerial, setOfficeSerial] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const requiresCase = useMemo(() => !caseSerial, [caseSerial]);

  useEffect(() => {
    const fetchOffice = async () => {
      try {
        const res = await filesApi.getOfficeSerial();
        setOfficeSerial(res?.data?.office_serial || null);
      } catch (err) {
        setError(err.message || 'טעינת פרטי המשרד נכשלה');
      }
    };

    fetchOffice();
  }, []);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setQueue((prev) => [...prev, ...files.map((f) => initialQueueItem(f))]);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      addFiles(event.dataTransfer?.files || []);
    },
    [addFiles],
  );

  const handleSelect = (event) => {
    addFiles(event.target.files || []);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startUpload = useCallback(
    async (item) => {
      if (!caseSerial) {
        setError('יש לבחור תיק לפני העלאה.');
        return;
      }
      if (!officeSerial) {
        setError('לא אותר מספר משרד פעיל להעלאה.');
        return;
      }
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'preparing', error: '' } : q)),
      );

      try {
        const createdAt = new Date().toISOString();
        const createRes = await filesApi.createFile({
          created_at: createdAt,
          case_serial: Number(caseSerial),
          client_serial: clientSerial ? Number(clientSerial) : undefined,
          name: item.file.name,
          technical_type: item.file.type || 'application/octet-stream',
          content_type: item.file.type || 'application/octet-stream',
          description: '',
        });
        const fileSerial = createRes.data;

        const key = buildObjectKey({
          officeSerial,
          caseSerial,
          fileSerial,
          fileName: item.file.name,
          preferHyphenated: true,
        });

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, fileSerial, key, status: 'signing', progress: 10 } : q,
          ),
        );

        const presignRes = await filesApi.getPresignedPost({
          file_name: item.file.name,
          file_type: item.file.type || 'application/octet-stream',
          file_size: item.file.size,
          key,
        });

        const presignData = presignRes.data || {};
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'uploading', progress: 25 } : q,
          ),
        );

        await uploadWithProgress(presignData.url, presignData.fields, item.file, (p) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: p } : q)),
          );
        });

        await filesApi.updateFile(fileSerial, { status: 'active' });

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'done', progress: 100, error: '', fileSerial }
              : q,
          ),
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', error: err.message || 'העלאה נכשלה' }
              : q,
          ),
        );
      }
    },
    [caseSerial, clientSerial, officeSerial],
  );

  const startAll = () => {
    queue
      .filter((item) => item.status === 'pending' || item.status === 'error')
      .forEach((item) => startUpload(item));
  };

  const removeFromQueue = (id) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="file-uploader" dir="rtl">
      <div
        className="border rounded-3 p-4 mb-3 text-center bg-light"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => e.preventDefault()}
      >
        <p className="fw-bold mb-1">גררו ושחררו קבצים כאן</p>
        <p className="text-muted mb-3">או בחרו קבצים מהמחשב</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="d-none"
          onChange={handleSelect}
          aria-label="file-input"
        />
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => fileInputRef.current?.click()}
        >
          בחירת קבצים
        </button>
      </div>

      {requiresCase && (
        <div className="alert alert-warning" role="alert">
          יש לבחור/למסור מספר תיק כדי לשמור את הקבצים במסלול הנכון.
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="h6 mb-0">תור העלאה</h3>
        <button type="button" className="btn btn-sm btn-success" onClick={startAll}>
          התחלת כל ההעלאות
        </button>
      </div>

      <div className="list-group">
        {queue.length === 0 && (
          <div className="text-muted">לא נוספו קבצים עדיין.</div>
        )}
        {queue.map((item) => (
          <div
            key={item.id}
            className="list-group-item d-flex flex-column flex-md-row gap-2 align-items-md-center justify-content-between"
          >
            <div className="flex-grow-1">
              <div className="fw-bold">{item.file.name}</div>
              <div className="small text-muted">
                {Math.round(item.file.size / 1024)} KB · {item.file.type || 'קובץ'}
              </div>
              {item.error && <div className="text-danger small">{item.error}</div>}
            </div>

            <div className="flex-grow-1">
              <div className="progress" style={{ height: '8px' }}>
                <div
                  className={`progress-bar ${
                    item.status === 'done'
                      ? 'bg-success'
                      : item.status === 'error'
                        ? 'bg-danger'
                        : 'bg-primary'
                  }`}
                  role="progressbar"
                  style={{ width: `${item.progress}%` }}
                  aria-valuenow={item.progress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>
              <div className="small mt-1">
                {item.status === 'pending' && 'ממתין'}
                {item.status === 'preparing' && 'יוצר רשומה...'}
                {item.status === 'signing' && 'מייצר קישור חתום...'}
                {item.status === 'uploading' && 'מעלה...'}
                {item.status === 'done' && 'הועלה בהצלחה'}
                {item.status === 'error' && 'שגיאה בהעלאה'}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              {(item.status === 'pending' || item.status === 'error') && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => startUpload(item)}
                >
                  נסה שוב
                </button>
              )}
              {item.status !== 'uploading' && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => removeFromQueue(item.id)}
                >
                  הסרה
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FileUploader;

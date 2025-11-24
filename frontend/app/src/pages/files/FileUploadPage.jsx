import { useState } from 'react';
import FileUploader from '../../components/files/FileUploader';

function FileUploadPage() {
  const [caseSerial, setCaseSerial] = useState('');
  const [clientSerial, setClientSerial] = useState('');

  return (
    <div dir="rtl">
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <label className="form-label">מספר תיק *</label>
          <input
            type="number"
            className="form-control"
            value={caseSerial}
            onChange={(e) => setCaseSerial(e.target.value)}
            placeholder="לדוגמה 123"
            required
          />
          <div className="form-text">נדרש כדי לבנות את מסלול הקובץ ב-S3.</div>
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">מספר לקוח (אופציונלי)</label>
          <input
            type="number"
            className="form-control"
            value={clientSerial}
            onChange={(e) => setClientSerial(e.target.value)}
            placeholder="לשיוך ללקוח ספציפי"
          />
        </div>
      </div>

      <FileUploader caseSerial={caseSerial} clientSerial={clientSerial} />
    </div>
  );
}

export default FileUploadPage;

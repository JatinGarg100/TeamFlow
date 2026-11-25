import { useState, useRef } from 'react';
import {
  uploadTaskAttachmentsApi,
  deleteTaskAttachmentApi,
  getTaskAttachmentDownloadUrl,
} from '../services/api';

/**
 * TaskAttachmentsModal
 * ────────────────────
 * Premium SaaS Mixed Theme + Electric Blue styling.
 * Supports:
 * - View existing attachments with original names, sizes, uploaders, and timestamps.
 * - Upload new documents (PDF, PNG, JPG, DOC, XLS) up to 5MB.
 * - Download or preview files safely via backend streams.
 * - Delete attachments with permission validation.
 */
export default function TaskAttachmentsModal({
  task,
  onClose,
  onAttachmentsUpdated,
  onTaskUpdated,
  canDelete = false,
}) {
  const [attachments, setAttachments] = useState(task?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const taskId = task?._id || task?.id;

  const notifyUpdated = (nextList) => {
    if (onAttachmentsUpdated) {
      onAttachmentsUpdated(taskId, nextList);
    }
    if (onTaskUpdated) {
      onTaskUpdated({ ...task, attachments: nextList });
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const updatedAttachments = await uploadTaskAttachmentsApi(taskId, formData);
      setAttachments(updatedAttachments);
      setSuccess(`Successfully attached ${files.length} file(s).`);
      notifyUpdated(updatedAttachments);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Failed to upload attachments.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId) => {
    setError('');
    setSuccess('');
    setDeletingId(attachmentId);

    try {
      await deleteTaskAttachmentApi(taskId, attachmentId);
      const nextList = attachments.filter((a) => a._id !== attachmentId);
      setAttachments(nextList);
      setSuccess('Attachment deleted.');
      notifyUpdated(nextList);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete attachment.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Task Attachments</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">{task?.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="mt-3 p-3 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-3 p-3 text-xs bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Upload Zone */}
        <div className="mt-4 p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 flex flex-col items-center justify-center text-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            className="hidden"
            id="task-file-input"
            disabled={uploading}
          />
          <label
            htmlFor="task-file-input"
            className={`btn-primary text-xs py-2 px-4 cursor-pointer inline-flex items-center gap-2 ${
              uploading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{uploading ? 'Uploading files...' : 'Choose files to upload'}</span>
          </label>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Allowed: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX (Max 5MB each, up to 5 files)
          </p>
        </div>

        {/* Attachments List */}
        <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2">
          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Files ({attachments.length})
          </h3>

          {attachments.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              No files attached to this task yet.
            </div>
          ) : (
            attachments.map((att) => {
              const downloadUrl = getTaskAttachmentDownloadUrl(taskId, att._id, true);
              const previewUrl = getTaskAttachmentDownloadUrl(taskId, att._id, false);
              const isDeleting = deletingId === att._id;

              return (
                <div
                  key={att._id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 transition-colors gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={att.originalName}>
                      {att.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">
                      <span>{formatFileSize(att.size)}</span>
                      <span>•</span>
                      <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>
                      {att.uploadedBy?.name && (
                        <>
                          <span>•</span>
                          <span>by {att.uploadedBy.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition"
                      title="Preview in browser"
                    >
                      View
                    </a>

                    <a
                      href={downloadUrl}
                      className="px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/50 dark:border-blue-800/80 rounded-lg transition"
                      title="Download file"
                    >
                      Download
                    </a>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(att._id)}
                        disabled={isDeleting}
                        className="px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition cursor-pointer"
                        title="Delete attachment"
                      >
                        {isDeleting ? '...' : '✕'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4 cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

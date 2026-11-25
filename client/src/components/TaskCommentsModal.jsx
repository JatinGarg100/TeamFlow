import { useState, useEffect, useRef } from 'react';
import { fetchTaskCommentsApi, createTaskCommentApi } from '../services/api';

/**
 * TaskCommentsModal
 * ─────────────────
 * Premium SaaS Mixed Theme + Electric Blue styling.
 * Displays:
 * - Task Title.
 * - Comments in chronological order with author name, role, avatar, date and time.
 * - Loading indicator and empty state.
 * - Form validation rejecting empty or whitespace submissions.
 * - Instant update upon posting.
 */
export default function TaskCommentsModal({ task, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const commentsEndRef = useRef(null);

  const taskId = task?._id || task?.id;

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch comments from backend
  useEffect(() => {
    if (!taskId) return;
    let isMounted = true;

    const loadComments = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchTaskCommentsApi(taskId);
        if (isMounted) {
          setComments(res.comments || []);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load comments.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadComments();
    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // 2. Handle comment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = commentText.trim();

    if (!trimmed) {
      setError('Please enter a comment.');
      return;
    }

    if (trimmed.length > 2000) {
      setError('Comment cannot exceed 2000 characters.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newComment = await createTaskCommentApi(taskId, trimmed);
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      setSuccess('Comment posted!');
      setTimeout(() => setSuccess(''), 2500);
      setTimeout(scrollToBottom, 100);

      if (onCommentAdded) {
        onCommentAdded(taskId, newComment);
      }
    } catch (err) {
      setError(err.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="pr-3 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                💬
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                Task Comments
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate" title={task?.title}>
              Discussing: <strong className="text-slate-800 dark:text-slate-200">{task?.title}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-2.5 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-2 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Comments Scrollable Feed */}
        <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-xs text-slate-500 dark:text-slate-400">
              <svg className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mb-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
              <span>Loading task discussion...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-slate-100">No comments yet</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs">
                Start the conversation with your team members by posting an update or question below.
              </p>
            </div>
          ) : (
            comments.map((comment) => {
              const author = comment.author || {};
              const authorName = author.name || 'Team Member';
              const initial = authorName.charAt(0).toUpperCase();

              return (
                <div
                  key={comment._id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/80 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/60 text-xs font-bold text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{authorName}</span>
                        {author.role && (
                          <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                            {author.role}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                      {comment.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Add Comment Input Form */}
        <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <textarea
              rows={2}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment, note, or update..."
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/50 resize-none"
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {commentText.length}/2000 characters
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting || !commentText.trim()}
                className="btn-primary text-xs py-1.5 px-4 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

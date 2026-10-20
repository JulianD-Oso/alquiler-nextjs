'use client';

export default function ToastContainer({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div id="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type || 'ok'}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

import { API_URL } from '../app/api/baseApi';

/** Downloads a file from an authenticated endpoint (Excel exports). */
export async function downloadFile(path, params = {}, fileName = 'report.xlsx') {
  const token = localStorage.getItem('token');
  let branch = null;
  try {
    branch = JSON.parse(localStorage.getItem('branch') || 'null');
  } catch (e) {
    branch = null;
  }
  const branchId = branch?._id || branch?.id || (typeof branch === 'string' ? branch : null);

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });

  const res = await fetch(`${API_URL}${path}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, ...(branchId ? { 'x-branch-id': branchId } : {}) }
  });
  if (!res.ok) {
    let message = 'Download failed';
    try {
      message = (await res.json()).message || message;
    } catch (e) {
      /* not json */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

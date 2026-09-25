import fs from 'node:fs/promises';

export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypt3_PnEL5TgdDPaBwg1M5bWAjQMR9dD5Jslicn3eZCtuNSTtqO35RafhQpuX-l9_m/exec';

export async function listDriveFiles(fetchImpl = fetch) {
  const response = await fetchImpl(GOOGLE_APPS_SCRIPT_URL);
  if (!response.ok) throw new Error(`讀取Google Drive清單失敗：HTTP ${response.status || 'unknown'}`);
  const result = await response.json();
  if (!result.success || !Array.isArray(result.files)) {
    throw new Error(result.message || result.error || 'Google Drive回傳的檔案清單無效');
  }
  return result.files;
}

export async function uploadWorkbookToDrive({
  filePath,
  filename,
  fetchImpl = fetch,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const base64Data = (await fs.readFile(filePath)).toString('base64');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchImpl(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ filename, base64Data }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status || 'unknown'}`);
      const result = await response.json();
      if (result.success) return result;
      throw new Error(result.message || result.error || '上傳失敗');
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(2000 * attempt);
    }
  }
  throw new Error(`Google Drive上傳失敗：${lastError?.message || lastError}`);
}

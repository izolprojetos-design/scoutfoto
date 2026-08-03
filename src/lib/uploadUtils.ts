
/**
 * Upload via XHR to expose byte progress + cancellation.
 * Returns true on success. Throws on HTTP/network error.
 */
export function xhrUploadToStorage(opts: {
  bucket: string;
  path: string;
  file: Blob;
  contentType: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  onProgress: (loaded: number, total: number) => void;
  registerXhr: (xhr: XMLHttpRequest) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${opts.supabaseUrl}/storage/v1/object/${opts.bucket}/${opts.path}`;
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${opts.accessToken}`);
    xhr.setRequestHeader('apikey', opts.supabaseAnonKey);
    xhr.setRequestHeader('Content-Type', opts.contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `HTTP ${xhr.status}`;
        try { const j = JSON.parse(xhr.responseText); if (j?.message) msg = j.message; } catch { /* */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Falha de rede'));
    xhr.onabort = () => reject(new Error('Cancelado'));
    opts.registerXhr(xhr);
    xhr.send(opts.file);
  });
}

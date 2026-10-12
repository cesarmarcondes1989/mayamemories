"use client";

/**
 * Envia um arquivo diretamente ao Storage privado usando a URL assinada
 * emitida pelo backend. Usa XHR para reportar progresso e permitir cancelar.
 * Formato compatível com storage-js uploadToSignedUrl (PUT multipart).
 */
export function uploadToSignedUrl(
  signedUrl: string,
  file: Blob,
  onProgress: (fraction: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) xhr.setRequestHeader("apikey", anon);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_failed_${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network_error"));
    xhr.onabort = () => reject(new Error("aborted"));
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
  return { promise, abort: () => xhr.abort() };
}

/** Duração de áudio/vídeo lida no próprio aparelho, antes do envio. */
export function readMediaDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    const done = (v?: number) => {
      URL.revokeObjectURL(url);
      resolve(v && Number.isFinite(v) ? v : undefined);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(undefined);
    setTimeout(() => done(undefined), 4000);
    el.src = url;
  });
}

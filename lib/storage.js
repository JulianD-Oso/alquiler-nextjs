import { put } from '@vercel/blob';

/**
 * Guarda una imagen (ej. firma) usando Vercel Blob si está configurado,
 * o convirtiendo a Data URL Base64 si no hay token de Blob configurado.
 * 
 * @param {File|Blob} file 
 * @param {string} filename 
 * @returns {Promise<string>} URL accesible de la imagen
 */
export async function saveSignatureFile(file, filename = 'firma.png') {
  if (!file) return null;

  // Si se configuró Vercel Blob en Vercel
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(`firmas/${Date.now()}-${filename}`, file, {
        access: 'public',
      });
      return blob.url;
    } catch (err) {
      console.error('Error al subir a Vercel Blob, usando fallback Base64:', err.message);
    }
  }

  // Fallback: Convertir a Data URL Base64 (ideal para desarrollo o sin configuración extra)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = file.type || 'image/png';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

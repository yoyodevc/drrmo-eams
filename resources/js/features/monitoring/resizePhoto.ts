// Shrinks a photo on the phone before it is sent: long side at most 1600 px, JPEG (S4.6).
// This also turns HEIC photos into JPEG where the browser can open them.
import { fitSize } from './reportDraft';

export async function resizePhoto(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the photo.');
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo.'))),
            'image/jpeg',
            0.85,
        ),
    );
}

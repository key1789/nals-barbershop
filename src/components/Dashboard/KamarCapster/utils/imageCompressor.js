import imageCompression from 'browser-image-compression';

export const compressImage = async (imageFile) => {
  // Kalau yang dimasukin bukan file gambar, balikin aja kosong
  if (!imageFile) return null;

  // Aturan Kompresi (Target: Maksimal 200 KB per foto)
  const options = {
    maxSizeMB: 0.2, // Maksimal 200 KB
    maxWidthOrHeight: 1024, // Resolusi maksimal (1024px udah cukup banget buat rambut)
    useWebWorker: true, // Biar HP Capster gak nge-lag pas ngompres
  };

  try {
    const compressedFile = await imageCompression(imageFile, options);
    return compressedFile;
  } catch (error) {
    console.error("Gagal ngompres foto Bos:", error);
    return imageFile; // Kalau gagal kompres, paksa pake file asli daripada error
  }
};
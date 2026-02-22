export type StoredPhoto = {
  id: string;
  createdAt: number;
  nickname: string;
  mime: string;
  dataBase64: string;
  isPublic: boolean;
  uploadedAt: number;
};

const g = globalThis as any;
if (!g.__OM_STORE__) g.__OM_STORE__ = { photos: [] as StoredPhoto[] };

export const store = g.__OM_STORE__ as { photos: StoredPhoto[] };

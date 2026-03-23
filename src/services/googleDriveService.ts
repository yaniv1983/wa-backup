import {GoogleSignin} from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';
import {DriveFolder, UploadProgress} from '../types';
import {DEFAULT_WEB_CLIENT_ID} from '../config';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DEFAULT_FOLDER_NAME = 'WA Business Backup';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export function configureGoogleSignIn(customClientId?: string) {
  GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive'],
    offlineAccess: true,
    webClientId: customClientId || DEFAULT_WEB_CLIENT_ID,
  });
}

export async function signIn() {
  await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new Error('Sign in was cancelled');
  }
  return response.data;
}

export async function signOut() {
  await GoogleSignin.signOut();
}

export function isSignedIn(): boolean {
  return GoogleSignin.hasPreviousSignIn();
}

async function getAccessToken(): Promise<string> {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
}

export async function listDriveFolders(): Promise<DriveFolder[]> {
  const token = await getAccessToken();
  const query = "mimeType='application/vnd.google-apps.folder' and trashed=false";
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&pageSize=100`,
    {headers: {Authorization: `Bearer ${token}`}},
  );
  const data = await res.json();
  return (data.files || []).map((f: any) => ({id: f.id, name: f.name}));
}

export async function createDriveFolder(name: string): Promise<DriveFolder> {
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const data = await res.json();
  return {id: data.id, name: data.name || name};
}

async function getOrCreateFolder(token: string, folderId?: string, folderName?: string): Promise<string> {
  if (folderId) {
    try {
      const res = await fetch(
        `${DRIVE_API}/files/${folderId}?fields=id,trashed`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      const data = await res.json();
      if (data.id && !data.trashed) {
        return data.id;
      }
    } catch {
      // Folder might have been deleted, fall through to create
    }
  }

  const name = folderName || DEFAULT_FOLDER_NAME;

  const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {headers: {Authorization: `Bearer ${token}`}},
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const createData = await createRes.json();
  return createData.id;
}

// Write base64 chunk to a temp file, then upload via XHR using file URI
// React Native XHR natively handles file:// URIs as binary uploads
async function uploadChunk(
  url: string,
  base64Data: string,
  rangeStart: number,
  rangeEnd: number,
  totalBytes: number,
): Promise<{status: number; responseText: string; rangeHeader: string | null}> {
  const tmpPath = `${RNFS.CachesDirectoryPath}/_upload_chunk.tmp`;
  await RNFS.writeFile(tmpPath, base64Data, 'base64');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader(
      'Content-Range',
      `bytes ${rangeStart}-${rangeEnd - 1}/${totalBytes}`,
    );

    xhr.onload = () => {
      RNFS.unlink(tmpPath).catch(() => {});
      resolve({
        status: xhr.status,
        responseText: xhr.responseText,
        rangeHeader: xhr.getResponseHeader('Range'),
      });
    };

    xhr.onerror = () => {
      RNFS.unlink(tmpPath).catch(() => {});
      reject(new Error(`Network error during upload (chunk ${rangeStart}-${rangeEnd})`));
    };

    xhr.send({uri: 'file://' + tmpPath} as any);
  });
}

export async function uploadFile(
  filePath: string,
  fileName: string,
  onProgress?: (progress: UploadProgress) => void,
  driveFolderId?: string,
  driveFolderName?: string,
): Promise<string> {
  const token = await getAccessToken();
  const folderId = await getOrCreateFolder(token, driveFolderId, driveFolderName);
  const fileStats = await RNFS.stat(filePath);
  const totalBytes = parseInt(String(fileStats.size), 10);

  // Initiate resumable upload
  const initRes = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Length': String(totalBytes),
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    },
  );

  if (!initRes.ok) {
    const errBody = await initRes.text();
    throw new Error(`Failed to initiate upload (${initRes.status}): ${errBody}`);
  }

  const uploadUri = initRes.headers.get('Location');
  if (!uploadUri) {
    throw new Error('Failed to initiate resumable upload - no Location header');
  }

  // Upload in chunks
  let bytesUploaded = 0;

  while (bytesUploaded < totalBytes) {
    const chunkEnd = Math.min(bytesUploaded + CHUNK_SIZE, totalBytes);
    const chunkSize = chunkEnd - bytesUploaded;

    const base64Data = await RNFS.read(filePath, chunkSize, bytesUploaded, 'base64');

    const result = await uploadChunk(
      uploadUri,
      base64Data,
      bytesUploaded,
      chunkEnd,
      totalBytes,
    );

    if (result.status === 200 || result.status === 201) {
      // Upload complete
      const data = JSON.parse(result.responseText);
      onProgress?.({bytesUploaded: totalBytes, totalBytes, percentage: 100});
      return data.id;
    }

    if (result.status === 308) {
      // Resume incomplete - continue
      bytesUploaded = result.rangeHeader
        ? parseInt(result.rangeHeader.split('-')[1], 10) + 1
        : chunkEnd;
    } else {
      throw new Error(`Upload failed with status ${result.status}: ${result.responseText}`);
    }

    onProgress?.({
      bytesUploaded,
      totalBytes,
      percentage: Math.round((bytesUploaded / totalBytes) * 100),
    });
  }

  throw new Error('Upload ended unexpectedly');
}

export async function resumeUpload(
  uploadUri: string,
  filePath: string,
  totalBytes: number,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string> {
  // Check how much was already uploaded
  const statusRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes */${totalBytes}`,
    },
  });

  let bytesUploaded = 0;
  if (statusRes.status === 308) {
    const range = statusRes.headers.get('Range');
    if (range) {
      bytesUploaded = parseInt(range.split('-')[1], 10) + 1;
    }
  }

  while (bytesUploaded < totalBytes) {
    const chunkEnd = Math.min(bytesUploaded + CHUNK_SIZE, totalBytes);
    const chunkSize = chunkEnd - bytesUploaded;

    const base64Data = await RNFS.read(filePath, chunkSize, bytesUploaded, 'base64');

    const result = await uploadChunk(
      uploadUri,
      base64Data,
      bytesUploaded,
      chunkEnd,
      totalBytes,
    );

    if (result.status === 200 || result.status === 201) {
      const data = JSON.parse(result.responseText);
      onProgress?.({bytesUploaded: totalBytes, totalBytes, percentage: 100});
      return data.id;
    }

    if (result.status === 308) {
      bytesUploaded = result.rangeHeader
        ? parseInt(result.rangeHeader.split('-')[1], 10) + 1
        : chunkEnd;
    } else {
      throw new Error(`Resume upload failed with status ${result.status}`);
    }

    onProgress?.({
      bytesUploaded,
      totalBytes,
      percentage: Math.round((bytesUploaded / totalBytes) * 100),
    });
  }

  throw new Error('Resume upload ended unexpectedly');
}

export async function enforceRetention(
  maxCount: number,
  folderId?: string,
  folderName?: string,
): Promise<void> {
  const token = await getAccessToken();
  const resolvedFolderId = await getOrCreateFolder(token, folderId, folderName);

  // List all files in the backup folder, sorted oldest first
  const query = `'${resolvedFolderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const res = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`,
    {headers: {Authorization: `Bearer ${token}`}},
  );
  const data = await res.json();
  const files = data.files || [];

  if (files.length <= maxCount) return;

  // Delete files beyond the retention count (keep the newest maxCount)
  const toDelete = files.slice(maxCount);
  for (const file of toDelete) {
    try {
      await fetch(`${DRIVE_API}/files/${file.id}`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${token}`},
      });
    } catch {
      // Best effort - continue deleting others
    }
  }
}

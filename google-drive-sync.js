/**
 * google-drive-sync.js - Integración directa con Google Drive (OAuth 2.0 & REST API v3)
 * Permite al estudiante conectar su cuenta de Google/Classroom y respaldar copias en su Google Drive.
 * Independiente de Firebase.
 */

import { getSetting, setSetting } from './db.js';

let tokenClient = null;
let googleAccessToken = null;
let googleUser = null;

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

/**
 * Carga dinámica del SDK oficial de Google Identity Services (GIS)
 */
export function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google.accounts.oauth2);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google?.accounts?.oauth2);
    script.onerror = (err) => reject(new Error('No se pudo cargar Google Identity Services: ' + err));
    document.head.appendChild(script);
  });
}

/**
 * Obtiene el Client ID de Google configurado
 */
export async function getGoogleClientId() {
  return await getSetting('googleDriveClientId', '');
}

/**
 * Guarda el Client ID de Google
 */
export async function setGoogleClientId(clientId) {
  return await setSetting('googleDriveClientId', clientId.trim());
}

/**
 * Inicia el proceso de autenticación con la cuenta de Google para Google Drive
 * @param {Function} onTokenSuccess Callback con el token y datos de usuario
 */
export async function connectGoogleDrive(onTokenSuccess) {
  await loadGisScript();

  const clientId = await getGoogleClientId();
  if (!clientId) {
    throw new Error('Primero debes introducir tu Google Cloud OAuth Client ID en la configuración.');
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error('Error de autenticación Google: ' + tokenResponse.error));
            return;
          }

          googleAccessToken = tokenResponse.access_token;

          // Obtener perfil del usuario (nombre, email, avatar)
          try {
            googleUser = await fetchGoogleUserProfile(googleAccessToken);
            await setSetting('googleDriveUser', googleUser);
          } catch (e) {
            console.warn('No se pudo obtener el perfil de Google:', e);
          }

          if (onTokenSuccess) {
            onTokenSuccess(googleAccessToken, googleUser);
          }
          resolve({ token: googleAccessToken, user: googleUser });
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Obtiene el perfil de la cuenta de Google conectada
 */
async function fetchGoogleUserProfile(token) {
  const resp = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error('Error al obtener perfil de Google');
  return await resp.json();
}

/**
 * Obtiene los datos del usuario conectado actualmente en memoria
 */
export function getConnectedGoogleUser() {
  return googleUser;
}

/**
 * Recupera el usuario guardado previamente en la base de datos local
 */
export async function getSavedGoogleUser() {
  if (googleUser) return googleUser;
  googleUser = await getSetting('googleDriveUser', null);
  return googleUser;
}

/**
 * Comprueba si hay un token de acceso activo para Google Drive
 */
export function isGoogleDriveConnected() {
  return !!googleAccessToken;
}

/**
 * Cierra la sesión activa de Google Drive
 */
export async function disconnectGoogleDrive() {
  if (googleAccessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(googleAccessToken, () => {
      console.log('Token de Google Drive revocado');
    });
  }
  googleAccessToken = null;
  googleUser = null;
  await setSetting('googleDriveUser', null);
}

/**
 * Busca o crea una carpeta en Google Drive para la app
 * @param {string} token 
 * @returns {Promise<string|null>} Folder ID
 */
async function getOrCreateAppFolder(token) {
  const folderName = '🎒 Agenda Escolar';

  // Buscar si ya existe la carpeta
  const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(q)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Crear la carpeta si no existe
  const meta = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    description: 'Carpeta de copias de seguridad de Agenda Escolar PWA'
  };

  const createRes = await fetch(DRIVE_FILES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(meta)
  });

  if (createRes.ok) {
    const created = await createRes.json();
    return created.id;
  }

  return null;
}

/**
 * Sube una copia de seguridad JSON completa a Google Drive
 * @param {string} jsonString Contenido de la copia de seguridad
 * @returns {Promise<Object>} Archivo subido en Google Drive
 */
export async function uploadBackupToGoogleDrive(jsonString) {
  if (!googleAccessToken) {
    throw new Error('Primero debes conectar tu cuenta de Google.');
  }

  const folderId = await getOrCreateAppFolder(googleAccessToken);

  const fileName = `copia_agenda_${new Date().toISOString().split('T')[0]}.json`;
  const metadata = {
    name: fileName,
    description: 'Copia de seguridad generada por la Agenda Escolar PWA',
    mimeType: 'application/json',
    ...(folderId ? { parents: [folderId] } : {})
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const response = await fetch(DRIVE_UPLOAD_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${googleAccessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errData = await response.text();
    throw new Error('Error al subir a Google Drive: ' + errData);
  }

  return await response.json();
}

/**
 * Lista los archivos de copia de seguridad guardados en Google Drive
 * @returns {Promise<Array>} Lista de archivos encontrados
 */
export async function listBackupsFromGoogleDrive() {
  if (!googleAccessToken) {
    throw new Error('Debes conectar tu cuenta de Google.');
  }

  const q = "name contains 'copia_agenda' and mimeType = 'application/json' and trashed = false";
  const url = `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${googleAccessToken}` }
  });

  if (!response.ok) {
    throw new Error('Error al buscar copias en Google Drive');
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Descarga una copia de seguridad específica de Google Drive
 * @param {string} fileId 
 * @returns {Promise<string>} Contenido JSON de la copia de seguridad
 */
export async function downloadBackupFromGoogleDrive(fileId) {
  if (!googleAccessToken) {
    throw new Error('Debes conectar tu cuenta de Google.');
  }

  const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${googleAccessToken}` }
  });

  if (!response.ok) {
    throw new Error('Error al descargar el archivo de Google Drive');
  }

  return await response.text();
}

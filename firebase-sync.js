/**
 * firebase-sync.js - Sincronización Híbrida en la Nube con Firebase & Firestore (Offline-First)
 * Permite inicio de sesión con Google (o cuenta escolar de Google Classroom) y respaldo seguro en la nube.
 */

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDb = null;
let currentUser = null;
let authListener = null;

// URLs del SDK modular de Firebase (carga dinámica cuando hay internet)
const FIREBASE_APP_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const FIREBASE_AUTH_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
const FIREBASE_FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let firebaseModules = null;

/**
 * Carga dinámica del SDK de Firebase Modular
 */
async function loadFirebaseModules() {
  if (firebaseModules) return firebaseModules;
  if (!navigator.onLine) {
    throw new Error('Estás en modo sin conexión. Conéctate a internet para sincronizar con Firebase.');
  }

  try {
    const [appMod, authMod, firestoreMod] = await Promise.all([
      import(FIREBASE_APP_URL),
      import(FIREBASE_AUTH_URL),
      import(FIREBASE_FIRESTORE_URL)
    ]);

    firebaseModules = {
      ...appMod,
      ...authMod,
      ...firestoreMod
    };
    return firebaseModules;
  } catch (err) {
    console.warn('No se pudo cargar el SDK de Firebase desde la CDN:', err);
    throw new Error('No se pudo cargar el SDK de Firebase. Verifica tu conexión a internet.');
  }
}

/**
 * Inicializa Firebase con la configuración proporcionada por el usuario
 * @param {Object} config Configuración de Firebase (apiKey, authDomain, projectId...)
 * @param {Function} onAuthStateChange Callback cuando cambia el usuario autenticado
 */
export async function initFirebase(config, onAuthStateChange = null) {
  if (!config || !config.apiKey || !config.projectId) {
    return null;
  }

  try {
    const mods = await loadFirebaseModules();
    
    // Si ya había una app, no duplicarla
    if (!firebaseApp) {
      firebaseApp = mods.initializeApp(config);
    }
    
    firebaseAuth = mods.getAuth(firebaseApp);
    firestoreDb = mods.getFirestore(firebaseApp);

    if (onAuthStateChange && !authListener) {
      authListener = mods.onAuthStateChanged(firebaseAuth, (user) => {
        currentUser = user;
        onAuthStateChange(user);
      });
    }

    return { app: firebaseApp, auth: firebaseAuth, db: firestoreDb };
  } catch (err) {
    console.warn('Error inicializando Firebase:', err);
    return null;
  }
}

/**
 * Inicia sesión con cuenta de Google (incluye cuentas escolares de Google Workspace / Classroom)
 */
export async function loginWithGoogle() {
  const mods = await loadFirebaseModules();
  if (!firebaseAuth) {
    throw new Error('Firebase no está configurado aún. Introduce tu configuración en Ajustes.');
  }

  const provider = new mods.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await mods.signInWithPopup(firebaseAuth, provider);
  currentUser = result.user;
  return currentUser;
}

/**
 * Cierra la sesión activa de Firebase
 */
export async function logoutFirebase() {
  if (firebaseAuth && firebaseModules) {
    await firebaseModules.signOut(firebaseAuth);
    currentUser = null;
  }
}

/**
 * Obtiene el usuario autenticado actual
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Sube los datos de la agenda a Firestore en el casillero privado del usuario
 * @param {Object} data Datos completos de la agenda (asignaturas, tareas, horario, etc.)
 */
export async function uploadToCloud(data) {
  if (!currentUser) {
    throw new Error('Debes iniciar sesión con Google para sincronizar en la nube.');
  }
  if (!firestoreDb || !firebaseModules) {
    throw new Error('La base de datos de Firebase no está conectada.');
  }

  const { doc, setDoc } = firebaseModules;
  const userDocRef = doc(firestoreDb, 'users', currentUser.uid, 'agenda', 'main');

  const payload = {
    updatedAt: new Date().toISOString(),
    userEmail: currentUser.email,
    userName: currentUser.displayName,
    version: 3,
    ...data
  };

  // Guardar documento principal
  await setDoc(userDocRef, payload, { merge: true });
  return true;
}

/**
 * Descarga los datos de la agenda desde Firestore
 * @returns {Promise<Object|null>}
 */
export async function downloadFromCloud() {
  if (!currentUser) {
    throw new Error('Debes iniciar sesión con Google para descargar datos de la nube.');
  }
  if (!firestoreDb || !firebaseModules) {
    throw new Error('Firebase no está conectado.');
  }

  const { doc, getDoc } = firebaseModules;
  const userDocRef = doc(firestoreDb, 'users', currentUser.uid, 'agenda', 'main');

  const snapshot = await getDoc(userDocRef);
  if (snapshot.exists()) {
    return snapshot.data();
  }
  return null;
}

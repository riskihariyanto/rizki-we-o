import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "./firebase.js";

let listener = null;
let registering = false;

const ERROR_TEXT = {
  "auth/invalid-credential": "Email atau kata sandi salah.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/user-not-found": "Akun tidak ditemukan.",
  "auth/wrong-password": "Email atau kata sandi salah.",
  "auth/email-already-in-use": "Email sudah terdaftar.",
  "auth/weak-password": "Kata sandi minimal 6 karakter.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
  "auth/network-request-failed": "Koneksi bermasalah. Periksa internet kamu.",
  "permission-denied": "Akses ditolak oleh aturan keamanan."
};

export function authMessage(err) {
  return ERROR_TEXT[err && err.code] || "Terjadi kesalahan. Coba lagi.";
}

async function readVendor(vendorId) {
  const snap = await getDoc(doc(db, "vendors", vendorId));
  return snap.exists() ? snap.data() : null;
}

export async function loadProfile(user) {
  const [userSnap, ownVendor] = await Promise.all([
    getDoc(doc(db, "users", user.uid)),
    readVendor(user.uid).catch(() => null)
  ]);

  if (!userSnap.exists()) {
    return { uid: user.uid, email: user.email, role: null, vendorId: null, vendor: null };
  }

  const { role, vendorId } = userSnap.data();
  let vendor = null;

  if (vendorId && (role === "vendor" || role === "vendor_pending")) {
    vendor = vendorId === user.uid ? ownVendor : await readVendor(vendorId);
  }

  return { uid: user.uid, email: user.email, role, vendorId: vendorId || null, vendor };
}

export function onSession(callback) {
  listener = callback;
  return onAuthStateChanged(auth, async (user) => {
    if (registering) return;
    callback(user ? await loadProfile(user) : null);
  });
}

export async function refreshSession() {
  if (!listener) return;
  const user = auth.currentUser;
  listener(user ? await loadProfile(user) : null);
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  await signOut(auth);
}

export async function registerVendor({ email, password, namaVendor, noWa, wilayah, alamat, namaBank = "", noRekening = "", atasNama = "" }) {
  registering = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      role: "vendor_pending",
      vendorId: uid,
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "vendors", uid), {
      namaVendor: namaVendor.trim(),
      noWa: noWa.trim(),
      wilayah: wilayah.trim(),
      alamat: alamat.trim(),
      email: email.trim(),
      namaBank: namaBank.trim(),
      noRekening: noRekening.trim(),
      atasNama: atasNama.trim(),
      status: "menunggu",
      kategori: [],
      kodeVendor: uid.slice(0, 5).toUpperCase(),
      createdAt: serverTimestamp()
    });

    return uid;
  } finally {
    registering = false;
  }
}
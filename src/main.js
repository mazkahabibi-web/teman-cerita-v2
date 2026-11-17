
import './style.css';

import {
  auth,
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from './firebase';

import {
  createConversation,
  saveMessage,
  getMessages,
  getUserProfile,
  createUserProfile
} from './database';

import {
  syncProfileToSheets,
  syncMessageToSheets
} from './sheets-sync';


/* =================================
   1. KONFIGURASI
================================= */

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbyKIqVIJ7aghFTAtns0EEpvwt35IvU5Pn5Wkjwa5hmvnScYv5c3Cma5V-WFKX8qXF6N/exec';


/* =================================
   2. ELEMENT HTML
================================= */

const identityScreen = document.querySelector('#identity-screen');
const identityForm = document.querySelector('#identity-form');
const nameInput = document.querySelector('#user-name');
const studyProgramInput = document.querySelector('#user-study-program');
const identityError = document.querySelector('#identity-error');

const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messages = document.querySelector('#messages');

const status = document.querySelector('.status-text');
const statusDot = document.querySelector('.status-dot');

const chatScrollArea = document.querySelector('.chat-scroll-area');


/* =================================
   3. STATE APLIKASI
================================= */

let currentUser = null;
let conversationId = null;
let conversationHistory = [];

let userProfile = null;

let isReady = false;
let isSending = false;



const DEVICE_STORAGE_KEY = 'teman_cerita_device_id';

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
  }

  return deviceId;
}

const deviceId = getDeviceId();



/* =================================
   4. STATUS CHAT
================================= */

function setStatus(text, connected = false) {
  if (status) {
    status.textContent = text;
  }

  if (statusDot) {
    statusDot.classList.toggle(
      'is-connected',
      connected
    );
  }
}


/* =================================
   5. HALAMAN IDENTITAS
================================= */

function showIdentity() {
  if (identityScreen) {
    identityScreen.hidden = false;
  }

  if (nameInput) {
    nameInput.focus();
  }
}

function hideIdentity() {
  if (identityScreen) {
    identityScreen.hidden = true;
  }
}


function getDeviceErrorMessage(error) {
  const code = error?.message || error?.code || '';

  const messages = {
    DEVICE_MISMATCH:
      'Akun ini sudah terikat dengan perangkat lain. Silakan hubungi admin untuk bantuan.',

    DEVICE_NOT_AUTHORIZED:
      'Perangkat ini tidak berhasil diverifikasi. Silakan hubungi admin.',

    DEVICE_ALREADY_REGISTERED:
      'Perangkat ini sudah terdaftar menggunakan akun mahasiswa lain.',

    PROFILE_DEVICE_NOT_REGISTERED:
      'Akun ini belum memiliki ikatan perangkat yang valid. Silakan hubungi admin.',

    DEVICE_ID_MISSING:
      'ID perangkat tidak ditemukan. Silakan muat ulang aplikasi.',

    PROFILE_INVALID:
      'Nama dan program studi wajib diisi.'
  };

  return messages[code] || null;
}

function showIdentityError(message, blocked = false) {
  if (identityError) {
    identityError.textContent = message;
    identityError.hidden = false;
  }

  showIdentity();

  const submitButton = identityForm?.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) {
    submitButton.disabled = blocked;
  }
}


/* =================================
   6. MEMUAT PROFIL MAHASISWA
================================= */


async function loadUserProfile(user) {
  const savedProfile = await getUserProfile(
    user.uid,
    deviceId
  );

  if (savedProfile) {
    userProfile = savedProfile;
    hideIdentity();
    return;
  }

  userProfile = null;
  showIdentity();
}



/* =================================
   7. MENYIMPAN IDENTITAS
================================= */

identityForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!isReady || !currentUser) {
    identityError.textContent =
      'Mohon tunggu, aplikasi sedang menghubungkan server.';

    identityError.hidden = false;

    return;
  }

  const name = nameInput.value.trim();
  const studyProgram = studyProgramInput.value;

  if (!name || !studyProgram) {
    identityError.textContent =
      'Silakan isi nama dan pilih program studi.';

    identityError.hidden = false;

    return;
  }

  if (name.length > 60) {
    identityError.textContent =
      'Nama maksimal 60 karakter.';

    identityError.hidden = false;

    return;
  }

  const profile = {
    name,
    studyProgram
  };

  const submitButton = identityForm.querySelector(
    'button[type="submit"]'
  );

  try {
    if (submitButton) {
      submitButton.disabled = true;
    }

    identityError.hidden = true;

    // Simpan profil ke Firestore
    userProfile = await createUserProfile(
      currentUser.uid,
      profile,
      deviceId
    );

    await startConversation(currentUser);

    isReady = true;

    // Salin profil ke Google Sheets (asinkron, data utama tetap di Firestore)
    syncProfileToSheets(currentUser, userProfile);

    hideIdentity();

    scrollToLatest('auto');

    console.log('Profil berhasil disimpan.');

  
} catch (error) {
  console.error('Profile save error:', error);

  const deviceError = getDeviceErrorMessage(error);

  if (deviceError) {
    showIdentityError(
      deviceError,
      error.message !== 'PROFILE_INVALID'
    );
  } else if (userProfile) {
    showIdentityError(
      'Profil berhasil disimpan, tetapi percakapan gagal dimuat. Silakan muat ulang halaman.',
      true
    );
  } else {
    showIdentityError(
      'Identitas gagal disimpan. Periksa koneksi internet dan coba lagi.'
    );
  }


  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});


/* =================================
   8. AUTO SCROLL CHAT
================================= */

function scrollToLatest(behavior = 'smooth') {
  if (!chatScrollArea) return;

  requestAnimationFrame(() => {
    chatScrollArea.scrollTo({
      top: chatScrollArea.scrollHeight,
      behavior
    });
  });
}


/* =================================
   9. MENAMPILKAN PESAN
================================= */

function addMessage(content, sender) {
  const message = document.createElement('div');

  message.classList.add('message', sender);
  message.textContent = content;

  messages.appendChild(message);

  scrollToLatest();

  return message;
}


/* =================================
   10. INISIALISASI CHAT
================================= */


async function startConversation(user) {
  const storageKey = `conversation_${user.uid}`;

  conversationId = localStorage.getItem(storageKey);

  if (!conversationId) {
    conversationId = await createConversation(user.uid);

    localStorage.setItem(
      storageKey,
      conversationId
    );
  }

  const history = await getMessages(
    user.uid,
    conversationId
  );

  messages.innerHTML = '';

  conversationHistory = history.map(message => ({
    sender: message.sender,
    content: message.content
  }));

  history.forEach(message => {
    const element = document.createElement('div');

    element.classList.add('message', message.sender);
    element.textContent = message.content;

    messages.appendChild(element);
  });

  scrollToLatest('auto');

  console.log('Chat siap digunakan.');
  console.log('UID:', user.uid);
  console.log('Conversation:', conversationId);
}

async function initializeChat(user) {
  currentUser = user;

  conversationId = null;
  userProfile = null;

  await loadUserProfile(user);

  if (!userProfile) {
    isReady = true;
    setStatus('Menunggu pendaftaran');
    return;
  }

  await startConversation(user);

  isReady = true;
  setStatus('Terhubung', true);
}



/* =================================
   11. KONEKSI GEMINI AI
================================= */

async function sendToGemini(content) {
  const idToken = await currentUser.getIdToken();

  const response = await fetch(GAS_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },

    body: JSON.stringify({
      idToken,

      message: content,

      profile: userProfile,

      history: conversationHistory
    })
  });

  if (!response.ok) {
    throw new Error(
      `Server error: ${response.status}`
    );
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.error || 'Gemini gagal menjawab.'
    );
  }

  if (!result.reply) {
    throw new Error('Jawaban Gemini kosong.');
  }

  return result.reply;
}


/* =================================
   12. FIREBASE AUTHENTICATION
================================= */

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      isReady = false;

      setStatus('Menghubungkan...');

      await signInAnonymously(auth);

      return;
    }

    // Jika user bukan anonim (misalnya Google login admin),
    // sign out terlebih dahulu agar mahasiswa mendapat UID anonim sendiri.
    if (!user.isAnonymous) {
      console.log(
        'Terdeteksi sesi non-anonim di halaman mahasiswa.',
        'Sign out terlebih dahulu...'
      );

      isReady = false;

      await signOut(auth);

      // onAuthStateChanged akan terpanggil kembali
      // dengan user = null, lalu signInAnonymously dipanggil.
      return;
    }

    if (
      currentUser?.uid === user.uid &&
      isReady
    ) {
      return;
    }

    isReady = false;

    setStatus('Memuat riwayat...');

    await initializeChat(user);

  
  } catch (error) {
    console.error('Initialization error:', error);

    isReady = false;
    conversationId = null;
    userProfile = null;

    const deviceError = getDeviceErrorMessage(error);

    if (deviceError) {
      showIdentityError(deviceError, true);
      setStatus('Perangkat tidak terverifikasi');
    } else {
      showIdentityError(
        'Aplikasi gagal terhubung ke server. Silakan muat ulang halaman.'
      );
      setStatus('Gagal memuat');
    }
  }
});


/* =================================
   13. PENGIRIMAN PESAN
================================= */

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (
    !isReady ||
    !currentUser ||
    !conversationId ||
    !userProfile ||
    isSending
  ) {
    return;
  }

  const content = input.value.trim();

  if (!content) return;

  isSending = true;

  input.disabled = true;

  setStatus('Mengirim pesan...');

  let userMessageSaved = false;

  try {
    // Simpan pesan pengguna
    const userMessageId = await saveMessage(
      currentUser.uid,
      conversationId,
      'user',
      content
    );

    userMessageSaved = true;

    // Salin pesan pengguna ke Google Sheets (asinkron)
    syncMessageToSheets(currentUser, {
      conversationId,
      messageId: userMessageId,
      sender: 'user',
      content,
      studentName: userProfile?.name,
      studyProgram: userProfile?.studyProgram,
      timestamp: new Date().toISOString()
    });

    addMessage(content, 'user');

    input.value = '';

    setStatus('AI sedang mengetik...');

    // Kirim pesan dan profil ke Gemini
    const reply = await sendToGemini(content);

    // Simpan jawaban Gemini
    const assistantMessageId = await saveMessage(
      currentUser.uid,
      conversationId,
      'assistant',
      reply
    );

    // Salin jawaban Gemini ke Google Sheets (asinkron)
    syncMessageToSheets(currentUser, {
      conversationId,
      messageId: assistantMessageId,
      sender: 'assistant',
      content: reply,
      studentName: userProfile?.name,
      studyProgram: userProfile?.studyProgram,
      timestamp: new Date().toISOString()
    });

    addMessage(reply, 'assistant');

    // Perbarui riwayat percakapan
    conversationHistory.push(
      {
        sender: 'user',
        content
      },
      {
        sender: 'assistant',
        content: reply
      }
    );

    console.log('Percakapan berhasil diproses.');

  } catch (error) {
    console.error('Chat error:', error);

    if (userMessageSaved) {
      conversationHistory.push({
        sender: 'user',
        content
      });
    }

    addMessage(
      'Maaf, pesan belum berhasil diproses. Silakan coba lagi.',
      'assistant'
    );

  } finally {
    isSending = false;

    input.disabled = false;

    setStatus('Terhubung', true);

    input.focus();

    scrollToLatest();
  }
});


/* =================================
   14. FOKUS INPUT
================================= */

input.addEventListener('focus', () => {
  setTimeout(() => {
    scrollToLatest();
  }, 250);
});

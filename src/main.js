
import './style.css';

import {
  auth,
  signInAnonymously,
  onAuthStateChanged
} from './firebase';

import {
  createConversation,
  saveMessage,
  getMessages,
  getUserProfile,
  createUserProfile
} from './database';


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


/* =================================
   6. MEMUAT PROFIL MAHASISWA
================================= */

async function loadUserProfile(user) {
  // Periksa profil di Firestore
  const savedProfile = await getUserProfile(user.uid);

  if (savedProfile) {
    userProfile = savedProfile;

    hideIdentity();

    // Hapus salinan profil lama di browser jika ada
    localStorage.removeItem(`profile_${user.uid}`);

    console.log('Profil ditemukan di Firestore.');

    return;
  }

  // Migrasi profil lama dari localStorage
  const storageKey = `profile_${user.uid}`;
  const oldProfile = localStorage.getItem(storageKey);

  if (oldProfile) {
    try {
      const parsedProfile = JSON.parse(oldProfile);

      if (
        parsedProfile.name &&
        parsedProfile.studyProgram
      ) {
        userProfile = await createUserProfile(
          user.uid,
          parsedProfile
        );

        localStorage.removeItem(storageKey);

        hideIdentity();

        console.log('Profil lama berhasil dipindahkan.');

        return;
      }
    } catch (error) {
      console.error('Profile migration error:', error);
    }
  }

  // Jika belum mempunyai profil
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
      profile
    );

    hideIdentity();

    scrollToLatest('auto');

    console.log('Profil berhasil disimpan.');

  } catch (error) {
    console.error('Profile save error:', error);

    identityError.textContent =
      'Identitas gagal disimpan. Silakan coba lagi.';

    identityError.hidden = false;

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

async function initializeChat(user) {
  currentUser = user;

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

  conversationHistory = history.map((message) => ({
    sender: message.sender,
    content: message.content
  }));

  history.forEach((message) => {
    const element = document.createElement('div');

    element.classList.add(
      'message',
      message.sender
    );

    element.textContent = message.content;

    messages.appendChild(element);
  });

  // Ambil profil dari Firestore
  await loadUserProfile(user);

  isReady = true;

  setStatus('Terhubung', true);

  scrollToLatest('auto');

  console.log('Chat siap digunakan.');
  console.log('UID:', user.uid);
  console.log('Conversation:', conversationId);
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

    setStatus('Gagal memuat');
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
    await saveMessage(
      currentUser.uid,
      conversationId,
      'user',
      content
    );

    userMessageSaved = true;

    addMessage(content, 'user');

    input.value = '';

    setStatus('AI sedang mengetik...');

    // Kirim pesan dan profil ke Gemini
    const reply = await sendToGemini(content);

    // Simpan jawaban Gemini
    await saveMessage(
      currentUser.uid,
      conversationId,
      'assistant',
      reply
    );

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

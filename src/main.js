
import './style.css';

import {
  auth,
  signInAnonymously,
  onAuthStateChanged
} from './firebase';

import {
  createConversation,
  saveMessage,
  getMessages
} from './database';

const GAS_URL =
  'https://script.google.com/macros/s/AKfycbwXuz999w40EQsGivIkiXTXw5V8FpHY_W0kbZzytCXaSKLf03BVii77EycbZb4n6H7f/exec';

const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const messages = document.querySelector('#messages');
const status = document.querySelector('.status-text');

let currentUser = null;
let conversationId = null;
let conversationHistory = [];
let isReady = false;
let isSending = false;

function addMessage(content, sender) {
  const message = document.createElement('div');

  message.classList.add('message', sender);
  message.textContent = content;

  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

async function initializeChat(user) {
  currentUser = user;

  const storageKey = `conversation_${user.uid}`;

  conversationId = localStorage.getItem(storageKey);

  if (!conversationId) {
    conversationId = await createConversation(user.uid);
    localStorage.setItem(storageKey, conversationId);
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
    addMessage(message.content, message.sender);
  });

  isReady = true;
  status.textContent = '● Terhubung';

  console.log('Chat siap digunakan');
  console.log('UID:', user.uid);
  console.log('Conversation:', conversationId);
}

async function sendToGemini(content) {
  const idToken = await currentUser.getIdToken();

  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      idToken: idToken,
      message: content,
      history: conversationHistory
    })
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || 'Gemini gagal menjawab.');
  }

  if (!result.reply) {
    throw new Error('Jawaban Gemini kosong.');
  }

  return result.reply;
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      status.textContent = '● Menghubungkan...';
      await signInAnonymously(auth);
      return;
    }

    if (currentUser?.uid === user.uid && isReady) return;

    isReady = false;
    status.textContent = '● Memuat riwayat...';

    await initializeChat(user);

  } catch (error) {
    console.error('Initialization error:', error);
    status.textContent = '● Gagal memuat';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!isReady || !currentUser || !conversationId || isSending) {
    return;
  }

  const content = input.value.trim();

  if (!content) return;

  isSending = true;
  input.disabled = true;
  status.textContent = '● AI sedang mengetik...';

  try {
    // Simpan pesan pengguna
    await saveMessage(
      currentUser.uid,
      conversationId,
      'user',
      content
    );

    addMessage(content, 'user');
    input.value = '';

    // Kirim pesan ke Gemini dengan riwayat sebelumnya
    const reply = await sendToGemini(content);

    // Simpan jawaban AI
    await saveMessage(
      currentUser.uid,
      conversationId,
      'assistant',
      reply
    );

    addMessage(reply, 'assistant');

    // Perbarui konteks percakapan
    conversationHistory.push(
      { sender: 'user', content },
      { sender: 'assistant', content: reply }
    );

    console.log('Pesan dan jawaban berhasil diproses.');

  } catch (error) {
    console.error('Chat error:', error);
    addMessage(
      'Maaf, pesan belum berhasil diproses. Silakan coba lagi.',
      'assistant'
    );

  } finally {
    isSending = false;
    input.disabled = false;
    input.focus();

    status.textContent = '● Terhubung';
  }
});

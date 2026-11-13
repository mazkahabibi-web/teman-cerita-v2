import './admin.css';
import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from './firebase';

import {
  collection,
  getDocs
} from 'firebase/firestore';

const ADMIN_EMAIL = 'kamadiksiadvokasi@gmail.com';

const loginButton = document.getElementById('google-login');
const logoutButton = document.getElementById('logout');
const statusText = document.getElementById('admin-status');
const dashboard = document.getElementById('dashboard');
const studentList = document.getElementById('student-list');

const provider = new GoogleAuthProvider();

loginButton.addEventListener('click', async () => {
  try {
    statusText.textContent = 'Menghubungkan akun Google...';

    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    statusText.textContent = 'Login gagal. Silakan coba lagi.';
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error(error);
    statusText.textContent = 'Gagal logout.';
  }
});


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginButton.hidden = false;
    logoutButton.hidden = true;
    dashboard.hidden = true;
    statusText.textContent = 'Silakan login menggunakan akun admin.';
    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    statusText.textContent = 'Akses ditolak. Akun ini bukan admin.';
    await signOut(auth);
    return;
  }

  try {
    statusText.textContent = 'Memeriksa hak akses admin...';

    // Memperbarui token agar custom claim terbaru terbaca
    const tokenResult = await user.getIdTokenResult(true);

    if (tokenResult.claims.admin !== true) {
      statusText.textContent = 'Hak akses admin belum ditemukan.';
      await signOut(auth);
      return;
    }

    loginButton.hidden = true;
    logoutButton.hidden = false;
    dashboard.hidden = false;
    statusText.textContent = `Login sebagai ${user.email}`;

    await loadStudents();

  } catch (error) {
    console.error(error);
    statusText.textContent = 'Gagal memeriksa hak akses admin.';
  }
});




async function loadStudents() {
  studentList.textContent = 'Memuat data mahasiswa...';

  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    studentList.innerHTML = '';

    if (snapshot.empty) {
      studentList.textContent = 'Belum ada data mahasiswa.';
      return;
    }

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      if (!data.name || !data.studyProgram) return;

      const student = document.createElement('div');
      student.style.padding = '12px';
      student.style.marginBottom = '12px';
      student.style.border = '1px solid #ddd';
      student.style.borderRadius = '8px';

      const name = document.createElement('strong');
      name.textContent = data.name;

      const program = document.createElement('p');
      program.textContent = data.studyProgram;

      const button = document.createElement('button');
      button.textContent = 'Lihat Riwayat Percakapan';

      const history = document.createElement('div');
      history.hidden = true;
      history.style.marginTop = '12px';

      button.addEventListener('click', async () => {
        if (!history.hidden) {
          history.hidden = true;
          button.textContent = 'Lihat Riwayat Percakapan';
          return;
        }

        history.hidden = false;

        if (history.dataset.loaded === 'true') {
          button.textContent = 'Tutup Riwayat Percakapan';
          return;
        }

        button.textContent = 'Memuat...';
        history.textContent = 'Memuat riwayat percakapan...';

        await loadConversationHistory(
          docSnapshot.id,
          history
        );

        history.dataset.loaded = 'true';
        button.textContent = 'Tutup Riwayat Percakapan';
      });

      student.append(name, program, button, history);
      studentList.appendChild(student);
    });

    if (!studentList.children.length) {
      studentList.textContent = 'Belum ada data mahasiswa.';
    }

  } catch (error) {
    console.error(error);
    studentList.textContent =
      'Gagal mengambil data mahasiswa.';
  }
}


async function loadConversationHistory(userId, container) {
  try {
    const conversationsRef = collection(
      db,
      'users',
      userId,
      'conversations'
    );

    const conversationsSnapshot = await getDocs(
      conversationsRef
    );

    container.innerHTML = '';

    if (conversationsSnapshot.empty) {
      container.textContent = 'Belum ada percakapan.';
      return;
    }

    const conversations = [];

    conversationsSnapshot.forEach((docSnapshot) => {
      conversations.push({
        id: docSnapshot.id,
        ...docSnapshot.data()
      });
    });

    conversations.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    for (const conversation of conversations) {
      const conversationBox = document.createElement('div');

      conversationBox.style.padding = '10px';
      conversationBox.style.marginTop = '10px';
      conversationBox.style.background = '#f5f5f5';
      conversationBox.style.borderRadius = '8px';

      const title = document.createElement('strong');
      title.textContent = conversation.title || 'Percakapan baru';

      conversationBox.appendChild(title);

      const messagesRef = collection(
        db,
        'users',
        userId,
        'conversations',
        conversation.id,
        'messages'
      );

      const messagesSnapshot = await getDocs(messagesRef);

      const messages = [];

      messagesSnapshot.forEach((messageDoc) => {
        messages.push({
          id: messageDoc.id,
          ...messageDoc.data()
        });
      });

      messages.sort((a, b) => {
        return (a.orderTime || 0) - (b.orderTime || 0);
      });

      if (messages.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Belum ada pesan.';
        conversationBox.appendChild(empty);
      }

      messages.forEach((message) => {
        const messageBox = document.createElement('p');

        const sender =
          message.sender === 'user'
            ? 'Mahasiswa'
            : 'Teman Cerita AI';

        messageBox.textContent =
          `${sender}: ${message.content || ''}`;

        messageBox.style.padding = '8px';
        messageBox.style.background = '#fff';
        messageBox.style.borderRadius = '6px';
        messageBox.style.whiteSpace = 'pre-wrap';

        conversationBox.appendChild(messageBox);
      });

      container.appendChild(conversationBox);
    }

  } catch (error) {
    console.error('Gagal memuat riwayat:', error);
    container.textContent =
      'Gagal memuat riwayat percakapan.';
  }
}




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


// =================================
// 1. LOGIN GOOGLE
// =================================

loginButton.addEventListener('click', async () => {
  try {
    statusText.textContent = 'Menghubungkan akun Google...';

    await signInWithPopup(auth, provider);

  } catch (error) {
    console.error('Login error:', error);

    statusText.textContent =
      'Login gagal. Silakan coba lagi.';
  }
});


// =================================
// 2. LOGOUT
// =================================

logoutButton.addEventListener('click', async () => {
  try {
    await signOut(auth);
    window.location.reload();

  } catch (error) {
    console.error('Logout error:', error);

    statusText.textContent = 'Gagal logout.';
  }
});


// =================================
// 3. CEK AUTHENTICATION ADMIN
// =================================

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    loginButton.hidden = false;
    logoutButton.hidden = true;
    dashboard.hidden = true;

    statusText.textContent =
      'Silakan login menggunakan akun admin.';

    return;
  }

  if (user.email !== ADMIN_EMAIL) {
    statusText.textContent =
      'Akses ditolak. Akun ini bukan admin.';

    await signOut(auth);
    return;
  }

  try {
    statusText.textContent =
      'Memeriksa hak akses admin...';

    const tokenResult = await user.getIdTokenResult(true);

    if (tokenResult.claims.admin !== true) {
      statusText.textContent =
        'Hak akses admin belum ditemukan.';

      await signOut(auth);
      return;
    }

    loginButton.hidden = true;
    logoutButton.hidden = false;
    dashboard.hidden = false;

    statusText.textContent =
      `Login sebagai ${user.email}`;

    console.log('Admin berhasil login.');
    console.log('Email admin:', user.email);
    console.log('UID admin:', user.uid);
    console.log('Custom claim admin:', tokenResult.claims.admin);

    await loadStudents();

  } catch (error) {
    console.error('Admin authentication error:', error);

    statusText.textContent =
      'Gagal memeriksa hak akses admin.';
  }
});


// =================================
// 4. DATA MAHASISWA
// =================================

let allStudents = [];

async function loadStudents() {

  studentList.textContent =
    'Memuat data mahasiswa...';

  try {
    const usersRef = collection(db, 'users');

    const snapshot = await getDocs(usersRef);

    allStudents = [];

    snapshot.forEach((docSnapshot) => {

      const data = docSnapshot.data();

      if (!data.name || !data.studyProgram) return;

      allStudents.push({
        id: docSnapshot.id,
        ...data
      });

    });

    console.log('Jumlah seluruh dokumen users:', snapshot.size);
    console.log('Jumlah profil mahasiswa:', allStudents.length);

    allStudents.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    createStudentFilters();

    renderStudents();

  } catch (error) {
    console.error('Gagal mengambil mahasiswa:', error);

    studentList.textContent =
      'Gagal mengambil data mahasiswa.';
  }
}


// =================================
// 5. FILTER DAN PENCARIAN
// =================================

function createStudentFilters() {

  if (document.getElementById('student-filters')) {
    return;
  }

  const filters = document.createElement('div');

  filters.id = 'student-filters';

  const search = document.createElement('input');

  search.type = 'search';
  search.id = 'student-search';
  search.placeholder = 'Cari nama mahasiswa...';

  const select = document.createElement('select');

  select.id = 'study-program-filter';

  const programs = [
    'Semua Program Studi',
    'Desain Komunikasi Visual (DKV)',
    'Ilmu Komunikasi',
    'Animasi',
    'Teknik Informatika',
    'Sistem Informasi',
    'Film dan Televisi',
    'Teknik Industri',
    'Teknik Biomedis',
    'Teknik Elektro',
    'Manajemen',
    'Akuntansi',
    'Bisnis Digital',
    'Sastra Jepang',
    'Bahasa Inggris',
    'Pengelolaan Perhotelan',
    'Kesehatan Masyarakat',
    'Kesehatan Lingkungan',
    'Manajemen Informasi Kesehatan',
    'Rekam Medis dan Informasi Kesehatan'
  ];

  programs.forEach((program, index) => {

    const option = document.createElement('option');

    option.value = index === 0 ? '' : program;
    option.textContent = program;

    select.appendChild(option);

  });

  search.addEventListener('input', renderStudents);

  select.addEventListener('change', renderStudents);

  filters.append(search, select);

  studentList.parentNode.insertBefore(
    filters,
    studentList
  );
}


// =================================
// 6. MENAMPILKAN DAFTAR MAHASISWA
// =================================

function renderStudents() {

  const searchInput =
    document.getElementById('student-search');

  const programFilter =
    document.getElementById('study-program-filter');

  if (!searchInput || !programFilter) return;

  const keyword =
    searchInput.value.trim().toLowerCase();

  const selectedProgram =
    programFilter.value;

  const filteredStudents = allStudents.filter((student) => {

    const matchesName = student.name
      .toLowerCase()
      .includes(keyword);

    const matchesProgram =
      !selectedProgram ||
      student.studyProgram === selectedProgram;

    return matchesName && matchesProgram;

  });

  studentList.innerHTML = '';

  if (filteredStudents.length === 0) {

    studentList.textContent =
      'Mahasiswa tidak ditemukan.';

    return;
  }

  filteredStudents.forEach((data) => {

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

    button.textContent =
      'Lihat Riwayat Percakapan';

    const history = document.createElement('div');

    history.hidden = true;
    history.style.marginTop = '12px';

    button.addEventListener('click', async () => {

      console.log('----------------------------');
      console.log('Mahasiswa dipilih:', data.name);
      console.log('ID dokumen mahasiswa:', data.id);
      console.log('----------------------------');

      if (!history.hidden) {

        history.hidden = true;

        button.textContent =
          'Lihat Riwayat Percakapan';

        return;
      }

      history.hidden = false;

      if (history.dataset.loaded === 'true') {

        button.textContent =
          'Tutup Riwayat Percakapan';

        return;
      }

      button.textContent = 'Memuat...';

      history.textContent =
        'Memuat riwayat percakapan...';

      const success = await loadConversationHistory(
        data.id,
        history
      );

      if (success) {
        history.dataset.loaded = 'true';
      }

      button.textContent =
        'Tutup Riwayat Percakapan';

    });

    student.append(
      name,
      program,
      button,
      history
    );

    studentList.appendChild(student);

  });
}


// =================================
// 7. MEMUAT RIWAYAT PERCAKAPAN
// =================================

async function loadConversationHistory(userId, container) {

  try {

    console.log('Memulai pemeriksaan riwayat...');
    console.log('UID mahasiswa:', userId);

    const conversationsRef = collection(
      db,
      'users',
      userId,
      'conversations'
    );

    const conversationsSnapshot = await getDocs(
      conversationsRef
    );

    // PEMERIKSAAN DATA FIRESTORE

    console.log(
      'Jumlah percakapan:',
      conversationsSnapshot.size
    );

    console.log(
      'ID percakapan:',
      conversationsSnapshot.docs.map(
        docSnapshot => docSnapshot.id
      )
    );

    container.innerHTML = '';

    if (conversationsSnapshot.empty) {

      container.textContent =
        'Belum ada percakapan.';

      console.warn(
        'Firestore tidak menemukan dokumen percakapan untuk UID:',
        userId
      );

      return true;
    }

    const conversations = [];

    conversationsSnapshot.forEach((docSnapshot) => {

      conversations.push({
        id: docSnapshot.id,
        ...docSnapshot.data()
      });

    });

    conversations.sort((a, b) => {

      const timeA =
        a.updatedAt?.toMillis?.() || 0;

      const timeB =
        b.updatedAt?.toMillis?.() || 0;

      return timeB - timeA;

    });


    // MEMUAT SETIAP PERCAKAPAN

    for (const conversation of conversations) {

      console.log(
        'Memuat percakapan:',
        conversation.id
      );

      const conversationBox =
        document.createElement('div');

      conversationBox.style.padding = '10px';
      conversationBox.style.marginTop = '10px';
      conversationBox.style.background = '#f5f5f5';
      conversationBox.style.borderRadius = '8px';

      const title = document.createElement('strong');

      title.textContent =
        conversation.title || 'Percakapan baru';

      conversationBox.appendChild(title);


      // MENGAMBIL PESAN

      const messagesRef = collection(
        db,
        'users',
        userId,
        'conversations',
        conversation.id,
        'messages'
      );

      const messagesSnapshot = await getDocs(
        messagesRef
      );

      console.log(
        'Jumlah pesan pada percakapan',
        conversation.id,
        ':',
        messagesSnapshot.size
      );

      const messages = [];

      messagesSnapshot.forEach((messageDoc) => {

        messages.push({
          id: messageDoc.id,
          ...messageDoc.data()
        });

      });

      messages.sort((a, b) => {

        return (a.orderTime || 0) -
          (b.orderTime || 0);

      });


      if (messages.length === 0) {

        const empty = document.createElement('p');

        empty.textContent =
          'Belum ada pesan.';

        conversationBox.appendChild(empty);
      }


      // MENAMPILKAN PESAN

      messages.forEach((message) => {

        const messageBox =
          document.createElement('p');

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

    console.log(
      'Berhasil memuat seluruh riwayat percakapan.'
    );

    return true;

  } catch (error) {

    console.error(
      'Gagal memuat riwayat:',
      error
    );

    container.textContent =
      `Gagal memuat riwayat percakapan.

Kode error: ${error.code || 'Tidak diketahui'}

Pesan: ${error.message || error}`;

    return false;
  }
}

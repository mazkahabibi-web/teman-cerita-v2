
import {
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  runTransaction
} from 'firebase/firestore';

import { db } from './firebase';

let lastMessageTime = 0;

// Mengambil profil mahasiswa dari Firestore
export async function getUserProfile(userId) {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  if (!data.name || !data.studyProgram) {
    return null;
  }

  return {
    name: data.name,
    studyProgram: data.studyProgram
  };
}

// Menyimpan profil satu kali
export async function createUserProfile(userId, profile) {
  const userRef = doc(db, 'users', userId);

  return await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);

    // Jika profil sudah ada, gunakan data lama
    if (snapshot.exists()) {
      const data = snapshot.data();

      if (!data.name || !data.studyProgram) {
        throw new Error('Profil sudah ada tetapi datanya tidak lengkap.');
      }

      return {
        name: data.name,
        studyProgram: data.studyProgram
      };
    }

    const newProfile = {
      name: String(profile.name).trim(),
      studyProgram: String(profile.studyProgram).trim(),
      createdAt: serverTimestamp()
    };

    transaction.set(userRef, newProfile);

    return {
      name: newProfile.name,
      studyProgram: newProfile.studyProgram
    };
  });
}

// Membuat percakapan baru
export async function createConversation(userId) {
  const conversationsRef = collection(
    db,
    'users',
    userId,
    'conversations'
  );

  const conversation = await addDoc(conversationsRef, {
    title: 'Percakapan baru',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return conversation.id;
}

// Menyimpan pesan
export async function saveMessage(
  userId,
  conversationId,
  sender,
  content
) {
  const messagesRef = collection(
    db,
    'users',
    userId,
    'conversations',
    conversationId,
    'messages'
  );

  const orderTime = Math.max(
    Date.now(),
    lastMessageTime + 1
  );

  lastMessageTime = orderTime;

  const docRef = await addDoc(messagesRef, {
    sender,
    content,
    orderTime,
    timestamp: serverTimestamp()
  });

  return docRef.id;
}

// Mengambil riwayat percakapan
export async function getMessages(userId, conversationId) {
  const messagesRef = collection(
    db,
    'users',
    userId,
    'conversations',
    conversationId,
    'messages'
  );

  const snapshot = await getDocs(messagesRef);

  const result = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  result.sort((a, b) => {
    const timeA =
      a.orderTime ??
      a.timestamp?.toMillis?.() ??
      0;

    const timeB =
      b.orderTime ??
      b.timestamp?.toMillis?.() ??
      0;

    return timeA - timeB || a.id.localeCompare(b.id);
  });

  if (result.length > 0) {
    const latestTime = Math.max(
      ...result.map(message =>
        message.orderTime ??
        message.timestamp?.toMillis?.() ??
        0
      )
    );

    lastMessageTime = Math.max(
      lastMessageTime,
      latestTime
    );
  }

  return result;
}

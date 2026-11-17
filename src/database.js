
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

// Mengambil profil dan memeriksa ikatan perangkat
export async function getUserProfile(userId, deviceId) {
  const userRef = doc(db, 'users', userId);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) return null;

  const data = userSnapshot.data();

  if (!data.name || !data.studyProgram || !data.deviceId) {
    throw new Error('PROFILE_DEVICE_NOT_REGISTERED');
  }

  if (data.deviceId !== deviceId) {
    throw new Error('DEVICE_MISMATCH');
  }

  const deviceRef = doc(db, 'devices', deviceId);
  const deviceSnapshot = await getDoc(deviceRef);

  if (
    !deviceSnapshot.exists() ||
    deviceSnapshot.data().uid !== userId
  ) {
    throw new Error('DEVICE_NOT_AUTHORIZED');
  }

  return {
    name: data.name,
    studyProgram: data.studyProgram,
    deviceId: data.deviceId
  };
}

// Membuat profil dan mengikat perangkat secara atomik
export async function createUserProfile(userId, profile, deviceId) {
  if (!deviceId) {
    throw new Error('DEVICE_ID_MISSING');
  }

  const userRef = doc(db, 'users', userId);
  const deviceRef = doc(db, 'devices', deviceId);

  return await runTransaction(db, async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const deviceSnapshot = await transaction.get(deviceRef);

    // Akun sudah memiliki profil
    if (userSnapshot.exists()) {
      const data = userSnapshot.data();

      if (data.deviceId !== deviceId) {
        throw new Error('DEVICE_MISMATCH');
      }

      if (
        !deviceSnapshot.exists() ||
        deviceSnapshot.data().uid !== userId
      ) {
        throw new Error('DEVICE_NOT_AUTHORIZED');
      }

      return {
        name: data.name,
        studyProgram: data.studyProgram,
        deviceId: data.deviceId
      };
    }

    // Perangkat sudah terikat dengan akun lain
    if (deviceSnapshot.exists()) {
      throw new Error('DEVICE_ALREADY_REGISTERED');
    }

    const name = String(profile.name || '').trim();
    const studyProgram = String(profile.studyProgram || '').trim();

    if (!name || !studyProgram) {
      throw new Error('PROFILE_INVALID');
    }

    transaction.set(deviceRef, {
      uid: userId,
      registeredAt: serverTimestamp()
    });

    transaction.set(userRef, {
      name,
      studyProgram,
      deviceId,
      createdAt: serverTimestamp()
    });

    return {
      name,
      studyProgram,
      deviceId
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

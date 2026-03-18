/**
 * BSTM Firebase Database Operations
 */

import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, deleteDoc, query, where, orderBy, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const FirebaseDB = {
  
  // === USERS ===
  
  async createUser(userId, userData) {
    await setDoc(doc(db, 'users', userId), userData);
  },
  
  async getUser(userId) {
    const docSnap = await getDoc(doc(db, 'users', userId));
    return docSnap.exists() ? docSnap.data() : null;
  },
  
  async updateUser(userId, updates) {
    await updateDoc(doc(db, 'users', userId), updates);
  },
  
  // === PRODUCTS ===
  
  async createProduct(productData) {
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      created_at: new Date().toISOString()
    });
    return docRef.id;
  },
  
  async getProducts(filters = {}) {
    let q = collection(db, 'products');
    
    if (filters.category) {
      q = query(q, where('category', '==', filters.category));
    }
    
    if (filters.room_id) {
      q = query(q, where('room_id', '==', filters.room_id));
    }
    
    q = query(q, where('available', '==', true), orderBy('created_at', 'desc'));
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },
  
  async getProduct(productId) {
    const docSnap = await getDoc(doc(db, 'products', productId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  },
  
  async updateProduct(productId, updates) {
    await updateDoc(doc(db, 'products', productId), updates);
  },
  
  async deleteProduct(productId) {
    await deleteDoc(doc(db, 'products', productId));
  },
  
  // === ORDERS ===
  
  async createOrder(orderData) {
    const docRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      created_at: new Date().toISOString(),
      status: 'pending'
    });
    return docRef.id;
  },
  
  async getOrders(userId) {
    const q = query(
      collection(db, 'orders'),
      where('buyer_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },
  
  async updateOrderStatus(orderId, status) {
    await updateDoc(doc(db, 'orders', orderId), {
      status: status,
      updated_at: new Date().toISOString()
    });
  },
  
  // === THB TRANSACTIONS ===
  
  async addTHBTransaction(userId, type, amount, reason) {
    await addDoc(collection(db, 'thb_transactions'), {
      user_id: userId,
      type: type,
      amount: amount,
      reason: reason,
      created_at: new Date().toISOString()
    });
    
    // Update user balance
    const user = await this.getUser(userId);
    const newBalance = (user.thb_balance || 0) + (type === 'earn' ? amount : -amount);
    await this.updateUser(userId, { thb_balance: newBalance });
    
    return newBalance;
  },
  
  async getTHBTransactions(userId) {
    const q = query(
      collection(db, 'thb_transactions'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
};

window.FirebaseDB = FirebaseDB;
export default FirebaseDB;

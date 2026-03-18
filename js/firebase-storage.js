/**
 * BSTM Firebase Storage (Image Uploads)
 */

import { storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const FirebaseStorage = {
  
  // Upload product image
  async uploadProductImage(file, productId) {
    const storageRef = ref(storage, `products/${productId}/${Date.now()}_${file.name}`);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },
  
  // Upload user avatar
  async uploadAvatar(file, userId) {
    const storageRef = ref(storage, `avatars/${userId}`);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }
  },
  
  // Upload multiple images
  async uploadMultipleImages(files, productId) {
    const uploadPromises = Array.from(files).map(file => 
      this.uploadProductImage(file, productId)
    );
    
    return await Promise.all(uploadPromises);
  }
};

window.FirebaseStorage = FirebaseStorage;
export default FirebaseStorage;

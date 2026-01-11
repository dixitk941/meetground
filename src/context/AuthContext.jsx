import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signInAnonymously,
  onAuthStateChanged,
  signOut 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInAsGuest = async (displayName) => {
    try {
      const result = await signInAnonymously(auth);
      // Store display name in local storage for anonymous users
      localStorage.setItem('guestDisplayName', displayName);
      return result.user;
    } catch (error) {
      console.error('Error signing in as guest:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('guestDisplayName');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const getDisplayName = () => {
    if (user?.displayName) return user.displayName;
    return localStorage.getItem('guestDisplayName') || 'Guest';
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInAsGuest,
    logout,
    getDisplayName,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

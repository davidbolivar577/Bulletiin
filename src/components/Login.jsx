import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.photoURL,
          createdAt: new Date()
        });
      }
      console.log("Successfully logged in as:", user.displayName);//DEBUG
    } catch (err) {
      console.error("Error during Google login:", err);
      setError("Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  //Webpage, adjust as needed
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Bulletiin</h1>
        <p>Connect with your Tiim.</p>
        
        {error && <p className="error-message">{error}</p>}
        
        <button 
          className="google-login-btn"
          onClick={handleGoogleLogin} 
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
}
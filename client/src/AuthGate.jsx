import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

// შესვლის კარიბჭე Firebase Authentication-ით (Google). ჩაირთვება მხოლოდ მაშინ, როცა
// VITE_FIREBASE_API_KEY მითითებულია (ინტერნეტში გამოსაქვეყნებელ build-ში); ლოკალურად გამორთულია.
// ნებადართული ელფოსტები: VITE_ALLOWED_EMAILS (მძიმით გამოყოფილი), იხ. client/.env.production
//
// ყურადღება: ეს მხოლოდ ინტერფეისის დაცვაა. როცა ბექენდიც გამოქვეყნდება, ის თავადაც უნდა ამოწმებდეს
// Firebase ID token-ს და ამავე სიას, თორემ API-ს პირდაპირი გამოძახებით კარიბჭე გვერდს აუვლის.
const env = import.meta.env;
const enabled = Boolean(env.VITE_FIREBASE_API_KEY);
const allowed = (env.VITE_ALLOWED_EMAILS || 'kartoziasoso@gmail.com')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const auth = enabled
  ? getAuth(initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    }))
  : null;

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = ჯერ ვამოწმებთ
  const [error, setError] = useState('');

  useEffect(() => (auth ? onAuthStateChanged(auth, setUser) : undefined), []);
  if (!enabled) return children;
  if (user === undefined) return <div className="gate"><p className="muted">იტვირთება...</p></div>;

  const ok = user && user.emailVerified && allowed.includes((user.email || '').toLowerCase());
  if (ok) {
    return (
      <>
        {children}
        <button className="signout" onClick={() => signOut(auth)} title={user.email}>გასვლა</button>
      </>
    );
  }

  const login = async () => {
    setError('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if (e.code !== 'auth/popup-closed-by-user') setError(e.message); }
  };

  return (
    <div className="gate">
      <div className="panel gate-card">
        <h1>SMS გაგზავნა</h1>
        {user ? (
          <>
            <p className="alert err">{user.email}: ამ ანგარიშს წვდომა არ აქვს.</p>
            <button onClick={() => signOut(auth)}>სხვა ანგარიშით შესვლა</button>
          </>
        ) : (
          <>
            <p className="muted">შესასვლელად გამოიყენეთ ნებადართული Google ანგარიში.</p>
            <button className="primary" onClick={login}>შესვლა Google-ით</button>
          </>
        )}
        {error && <p className="alert err">{error}</p>}
      </div>
    </div>
  );
}

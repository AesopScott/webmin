import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, getUserProfile } from '../lib/auth.js';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    return onAuthChange(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const p = await getUserProfile(user.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });
  }, []);

  const isLoading = firebaseUser === undefined;
  const isAuthed = !!firebaseUser;

  return (
    <UserContext.Provider value={{ firebaseUser, profile, isLoading, isAuthed }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

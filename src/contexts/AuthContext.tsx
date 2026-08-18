// src/contexts/AuthContext.tsx
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Role = 'admin' | 'cadastrante' | 'motorista' | 'estudante' | null;

interface UserData {
  uid: string;
  email: string | null;
  role: Role;
  nome?: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Busca o nível de acesso do usuário no Firestore
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        let role: Role = 'estudante'; // padrão
        let nome = firebaseUser.displayName || '';

        if (docSnap.exists()) {
          role = docSnap.data().role;
          nome = docSnap.data().nome || nome;
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role,
          nome,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
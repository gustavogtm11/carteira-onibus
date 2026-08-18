// src/pages/Login/index.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { Bus, GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';

export default function Login() {
  const [loadingAction, setLoadingAction] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Redireciona se já estiver logado
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'cadastrante') navigate('/cadastro');
      else if (user.role === 'motorista') navigate('/fiscal');
      else navigate('/minha-carteira');
    }
  }, [user, navigate]);

  // Login com Google e verificação de perfil
  const handleGoogleLogin = async () => {
    setLoadingAction(true);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        const whitelistRef = doc(db, 'usuarios_autorizados', result.user.email || '');
        const whitelistSnap = await getDoc(whitelistRef);

        let role = 'estudante'; 
        if (whitelistSnap.exists()) {
          role = whitelistSnap.data().role;
        }

        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          nome: result.user.displayName || 'Usuário',
          role: role,
          criadoEm: new Date()
        });
      }
    } catch (err) {
      showAlert('Erro ao fazer login com o Google. Tente novamente.', 'error');
      console.error('Erro na autenticação do Google:', err);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B2341] via-[#071629] to-[#040d18] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#395D34]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#890013]/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 relative z-10 border border-white/20 flex flex-col items-center">
        
        {/* Ícone de Destaque / Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-[#0B2341] to-[#395D34] rounded-2xl flex items-center justify-center text-white shadow-xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform">
          <Bus size={40} />
        </div>

        {/* Títulos */}
        <h1 className="text-2xl font-black text-[#0B2341] text-center tracking-tight mb-1">
          Transporte Escolar
        </h1>
        <p className="text-[#395D34] text-xs font-bold uppercase tracking-widest mb-6">
          Prefeitura Municipal
        </p>

        {/* Card Explicativo (Passo a Passo) */}
        <div className="w-full bg-blue-50/70 border border-blue-100 rounded-2xl p-4 mb-6 text-left">
          <h2 className="text-xs font-extrabold text-[#0B2341] uppercase tracking-wider mb-2 flex items-center">
            <GraduationCap size={16} className="mr-1.5 text-[#395D34]" /> Como acessar sua carteirinha:
          </h2>
          <ol className="text-xs text-gray-700 space-y-2 font-medium">
            <li className="flex items-start">
              <span className="bg-[#0B2341] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold mr-2 mt-0.5 shrink-0">1</span>
              <span>Clique no botão abaixo para entrar com sua conta Google.</span>
            </li>
            <li className="flex items-start">
              <span className="bg-[#395D34] text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold mr-2 mt-0.5 shrink-0">2</span>
              <span>Na tela seguinte, insira seu <strong>CPF</strong> para vincular seu cadastro oficial do ônibus.</span>
            </li>
          </ol>
        </div>

        {/* Botão de Login com Google */}
        <button 
          type="button"
          onClick={handleGoogleLogin}
          disabled={loadingAction}
          className="w-full flex justify-center items-center py-4 px-6 border-2 border-gray-100 rounded-2xl shadow-lg bg-white text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#395D34] disabled:opacity-70 disabled:cursor-not-allowed transition-all font-bold group"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Logo do Google" 
            className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" 
          />
          <span>{loadingAction ? 'Conectando...' : 'Entrar com Google'}</span>
          <ArrowRight size={18} className="ml-auto text-gray-400 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Rodapé do Card */}
        <div className="mt-8 flex items-center text-[11px] text-gray-400 font-medium">
          <ShieldCheck size={14} className="mr-1 text-[#395D34]" /> Sistema Seguro e Oficial da Prefeitura
        </div>

      </div>
    </div>
  );
}
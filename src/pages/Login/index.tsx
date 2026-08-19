// src/pages/Login/index.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { Bus, GraduationCap, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Truck } from 'lucide-react';

export default function Login() {
  const [tipoAcesso, setTipoAcesso] = useState<'escolha' | 'estudante' | 'motorista'>('escolha');
  
  // Estados para Google (Estudante/Admin)
  const [loadingAction, setLoadingAction] = useState(false);
  const [etapaCpfGoogle, setEtapaCpfGoogle] = useState(false);
  const [cpfInputGoogle, setCpfInputGoogle] = useState('');
  const [usuarioPendenteGoogle, setUsuarioPendenteGoogle] = useState<any>(null);

  // Estados para Motorista (CPF/Senha)
  const [cpfMotorista, setCpfMotorista] = useState('');
  const [senhaMotorista, setSenhaMotorista] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // Redirecionamento inteligente
  useEffect(() => {
    if (user) {
      const roleStr = String((user as any).role || '');
      if (roleStr === 'admin') navigate('/admin');
      else if (roleStr === 'cadastrante') navigate('/cadastro');
      else if (roleStr === 'motorista' || roleStr === 'fiscal') navigate('/fiscal');
      else navigate('/minha-carteira');
    }
  }, [user, navigate]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setter(value);
  };

  // =======================================================
  // FLUXO 1: LOGIN MOTORISTA (CPF E SENHA)
  // =======================================================
  const handleLoginMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpfMotorista || cpfMotorista.length < 14) return showAlert('Digite o CPF completo.', 'error');
    if (!senhaMotorista || senhaMotorista.length < 6) return showAlert('A senha deve ter no mínimo 6 caracteres.', 'error');

    setLoadingAction(true);
    try {
      const cpfLimpo = cpfMotorista.replace(/\D/g, '');
      const fakeEmail = `${cpfLimpo}@motorista.com`; // Truque para usar o Firebase Auth nativo
      
      // Verifica se o motorista existe no banco de dados (coleção motoristas)
      let motRef = doc(db, 'motoristas', cpfLimpo);
      let motSnap = await getDoc(motRef);
      let motoristaData = motSnap.exists() ? motSnap.data() : null;

      if (!motoristaData) {
        // Busca flexível caso o ID não seja o CPF
        const q = query(collection(db, 'motoristas'), where('cpf', '==', cpfLimpo));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          motoristaData = qSnap.docs[0].data();
          motRef = qSnap.docs[0].ref;
        }
      }

      if (!motoristaData) {
        setLoadingAction(false);
        return showAlert('Motorista não cadastrado. Procure a administração.', 'error');
      }

      // Se o motorista não tiver um UID atrelado, é o PRIMEIRO ACESSO (Cria a conta)
      if (!motoristaData.uid_vinculado) {
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, senhaMotorista);
        
        // Salva na coleção Users
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: fakeEmail,
          nome: motoristaData.nome,
          role: 'motorista',
          cpf: cpfLimpo,
          criadoEm: new Date()
        });

        // Atualiza a ficha do motorista
        await updateDoc(motRef, { uid_vinculado: cred.user.uid });

        showAlert('Senha criada com sucesso! Acesso liberado.', 'success');
        window.location.reload();
      } else {
        // JÁ POSSUI CONTA, FAZ LOGIN NORMAL
        try {
          await signInWithEmailAndPassword(auth, fakeEmail, senhaMotorista);
          showAlert('Acesso liberado!', 'success');
          window.location.reload();
        } catch (authError: any) {
          if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
            showAlert('Senha incorreta.', 'error');
          } else {
            showAlert('Erro ao autenticar motorista.', 'error');
          }
        }
      }
    } catch (error) {
      console.error(error);
      showAlert('Erro ao processar o login.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  // =======================================================
  // FLUXO 2: LOGIN GOOGLE (ESTUDANTES E ADMINS)
  // =======================================================
  const handleGoogleLogin = async () => {
    setLoadingAction(true);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().role) return;

      // Verifica se é Admin ou Fiscal na whitelist
      if (firebaseUser.email) {
        const emailLower = firebaseUser.email.trim().toLowerCase();
        const authSnap = await getDocs(collection(db, 'usuarios_autorizados'));
        let authEncontrado: any = null;
        
        authSnap.forEach(wDoc => {
          if (wDoc.id.toLowerCase() === emailLower) authEncontrado = wDoc.data();
        });

        if (authEncontrado) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nome: firebaseUser.displayName || 'Funcionário',
            role: authEncontrado.role || 'cadastrante',
            cpf: authEncontrado.cpf || '',
            criadoEm: new Date()
          }, { merge: true });

          showAlert('Acesso autorizado com sucesso!', 'success');
          window.location.reload();
          return;
        }
      }

      setUsuarioPendenteGoogle(firebaseUser);
      setEtapaCpfGoogle(true);

    } catch (err) {
      showAlert('Erro ao fazer login com o Google.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleVincularCpfGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpfInputGoogle || cpfInputGoogle.length < 14 || !usuarioPendenteGoogle) return showAlert('Digite o CPF válido.', 'error');
    setLoadingAction(true);
    
    try {
      const cpfLimpo = cpfInputGoogle.replace(/\D/g, '');
      let roleEncontrada = '';
      let nomeFinal = usuarioPendenteGoogle.displayName || 'Usuário';

      // 1. Busca Estudante
      const estRef = doc(db, 'estudantes', cpfLimpo);
      const estSnap = await getDoc(estRef);
      if (estSnap.exists()) {
        roleEncontrada = 'estudante';
        nomeFinal = estSnap.data().nome || nomeFinal;
      } else {
        // 2. Busca Usuarios Autorizados (caso erro de email)
        const authSnap = await getDocs(collection(db, 'usuarios_autorizados'));
        authSnap.forEach(wDoc => {
          if (String(wDoc.data().cpf || '').replace(/\D/g, '') === cpfLimpo) {
            roleEncontrada = wDoc.data().role || 'cadastrante';
          }
        });
      }

      if (!roleEncontrada) {
        showAlert('CPF não encontrado. Procure a prefeitura.', 'error');
        setLoadingAction(false);
        return;
      }

      await setDoc(doc(db, 'users', usuarioPendenteGoogle.uid), {
        uid: usuarioPendenteGoogle.uid,
        email: usuarioPendenteGoogle.email,
        nome: nomeFinal,
        role: roleEncontrada,
        cpf: cpfLimpo,
        criadoEm: new Date()
      }, { merge: true });

      showAlert(`Acesso liberado!`, 'success');
      window.location.reload();
    } catch (error) {
      showAlert('Erro de conexão ao vincular CPF.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B2341] via-[#071629] to-[#040d18] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#395D34]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#890013]/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 relative z-10 border border-white/20 flex flex-col items-center">
        
        <div className="w-20 h-20 bg-gradient-to-br from-[#0B2341] to-[#395D34] rounded-2xl flex items-center justify-center text-white shadow-xl mb-6 transform -rotate-3 hover:rotate-0 transition-transform">
          <Bus size={40} />
        </div>

        <h1 className="text-2xl font-black text-[#0B2341] text-center tracking-tight mb-1">
          Transporte Escolar
        </h1>
        <p className="text-[#395D34] text-xs font-bold uppercase tracking-widest mb-6">
          Prefeitura Municipal
        </p>

        {tipoAcesso === 'escolha' && (
          <div className="w-full space-y-4 animate-in fade-in zoom-in-95">
            <button 
              onClick={() => setTipoAcesso('estudante')}
              className="w-full flex justify-center items-center py-4 px-6 border-2 border-gray-200 rounded-2xl shadow-sm bg-white text-[#0B2341] hover:border-[#0B2341] hover:bg-gray-50 transition-all font-bold group"
            >
              <GraduationCap size={22} className="mr-3 text-[#0B2341]" />
              <div className="text-left flex-1">
                <span className="block leading-tight">Sou Estudante / Admin</span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wide">Acesso via Google</span>
              </div>
              <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={() => setTipoAcesso('motorista')}
              className="w-full flex justify-center items-center py-4 px-6 border-2 border-gray-200 rounded-2xl shadow-sm bg-white text-[#395D34] hover:border-[#395D34] hover:bg-gray-50 transition-all font-bold group"
            >
              <Truck size={22} className="mr-3 text-[#395D34]" />
              <div className="text-left flex-1">
                <span className="block leading-tight">Sou Motorista / Fiscal</span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wide">Acesso via CPF e Senha</span>
              </div>
              <ArrowRight size={18} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ----------------- TELA DO ESTUDANTE / ADMIN ----------------- */}
        {tipoAcesso === 'estudante' && !etapaCpfGoogle && (
          <div className="w-full animate-in slide-in-from-right-4">
            <button onClick={() => setTipoAcesso('escolha')} className="text-[#890013] text-xs font-bold mb-4 flex items-center hover:underline">
               Voltar
            </button>
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loadingAction}
              className="w-full flex justify-center items-center py-4 px-6 border-2 border-gray-100 rounded-2xl shadow-lg bg-white text-gray-800 hover:bg-gray-50 transition-all font-bold group disabled:opacity-50"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform" />
              <span>{loadingAction ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>
          </div>
        )}

        {tipoAcesso === 'estudante' && etapaCpfGoogle && (
          <form onSubmit={handleVincularCpfGoogle} className="w-full space-y-4 animate-in fade-in">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-left mb-2">
              <p className="text-xs font-bold text-yellow-800 flex items-center mb-1"><AlertCircle size={16} className="mr-1.5" /> Confirmação</p>
              <p className="text-xs text-yellow-700">Digite seu <strong>CPF</strong> para validar a carteirinha.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0B2341] uppercase mb-1">Seu CPF</label>
              <input type="text" required value={cpfInputGoogle} onChange={(e) => handleCpfChange(e, setCpfInputGoogle)} placeholder="000.000.000-00" className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold text-[#0B2341] outline-none focus:border-[#395D34]" />
            </div>
            <button type="submit" disabled={loadingAction} className="w-full flex justify-center items-center py-3.5 px-6 rounded-xl bg-[#0B2341] text-white hover:bg-[#071629] font-bold shadow-md transition disabled:opacity-50">
              <CheckCircle2 size={18} className="mr-2" /> <span>{loadingAction ? 'Verificando...' : 'Acessar Carteira'}</span>
            </button>
          </form>
        )}

        {/* ----------------- TELA DO MOTORISTA ----------------- */}
        {tipoAcesso === 'motorista' && (
          <form onSubmit={handleLoginMotorista} className="w-full space-y-4 animate-in slide-in-from-right-4">
            <button type="button" onClick={() => setTipoAcesso('escolha')} className="text-[#890013] text-xs font-bold mb-2 flex items-center hover:underline">
               Voltar
            </button>
            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-left">
              <p className="text-[11px] text-gray-700 font-medium leading-tight">
                <strong>Primeiro acesso?</strong> Digite seu CPF e crie uma senha. Ela será sua senha oficial a partir de agora.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0B2341] uppercase mb-1">CPF (Somente Números)</label>
              <input type="text" required value={cpfMotorista} onChange={(e) => handleCpfChange(e, setCpfMotorista)} placeholder="000.000.000-00" className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold text-[#0B2341] outline-none focus:border-[#395D34]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0B2341] uppercase mb-1">Senha (Mín. 6 letras/números)</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 text-gray-400" size={18} />
                <input type="password" required value={senhaMotorista} onChange={(e) => setSenhaMotorista(e.target.value)} placeholder="••••••" className="w-full pl-10 bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold text-[#0B2341] outline-none focus:border-[#395D34]" />
              </div>
            </div>
            <button type="submit" disabled={loadingAction} className="w-full flex justify-center items-center py-3.5 px-6 rounded-xl bg-[#395D34] text-white hover:bg-[#2c4928] font-bold shadow-md transition disabled:opacity-50 mt-2">
              <span>{loadingAction ? 'Entrando...' : 'Entrar no Sistema'}</span> <ArrowRight size={18} className="ml-2" />
            </button>
          </form>
        )}

        <div className="mt-8 flex items-center text-[11px] text-gray-400 font-medium">
          <ShieldCheck size={14} className="mr-1 text-[#395D34]" /> Sistema Seguro e Oficial da Prefeitura
        </div>

      </div>
    </div>
  );
}
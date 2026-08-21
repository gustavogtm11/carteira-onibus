// src/pages/Login/index.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, googleProvider, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { Bus, GraduationCap, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, KeyRound, Truck, Info } from 'lucide-react';

export default function Login() {
  const [tipoAcesso, setTipoAcesso] = useState<'escolha' | 'estudante' | 'motorista'>('escolha');
  const [lgpdAceito, setLgpdAceito] = useState(localStorage.getItem('lgpd_aceito') === 'true');
  
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

  useEffect(() => {
    const cachedKey = Object.keys(localStorage).find(k => k.startsWith('cache_estudante_'));
    if (cachedKey) {
      navigate('/minha-carteira');
      return;
    }

    if (user) {
      const roleStr = String((user as any).role || '');
      if (roleStr === 'admin') navigate('/admin');
      else if (roleStr === 'cadastrante') navigate('/cadastro');
      else if (roleStr === 'motorista' || roleStr === 'fiscal') navigate('/fiscal');
      else navigate('/minha-carteira');
    }
  }, [user, navigate]);

  const aceitarLGPD = () => {
    localStorage.setItem('lgpd_aceito', 'true');
    setLgpdAceito(true);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setter(value);
  };

  const handleLoginMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpfMotorista || cpfMotorista.length < 14) return showAlert('Digite o CPF completo.', 'error');
    if (!senhaMotorista || senhaMotorista.length < 6) return showAlert('A senha deve ter no mínimo 6 caracteres.', 'error');

    setLoadingAction(true);
    try {
      const cpfLimpo = cpfMotorista.replace(/\D/g, '');
      const fakeEmail = `${cpfLimpo}@motorista.com`; 
      
      let motRef = doc(db, 'motoristas', cpfLimpo);
      let motSnap = await getDoc(motRef);
      let motoristaData = motSnap.exists() ? motSnap.data() : null;

      if (!motoristaData) {
        const q = query(collection(db, 'motoristas'), where('cpf', '==', btoa(cpfLimpo)));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          motoristaData = qSnap.docs[0].data();
          motRef = qSnap.docs[0].ref;
        } else {
          const qLegacy = query(collection(db, 'motoristas'), where('cpf', '==', cpfLimpo));
          const qLegacySnap = await getDocs(qLegacy);
          if (!qLegacySnap.empty) {
            motoristaData = qLegacySnap.docs[0].data();
            motRef = qLegacySnap.docs[0].ref;
          }
        }
      }

      if (!motoristaData) {
        setLoadingAction(false);
        return showAlert('Motorista não cadastrado. Procure a administração.', 'error');
      }

      if (!motoristaData.uid_vinculado) {
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, senhaMotorista);
        
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: fakeEmail,
          nome: motoristaData.nome,
          role: 'motorista',
          cpf: cpfLimpo,
          criadoEm: new Date()
        });

        await updateDoc(motRef, { uid_vinculado: cred.user.uid });

        showAlert('Senha criada com sucesso! Acesso liberado.', 'success');
        window.location.reload();
      } else {
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

  const handleGoogleLogin = async () => {
    setLoadingAction(true);
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().role) return;

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

    } catch {
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
      const cpfHash = btoa(cpfLimpo);
      let roleEncontrada = '';
      let nomeFinal = usuarioPendenteGoogle.displayName || 'Usuário';

      const qEstudante = query(collection(db, 'estudantes'), where('cpf_hash', '==', cpfHash));
      const snapEstudante = await getDocs(qEstudante);
      
      let estudanteDocId = cpfLimpo;

      if (!snapEstudante.empty) {
        roleEncontrada = 'estudante';
        estudanteDocId = snapEstudante.docs[0].id;
        const dadosAluno = snapEstudante.docs[0].data();
        nomeFinal = dadosAluno.nome || nomeFinal;
        localStorage.setItem(`cache_estudante_${cpfLimpo}`, JSON.stringify(dadosAluno));
      } else {
        const estRef = doc(db, 'estudantes', cpfLimpo);
        const estSnap = await getDoc(estRef);
        if (estSnap.exists()) {
          roleEncontrada = 'estudante';
          nomeFinal = estSnap.data().nome || nomeFinal;
          localStorage.setItem(`cache_estudante_${cpfLimpo}`, JSON.stringify(estSnap.data()));
        } else {
          const authSnap = await getDocs(collection(db, 'usuarios_autorizados'));
          authSnap.forEach(wDoc => {
            if (String(wDoc.data().cpf || '').replace(/\D/g, '') === cpfLimpo) {
              roleEncontrada = wDoc.data().role || 'cadastrante';
            }
          });
        }
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
        id_estudante: estudanteDocId,
        criadoEm: new Date()
      }, { merge: true });

      showAlert(`Acesso liberado!`, 'success');
      window.location.reload();
    } catch {
      showAlert('Erro de conexão ao vincular CPF.', 'error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B2341] via-[#071629] to-[#040d18] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#395D34]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#890013]/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 relative z-10 border border-white/20 flex flex-col items-center mb-16">
        
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
              <input 
                type="tel" 
                inputMode="numeric" 
                required 
                value={cpfInputGoogle} 
                onChange={(e) => handleCpfChange(e, setCpfInputGoogle)} 
                placeholder="000.000.000-00" 
                maxLength={14}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold text-[#0B2341] outline-none focus:border-[#395D34]" 
              />
            </div>
            <button type="submit" disabled={loadingAction} className="w-full flex justify-center items-center py-3.5 px-6 rounded-xl bg-[#0B2341] text-white hover:bg-[#071629] font-bold shadow-md transition disabled:opacity-50">
              <CheckCircle2 size={18} className="mr-2" /> <span>{loadingAction ? 'Verificando...' : 'Acessar Carteira'}</span>
            </button>
          </form>
        )}

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
              <input 
                type="tel" 
                inputMode="numeric" 
                required 
                value={cpfMotorista} 
                onChange={(e) => handleCpfChange(e, setCpfMotorista)} 
                placeholder="000.000.000-00" 
                maxLength={14}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm font-bold text-[#0B2341] outline-none focus:border-[#395D34]" 
              />
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
          <ShieldCheck size={14} className="mr-1 text-[#395D34]" /> Ambiente Seguro (Criptografia Padrão)
        </div>
      </div>

      {!lgpdAceito && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-4 flex flex-col md:flex-row items-center justify-between z-50 animate-in slide-in-from-bottom-10 border-t-4 border-[#395D34]">
          <div className="flex items-center mb-3 md:mb-0">
            <Info size={24} className="text-[#0B2341] mr-3 shrink-0" />
            <p className="text-sm text-gray-700 font-medium text-center md:text-left">
              <strong>Privacidade e LGPD:</strong> Utilizamos seus dados apenas para gestão do transporte escolar, com segurança garantida pelo Firebase. Ao continuar, você concorda com nossos termos.
            </p>
          </div>
          <button 
            onClick={aceitarLGPD}
            className="w-full md:w-auto whitespace-nowrap bg-[#395D34] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-[#2c4928] transition shadow-md"
          >
            Entendi e Aceito
          </button>
        </div>
      )}
    </div>
  );
}
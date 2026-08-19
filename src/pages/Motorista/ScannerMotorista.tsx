// src/pages/Motorista/ScannerMotorista.tsx
import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { BusFront, CheckCircle, XCircle, LogOut, ScanLine, AlertTriangle, Clock } from 'lucide-react';

interface EstudanteScan {
  id_estudante: string;
  nome: string;
  foto_url: string;
  instituicao: string;
  curso: string;
  turno: string;
  rota_aluno: string;
  vencimento?: string;
}

export default function ScannerMotorista() {
  const { user } = useAuth();
  
  // Tratamento seguro de tipagem para o usuário e suas roles
  const userAny = user as any;
  const roleStr = String(userAny?.role || '');
  const isFiscal = roleStr === 'fiscal';
  const isAdmin = roleStr === 'admin';
  const isMotorista = roleStr === 'motorista';
  const userCpf = userAny?.cpf ? String(userAny.cpf).replace(/\D/g, '') : '';

  // Configurações da viagem atual
  const [rotasDisponiveis, setRotasDisponiveis] = useState<string[]>([]);
  const [rotaAtual, setRotaAtual] = useState('');
  
  // Sentido Manual e Horários Configuráveis
  const [tipoViagem, setTipoViagem] = useState<'ida' | 'volta'>('ida');
  const [horaIda, setHoraIda] = useState(localStorage.getItem('horaIda') || '06:00');
  const [horaVolta, setHoraVolta] = useState(localStorage.getItem('horaVolta') || '12:00');
  
  // Estados do Scanner e Confirmação
  const [estudante, setEstudante] = useState<EstudanteScan | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error' | 'loading' | 'confirmacao'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [estudantePendente, setEstudantePendente] = useState<{ dados: any, sentido: 'ida' | 'volta' } | null>(null);
  
  const isProcessingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('horaIda', horaIda);
    localStorage.setItem('horaVolta', horaVolta);
  }, [horaIda, horaVolta]);

  // Busca de rotas garantida utilizando o CPF limpo do motorista
  useEffect(() => {
    const buscarRotas = async () => {
      if (!user) return;
      try {
        let q;

        if (isFiscal || isAdmin) {
          q = collection(db, 'rotas');
        } else if (userCpf) {
          q = query(collection(db, 'rotas'), where('motorista_cpf', '==', userCpf));
        } else {
          q = query(collection(db, 'rotas'), where('motorista_cpf', '==', ''));
        }
        
        const snap = await getDocs(q);
        let lista = snap.docs.map(d => d.data().nome_rota as string);
        
        // Fallback para rotas legadas vinculadas por e-mail ou nome de motorista
        if (lista.length === 0 && isMotorista && user.email) {
          const snapLegado = await getDocs(query(collection(db, 'rotas'), where('motorista_email', '==', user.email)));
          lista = snapLegado.docs.map(d => d.data().nome_rota as string);
        }

        setRotasDisponiveis(lista);
        if (lista.length > 0) setRotaAtual(lista[0]);
      } catch (error) {
        console.error("Erro ao buscar rotas", error);
      }
    };
    buscarRotas();
  }, [user, isFiscal, isAdmin, isMotorista, userCpf]);

  const isHorarioProximo = (horarioAlvo: string, margemMinutos: number) => {
    if (!horarioAlvo) return false;
    const [hora, min] = horarioAlvo.split(':').map(Number);
    const agora = new Date();
    const alvo = new Date();
    alvo.setHours(hora, min, 0, 0);
    const diffEmMinutos = Math.abs(agora.getTime() - alvo.getTime()) / (1000 * 60);
    return diffEmMinutos <= margemMinutos;
  };

  const registrarViagem = async (dadosEstudante: any, sentido: 'ida' | 'volta', isExata: boolean) => {
    await addDoc(collection(db, 'historico_viagens'), {
      id_estudante: dadosEstudante.id_estudante,
      nome_estudante: dadosEstudante.nome,
      id_motorista: user?.uid || '',
      nome_motorista: userAny?.nome || user?.email || '',
      id_rota_onibus: rotaAtual, 
      rota_original_aluno: dadosEstudante.rota, 
      tipo_viagem: sentido,
      data_hora: new Date(),
      acesso_universal: !isExata,
      autorizado_por_fiscal: isFiscal
    });

    setEstudante({
      id_estudante: dadosEstudante.id_estudante,
      nome: dadosEstudante.nome,
      foto_url: dadosEstudante.foto_url,
      instituicao: dadosEstudante.instituicao_destino || '-',
      curso: dadosEstudante.curso || '-',
      turno: dadosEstudante.turno || '-',
      rota_aluno: dadosEstudante.rota || '-',
      vencimento: dadosEstudante.data_vencimento
    });

    setStatus(isExata ? 'success' : 'warning');
    setMensagem(isExata ? `Embarque Autorizado!` : 'Acesso Excepcional Liberado');

    setTimeout(() => {
      setStatus('idle');
      setEstudante(null);
      setMensagem('');
      isProcessingRef.current = false;
    }, 3500);
  };

  useEffect(() => {
    const scanner = new Html5QrcodeScanner("qr-reader", { fps: 15, qrbox: { width: 250, height: 250 } }, false);

    const onScanSuccess = async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setStatus('loading');

      try {
        const estudanteSnap = await getDoc(doc(db, 'estudantes', decodedText));

        if (estudanteSnap.exists()) {
          const dadosEstudante = estudanteSnap.data();

          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          let estaVencido = false;
          if (dadosEstudante.data_vencimento) {
            const dataVenc = new Date(`${dadosEstudante.data_vencimento}T12:00:00`); 
            dataVenc.setHours(23, 59, 59, 999);
            if (hoje > dataVenc) estaVencido = true;
          }

          if (estaVencido) {
            setStatus('error');
            setMensagem('ACESSO NEGADO: Carteira Vencida!');
            setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 4000);
            return;
          }

          let sentidoCalculado = tipoViagem;
          if (isHorarioProximo(horaIda, 45)) sentidoCalculado = 'ida';
          else if (isHorarioProximo(horaVolta, 45)) sentidoCalculado = 'volta';
          setTipoViagem(sentidoCalculado);

          const isRotaExata = dadosEstudante.rota === rotaAtual;

          if (isRotaExata) {
            await registrarViagem(dadosEstudante, sentidoCalculado, true);
          } else {
            setEstudantePendente({ dados: dadosEstudante, sentido: sentidoCalculado });
            setStatus('confirmacao');
          }
        } else {
          setStatus('error');
          setMensagem('Estudante Não Encontrado.');
          setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 3500);
        }
      } catch (error) {
        setStatus('error');
        setMensagem('Erro de conexão ao validar qr code.');
        setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 3500);
      }
    };

    scanner.render(onScanSuccess, () => {});
    return () => { scanner.clear().catch(console.error); };
  }, [rotaAtual, horaIda, horaVolta, tipoViagem, user]);

  const confirmarEmbarque = async () => {
    if (!estudantePendente) return;
    setStatus('loading');
    await registrarViagem(estudantePendente.dados, estudantePendente.sentido, false);
    setEstudantePendente(null);
  };

  const negarEmbarque = () => {
    setStatus('error');
    setMensagem('Embarque Negado (Rota Incorreta).');
    setEstudantePendente(null);
    setTimeout(() => {
      setStatus('idle');
      setMensagem('');
      isProcessingRef.current = false;
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans">
      
      <nav className="bg-[#0B2341] text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center">
          <div className="bg-white/10 p-2 rounded-lg mr-3"><BusFront size={24} className="text-white" /></div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Leitor de Embarque</h1>
            <p className="text-[10px] text-gray-300 font-mono tracking-wider">
              {isFiscal ? 'Fiscal' : 'Motorista'}: {user?.email}
            </p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-white/80 p-2 hover:bg-[#890013] hover:text-white rounded-full transition-colors"><LogOut size={22} /></button>
      </nav>

      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        
        <div className="bg-white p-5 rounded-2xl mb-6 shadow-md border border-gray-200">
          <div className="mb-4">
            <label className="block text-xs font-bold text-[#0B2341] uppercase tracking-wider mb-2">Selecione a Rota de Operação</label>
            <select 
              value={rotaAtual} 
              onChange={e => setRotaAtual(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-800 font-bold focus:outline-none focus:border-[#395D34] appearance-none"
            >
              {rotasDisponiveis.length === 0 ? <option value="">Nenhuma rota atribuída ao seu CPF</option> : rotasDisponiveis.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-center text-[#0B2341] text-xs font-bold uppercase tracking-wider mb-3">
              <Clock size={14} className="mr-1.5"/> Auto-Detecção de Sentido
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1">HORA IDA</label>
                <input type="time" value={horaIda} onChange={e => setHoraIda(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1">HORA VOLTA</label>
                <input type="time" value={horaVolta} onChange={e => setHoraVolta(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] outline-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sentido (Manual)</label>
            <div className="flex gap-3">
              <button onClick={() => setTipoViagem('ida')} className={`flex-1 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${tipoViagem === 'ida' ? 'bg-[#395D34] border-[#395D34] text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>IDA</button>
              <button onClick={() => setTipoViagem('volta')} className={`flex-1 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${tipoViagem === 'volta' ? 'bg-[#0B2341] border-[#0B2341] text-white shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>VOLTA</button>
            </div>
          </div>
        </div>

        <div className={`bg-black rounded-2xl overflow-hidden shadow-xl mb-6 relative border-[4px] transition-all duration-300
          ${status === 'success' ? 'border-[#395D34]' : status === 'warning' || status === 'confirmacao' ? 'border-yellow-500' : status === 'error' ? 'border-[#890013]' : 'border-[#0B2341]'}`}
        >
          {status === 'loading' && (
            <div className="absolute inset-0 bg-[#0B2341]/90 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-bold text-white tracking-widest uppercase text-sm">Validando...</p>
            </div>
          )}
          <div id="qr-reader" className="w-full text-black bg-black" style={{ display: status === 'confirmacao' ? 'none' : 'block' }}></div>
          
          {status === 'confirmacao' && estudantePendente && (
            <div className="absolute inset-0 bg-yellow-500 text-gray-900 flex flex-col items-center justify-center p-6 z-20">
              <AlertTriangle size={50} className="mb-2 text-yellow-900 animate-pulse" />
              <h2 className="font-black text-xl text-center mb-1 uppercase tracking-tight">Rota Diferente!</h2>
              <div className="bg-white/50 rounded-xl p-3 w-full text-center mb-4 mt-2">
                <p className="text-sm font-bold text-gray-800">{estudantePendente.dados.nome}</p>
                <p className="text-xs text-yellow-900 font-bold mt-1 uppercase">Matriculado em: {estudantePendente.dados.rota}</p>
              </div>
              <p className="text-center font-bold mb-4 text-sm w-full leading-tight">Deseja autorizar embarque na rota {rotaAtual}?</p>
              
              <div className="flex gap-3 w-full">
                <button onClick={negarEmbarque} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-md transition">Negar</button>
                <button onClick={confirmarEmbarque} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-md transition">Autorizar</button>
              </div>
            </div>
          )}
        </div>

        {status === 'success' && estudante && (
          <div className="bg-[#395D34] text-white p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <img src={estudante.foto_url} alt="Foto" className="w-16 h-16 rounded-xl border-2 border-white/50 object-cover mr-4 bg-gray-100" />
            <div className="flex-1 overflow-hidden">
              <h2 className="font-black text-lg leading-tight truncate">{estudante.nome}</h2>
              <p className="text-green-100 text-[10px] font-bold uppercase">{estudante.instituicao}</p>
              <div className="mt-1 inline-flex items-center bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                <CheckCircle size={10} className="mr-1"/> Salvo Automático
              </div>
            </div>
          </div>
        )}

        {status === 'warning' && estudante && (
          <div className="bg-yellow-500 text-gray-900 p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <img src={estudante.foto_url} alt="Foto" className="w-16 h-16 rounded-xl border-2 border-gray-900/20 object-cover mr-4 bg-gray-100" />
            <div className="flex-1 overflow-hidden">
              <h2 className="font-black text-lg leading-tight truncate">{estudante.nome}</h2>
              <p className="text-yellow-900 text-[10px] font-bold uppercase bg-yellow-400 rounded px-1 w-fit mt-1">
                Acesso Excepcional
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-[#890013] text-white p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <XCircle size={30} className="mr-3 shrink-0" />
            <div>
              <h2 className="font-black text-lg leading-tight">Bloqueado</h2>
              <p className="text-red-100 text-xs font-bold">{mensagem}</p>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-center text-gray-500 mt-2 flex flex-col items-center justify-center flex-1">
            <ScanLine size={40} className="mb-2 opacity-30 text-[#0B2341]" />
            <p className="font-medium text-sm">Aponte a câmera para liberar embarque.</p>
          </div>
        )}

      </div>
    </div>
  );
}
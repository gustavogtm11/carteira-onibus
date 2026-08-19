// src/pages/Motorista/ScannerMotorista.tsx
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
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
  
  const userAny = user as any;
  const roleStr = String(userAny?.role || '');
  const isFiscal = roleStr === 'fiscal';
  const isAdmin = roleStr === 'admin';
  const isMotorista = roleStr === 'motorista';
  const userCpf = userAny?.cpf ? String(userAny.cpf).replace(/\D/g, '') : '';

  const [rotasDisponiveis, setRotasDisponiveis] = useState<string[]>([]);
  const [rotaAtual, setRotaAtual] = useState('');
  
  const [tipoViagem, setTipoViagem] = useState<'ida' | 'volta'>('ida');
  const [horaIda, setHoraIda] = useState(localStorage.getItem('horaIda') || '06:00');
  const [horaVolta, setHoraVolta] = useState(localStorage.getItem('horaVolta') || '12:00');
  
  const [estudante, setEstudante] = useState<EstudanteScan | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error' | 'loading' | 'confirmacao'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [estudantePendente, setEstudantePendente] = useState<{ dados: any, sentido: 'ida' | 'volta' } | null>(null);
  
  const isProcessingRef = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    localStorage.setItem('horaIda', horaIda);
    localStorage.setItem('horaVolta', horaVolta);
  }, [horaIda, horaVolta]);

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

    // Tempo de exibição do card na tela antes de voltar a escanear automaticamente
    setTimeout(() => {
      setStatus('idle');
      setEstudante(null);
      setMensagem('');
      isProcessingRef.current = false;
    }, 2500);
  };

  // Inicializa a câmera e garante que ela fica ativa continuamente
  useEffect(() => {
    const readerId = "qr-reader-container";
    const html5QrCode = new Html5Qrcode(readerId);
    html5QrCodeRef.current = html5QrCode;

    const config = { fps: 15, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = async (decodedText: string) => {
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
            setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 3000);
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
          setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 3000);
        }
      } catch (error) {
        setStatus('error');
        setMensagem('Erro de conexão ao validar qr code.');
        setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 3000);
      }
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      qrCodeSuccessCallback,
      () => {}
    ).catch((err) => {
      console.warn("Tentando iniciar com câmera padrão (fallback)...", err);
      html5QrCode.start(
        { facingMode: "user" },
        config,
        qrCodeSuccessCallback,
        () => {}
      ).catch(e => console.error("Erro crítico ao abrir câmera:", e));
    });

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [rotaAtual, horaIda, horaVolta, tipoViagem]);

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
    }, 2500);
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
            <label className="block text-xs font-bold text-[#0B2341] uppercase tracking-wider mb-2">Seu Veículo / Rota de Operação</label>
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

        {/* Caixa da Câmera (Sempre visível ao fundo) */}
        <div className={`bg-black rounded-2xl overflow-hidden shadow-xl mb-6 relative border-[4px] transition-all duration-300
          ${status === 'success' ? 'border-[#395D34]' : status === 'warning' || status === 'confirmacao' ? 'border-yellow-500' : status === 'error' ? 'border-[#890013]' : 'border-[#0B2341]'}`}
        >
          {/* Contêiner da Câmera ativo permanentemente */}
          <div id="qr-reader-container" className="w-full text-black bg-black overflow-hidden"></div>

          {/* Loading rápido sobre a câmera */}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-[#0B2341]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="font-bold text-white tracking-widest uppercase text-xs">Validando...</p>
            </div>
          )}

          {/* Card de Confirmação de Rota Diferente */}
          {status === 'confirmacao' && estudantePendente && (
            <div className="absolute inset-0 bg-yellow-500 text-gray-900 flex flex-col items-center justify-center p-6 z-30">
              <AlertTriangle size={45} className="mb-2 text-yellow-900 animate-pulse" />
              <h2 className="font-black text-lg text-center mb-1 uppercase tracking-tight">Rota Diferente!</h2>
              <div className="bg-white/60 rounded-xl p-3 w-full text-center mb-3 mt-1">
                <p className="text-sm font-bold text-gray-800">{estudantePendente.dados.nome}</p>
                <p className="text-xs text-yellow-900 font-bold mt-0.5 uppercase">Matriculado em: {estudantePendente.dados.rota}</p>
              </div>
              <p className="text-center font-bold mb-4 text-xs w-full leading-tight">Deseja autorizar embarque na rota {rotaAtual}?</p>
              
              <div className="flex gap-3 w-full">
                <button onClick={negarEmbarque} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold shadow transition text-sm">Negar</button>
                <button onClick={confirmarEmbarque} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold shadow transition text-sm">Autorizar</button>
              </div>
            </div>
          )}

          {/* Card Flutuante de SUCESSO (Aparece e some rápido sem fechar a câmera) */}
          {status === 'success' && estudante && (
            <div className="absolute inset-x-3 bottom-3 bg-[#395D34] text-white p-4 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-3 border-2 border-white/30">
              <img src={estudante.foto_url} alt="Foto" className="w-14 h-14 rounded-xl border-2 border-white/50 object-cover mr-3 bg-gray-100 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <h2 className="font-black text-base leading-tight truncate">{estudante.nome}</h2>
                <p className="text-green-100 text-[10px] font-bold uppercase truncate">{estudante.instituicao}</p>
                <div className="mt-1 inline-flex items-center bg-white/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                  <CheckCircle size={10} className="mr-1"/> Embarque Confirmado
                </div>
              </div>
            </div>
          )}

          {/* Card Flutuante de AVISO / EXCEPCIONAL */}
          {status === 'warning' && estudante && (
            <div className="absolute inset-x-3 bottom-3 bg-yellow-500 text-gray-900 p-4 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-3 border-2 border-white/30">
              <img src={estudante.foto_url} alt="Foto" className="w-14 h-14 rounded-xl border-2 border-gray-900/20 object-cover mr-3 bg-gray-100 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <h2 className="font-black text-base leading-tight truncate">{estudante.nome}</h2>
                <p className="text-yellow-900 text-[10px] font-bold uppercase bg-yellow-400 rounded px-1.5 py-0.5 w-fit mt-1">
                  Acesso Excepcional Liberado
                </p>
              </div>
            </div>
          )}

          {/* Card Flutuante de ERRO / BLOQUEADO */}
          {status === 'error' && mensagem && (
            <div className="absolute inset-x-3 bottom-3 bg-[#890013] text-white p-4 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-3 border-2 border-white/30">
              <XCircle size={28} className="mr-3 shrink-0" />
              <div>
                <h2 className="font-black text-sm leading-tight">Acesso Negado</h2>
                <p className="text-red-100 text-xs font-medium">{mensagem}</p>
              </div>
            </div>
          )}
        </div>

        {status === 'idle' && (
          <div className="text-center text-gray-500 mt-1 flex items-center justify-center">
            <ScanLine size={18} className="mr-1.5 opacity-40 text-[#0B2341] animate-pulse" />
            <p className="font-medium text-xs">Câmera ativa. Posicione o QR Code no quadrado.</p>
          </div>
        )}

      </div>
    </div>
  );
}
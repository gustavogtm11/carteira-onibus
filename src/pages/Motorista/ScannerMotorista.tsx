// src/pages/Motorista/ScannerMotorista.tsx
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { BusFront, CheckCircle, XCircle, LogOut, ScanLine, AlertTriangle, MapPin, Users, X } from 'lucide-react';

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
  
  // Localização e Controle de Faltantes
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [alunosNaRota, setAlunosNaRota] = useState<any[]>([]);
  const [embarcadosHoje, setEmbarcadosHoje] = useState<Set<string>>(new Set());
  const [showFaltantes, setShowFaltantes] = useState(false);

  const isProcessingRef = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Monitorar GPS continuamente para maior precisão na hora do scan
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn("Aviso de GPS:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    localStorage.setItem('horaIda', horaIda);
    localStorage.setItem('horaVolta', horaVolta);
  }, [horaIda, horaVolta]);

  // Busca de rotas
  useEffect(() => {
    const buscarRotas = async () => {
      if (!user) return;
      try {
        let q;
        // Fiscal e Admin veem todas as rotas, Motorista apenas as dele
        if (isFiscal || isAdmin) {
          q = collection(db, 'rotas');
        } else if (userCpf) {
          q = query(collection(db, 'rotas'), where('motorista_cpf', '==', userCpf));
        } else {
          q = query(collection(db, 'rotas'), where('motorista_cpf', '==', ''));
        }
        
        const snap = await getDocs(q);
        let lista = snap.docs.map(d => d.data().nome_rota as string);
        
        // Fallback para legado
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

  // Buscar alunos da rota atual e quem já embarcou hoje
  useEffect(() => {
    const carregarControleDeEmbarque = async () => {
      if (!rotaAtual) return;
      try {
        // 1. Busca TODOS os estudantes (filtramos localmente para evitar erros de maiúscula/minúscula)
        const snapEstudantes = await getDocs(collection(db, 'estudantes'));
        const rotaLimpa = rotaAtual.trim().toLowerCase();
        
        const alunosFiltrados = snapEstudantes.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter((a: any) => String(a.rota || '').trim().toLowerCase() === rotaLimpa);
        
        setAlunosNaRota(alunosFiltrados);

        // 2. Busca histórico de hoje para a rota e sentido (Ida ou Volta)
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const qHist = query(
          collection(db, 'historico_viagens'),
          where('id_rota_onibus', '==', rotaAtual),
          where('tipo_viagem', '==', tipoViagem),
          where('data_hora', '>=', hoje)
        );
        const snapHist = await getDocs(qHist);
        
        const idsEmbarcados = new Set(snapHist.docs.map(d => d.data().id_estudante));
        setEmbarcadosHoje(idsEmbarcados);
      } catch (error) {
        console.error("Erro ao carregar lista de faltantes:", error);
      }
    };
    
    carregarControleDeEmbarque();
  }, [rotaAtual, tipoViagem]);

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
    let linkMaps = '';
    if (coords) {
      linkMaps = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    }

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
      autorizado_por_fiscal: isFiscal,
      link_maps: linkMaps
    });

    // Atualiza a lista de embarcados na tela instantaneamente
    setEmbarcadosHoje(prev => new Set(prev).add(dadosEstudante.id_estudante));

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
    }, 2000);
  };

  useEffect(() => {
    const readerId = "qr-reader-container";
    const html5QrCode = new Html5Qrcode(readerId);
    html5QrCodeRef.current = html5QrCode;

    // Configuração para deixar o leitor um pouco menor e processar rápido
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };

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
            setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 2500);
            return;
          }

          let sentidoCalculado = tipoViagem;
          if (isHorarioProximo(horaIda, 45)) sentidoCalculado = 'ida';
          else if (isHorarioProximo(horaVolta, 45)) sentidoCalculado = 'volta';
          setTipoViagem(sentidoCalculado);

          // Validação super restrita limpando os textos
          const rotaAlunoLimpa = String(dadosEstudante.rota || '').trim().toLowerCase();
          const rotaAtualLimpa = String(rotaAtual || '').trim().toLowerCase();
          const isRotaExata = rotaAlunoLimpa === rotaAtualLimpa;

          if (isRotaExata) {
            await registrarViagem(dadosEstudante, sentidoCalculado, true);
          } else {
            setEstudantePendente({ dados: dadosEstudante, sentido: sentidoCalculado });
            setStatus('confirmacao');
          }
        } else {
          setStatus('error');
          setMensagem('Estudante Não Encontrado.');
          setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 2500);
        }
      } catch (error) {
        setStatus('error');
        setMensagem('Erro ao ler QR Code.');
        setTimeout(() => { setStatus('idle'); isProcessingRef.current = false; }, 2500);
      }
    };

    html5QrCode.start(
      { facingMode: "environment" },
      config,
      qrCodeSuccessCallback,
      () => {}
    ).catch((err) => {
      console.warn("Câmera traseira falhou, usando a padrão...", err);
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
  }, [rotaAtual, horaIda, horaVolta, tipoViagem, coords]);

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
    }, 2000);
  };

  const alunosFaltantes = alunosNaRota.filter(a => !embarcadosHoje.has(a.id_estudante));

  return (
    <div className="h-[100dvh] w-full bg-gray-50 text-gray-800 flex flex-col font-sans overflow-hidden">
      
      {/* Navbar Fixa e Compacta */}
      <nav className="shrink-0 bg-[#0B2341] text-white px-4 py-3 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center">
          <div className="bg-white/10 p-1.5 rounded-lg mr-2.5"><BusFront size={20} className="text-white" /></div>
          <div>
            <h1 className="font-bold text-base leading-tight">Embarque</h1>
            <p className="text-[9px] text-gray-300 font-mono tracking-wider">
              {isFiscal ? 'Fiscal' : 'Motorista'} {coords ? '• GPS Ativo' : ''}
            </p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-white/80 p-2 hover:bg-[#890013] hover:text-white rounded-full transition-colors">
          <LogOut size={20} />
        </button>
      </nav>

      <div className="flex-1 flex flex-col w-full relative">
        
        {/* Painel de Controles no topo (Mais compacto) */}
        <div className="shrink-0 bg-white px-4 pt-3 pb-2 shadow-sm z-10 border-b border-gray-200 flex flex-col gap-2">
          
          <div className="flex gap-2">
            <div className="flex-1">
              <select 
                value={rotaAtual} 
                onChange={e => setRotaAtual(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] outline-none"
              >
                {rotasDisponiveis.length === 0 ? <option value="">Sem rotas</option> : rotasDisponiveis.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Botão de Faltantes */}
            <button 
              onClick={() => setShowFaltantes(true)}
              className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 shadow-sm active:bg-orange-100"
            >
              <Users size={14} className="mr-1.5" />
              Faltam: {alunosFaltantes.length}
            </button>
          </div>

          <div className="flex gap-2 h-9">
            <button onClick={() => setTipoViagem('ida')} className={`flex-1 rounded-lg font-bold transition-all text-xs border ${tipoViagem === 'ida' ? 'bg-[#395D34] border-[#395D34] text-white shadow-inner' : 'bg-white border-gray-300 text-gray-500'}`}>
              IDA
            </button>
            <button onClick={() => setTipoViagem('volta')} className={`flex-1 rounded-lg font-bold transition-all text-xs border ${tipoViagem === 'volta' ? 'bg-[#0B2341] border-[#0B2341] text-white shadow-inner' : 'bg-white border-gray-300 text-gray-500'}`}>
              VOLTA
            </button>
          </div>
        </div>

        {/* Área da Câmera Flexível */}
        <div className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden w-full h-full">
          
          <div id="qr-reader-container" className="w-full max-h-[50vh] object-cover flex items-center justify-center"></div>

          {/* Overlays de Status cobrindo a câmera inteira se necessário */}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-[#0B2341]/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="font-bold text-white tracking-widest uppercase text-xs">Aguarde...</p>
            </div>
          )}

          {/* Modal: Confirmação de Rota Diferente */}
          {status === 'confirmacao' && estudantePendente && (
            <div className="absolute inset-0 bg-yellow-500 text-gray-900 flex flex-col items-center justify-center p-6 z-30">
              <AlertTriangle size={40} className="mb-2 text-yellow-900 animate-pulse" />
              <h2 className="font-black text-lg text-center mb-1 uppercase tracking-tight">Rota Diferente!</h2>
              <div className="bg-white/60 rounded-xl p-3 w-full text-center mb-3">
                <p className="text-sm font-bold text-gray-800">{estudantePendente.dados.nome}</p>
                <p className="text-[10px] text-yellow-900 font-bold mt-0.5 uppercase">Matrícula original: {estudantePendente.dados.rota}</p>
              </div>
              <p className="text-center font-bold mb-4 text-xs">Autorizar embarque avulso?</p>
              <div className="flex gap-3 w-full max-w-xs">
                <button onClick={negarEmbarque} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow">Negar</button>
                <button onClick={confirmarEmbarque} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow">Autorizar</button>
              </div>
            </div>
          )}

          {/* Cards flutuantes de Resultado */}
          {status === 'success' && estudante && (
            <div className="absolute inset-x-4 bottom-8 bg-[#395D34] text-white p-3 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-5 border-2 border-white/20">
              <img src={estudante.foto_url} alt="Foto" className="w-12 h-12 rounded-lg object-cover mr-3 shrink-0 bg-white" />
              <div className="flex-1 overflow-hidden">
                <h2 className="font-black text-sm truncate">{estudante.nome}</h2>
                <p className="text-green-100 text-[9px] font-bold uppercase truncate">{estudante.instituicao}</p>
                <span className="mt-1 inline-flex items-center bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
                  <CheckCircle size={10} className="mr-1"/> Aprovado
                </span>
              </div>
            </div>
          )}

          {status === 'warning' && estudante && (
            <div className="absolute inset-x-4 bottom-8 bg-yellow-500 text-gray-900 p-3 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-5 border-2 border-white/20">
              <img src={estudante.foto_url} alt="Foto" className="w-12 h-12 rounded-lg object-cover mr-3 shrink-0 bg-white" />
              <div className="flex-1 overflow-hidden">
                <h2 className="font-black text-sm truncate">{estudante.nome}</h2>
                <span className="text-yellow-900 text-[9px] font-bold uppercase bg-yellow-400 rounded px-1.5 py-0.5 mt-1 inline-block">
                  Embarque Avulso
                </span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-x-4 bottom-8 bg-[#890013] text-white p-3 rounded-xl shadow-2xl flex items-center z-30 animate-in fade-in slide-in-from-bottom-5 border-2 border-white/20">
              <XCircle size={24} className="mr-3 shrink-0" />
              <div>
                <h2 className="font-black text-sm leading-tight">Acesso Negado</h2>
                <p className="text-red-100 text-[10px] font-medium">{mensagem}</p>
              </div>
            </div>
          )}

          {status === 'idle' && (
            <div className="absolute bottom-6 inset-x-0 text-center text-white/50 flex flex-col items-center pointer-events-none">
              <ScanLine size={20} className="mb-1 opacity-70 animate-pulse" />
              <p className="text-[10px] font-medium uppercase tracking-widest">Alinhe o QR Code</p>
            </div>
          )}
        </div>

      </div>

      {/* JANELINHA FLUTUANTE DE ALUNOS FALTANTES */}
      {showFaltantes && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowFaltantes(false)} // Fecha ao clicar fora
        >
          <div 
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()} // Previne fechar ao clicar dentro
          >
            <div className="bg-orange-50 p-4 flex items-center justify-between border-b border-orange-200">
              <div className="flex items-center text-orange-800">
                <Users size={20} className="mr-2" />
                <h3 className="font-bold">Faltam Embarcar ({alunosFaltantes.length})</h3>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="text-orange-800/60 hover:text-orange-900 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto flex-1">
              {alunosFaltantes.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CheckCircle size={40} className="mx-auto mb-2 opacity-30 text-green-500" />
                  <p className="text-sm font-medium">Todos os alunos desta rota já embarcaram!</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {alunosFaltantes.map(aluno => (
                    <li key={aluno.id} className="p-3 flex items-center hover:bg-gray-50 transition">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 shrink-0">
                        {aluno.foto_url ? (
                          <img src={aluno.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={16}/></div>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold text-[#0B2341] truncate leading-tight">{aluno.nome}</p>
                        <p className="text-[10px] text-gray-500 font-medium truncate flex items-center mt-0.5">
                          <MapPin size={10} className="mr-1"/> {aluno.instituicao_destino || 'Sem Instituição'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
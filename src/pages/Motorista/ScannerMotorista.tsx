// src/pages/Motorista/ScannerMotorista.tsx
import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { BusFront, CheckCircle, XCircle, LogOut, ScanLine, AlertTriangle, Clock } from 'lucide-react';

interface EstudanteScan {
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
  
  // Configurações da viagem atual
  const [rotasDisponiveis, setRotasDisponiveis] = useState<string[]>([]);
  const [rotaAtual, setRotaAtual] = useState('');
  
  // Sentido Manual (fallback) e Horários Configuráveis
  const [tipoViagem, setTipoViagem] = useState<'ida' | 'volta'>('ida');
  const [horaIda, setHoraIda] = useState(localStorage.getItem('horaIda') || '06:00');
  const [horaVolta, setHoraVolta] = useState(localStorage.getItem('horaVolta') || '12:00');
  
  // Estados do Scanner
  const [estudante, setEstudante] = useState<EstudanteScan | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error' | 'loading'>('idle');
  const [mensagem, setMensagem] = useState('');
  
  const isProcessingRef = useRef(false);

  // Salva os horários no cache do celular do motorista
  useEffect(() => {
    localStorage.setItem('horaIda', horaIda);
    localStorage.setItem('horaVolta', horaVolta);
  }, [horaIda, horaVolta]);

  // Busca as rotas exclusivas deste motorista
  useEffect(() => {
    const buscarRotasDoMotorista = async () => {
      if (!user?.email) return;
      try {
        const q = query(collection(db, 'rotas'), where('motorista_email', '==', user.email));
        const snap = await getDocs(q);
        const lista = snap.docs.map(d => d.data().nome as string); // Agora usa apenas 'nome'
        setRotasDisponiveis(lista);
        if (lista.length > 0) setRotaAtual(lista[0]);
      } catch (error) {
        console.error("Erro ao buscar rotas do motorista", error);
      }
    };
    buscarRotasDoMotorista();
  }, [user]);

  // Função para verificar se a hora atual está na margem de X minutos do horário configurado
  const isHorarioProximo = (horarioAlvo: string, margemMinutos: number) => {
    if (!horarioAlvo) return false;
    const [hora, min] = horarioAlvo.split(':').map(Number);
    const agora = new Date();
    
    const alvo = new Date();
    alvo.setHours(hora, min, 0, 0);
    
    const diffEmMinutos = Math.abs(agora.getTime() - alvo.getTime()) / (1000 * 60);
    return diffEmMinutos <= margemMinutos;
  };

  // Inicializa o leitor de QR Code
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader", 
      { fps: 15, qrbox: { width: 250, height: 250 } }, 
      false
    );

    const onScanSuccess = async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setStatus('loading');

      try {
        // Busca o estudante pelo CPF lido (que é o ID do documento)
        const estudanteRef = doc(db, 'estudantes', decodedText);
        const estudanteSnap = await getDoc(estudanteRef);

        if (estudanteSnap.exists()) {
          const dadosEstudante = estudanteSnap.data();

          // 1. Verificação de Vencimento
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          let estaVencido = false;
          if (dadosEstudante.data_vencimento) {
            // Corrige fuso horário para evitar bugs de virada de dia
            const dataVenc = new Date(`${dadosEstudante.data_vencimento}T12:00:00`); 
            dataVenc.setHours(23, 59, 59, 999);
            if (hoje > dataVenc) {
              estaVencido = true;
            }
          }

          if (estaVencido) {
            setStatus('error');
            setMensagem('ACESSO NEGADO: Carteira Vencida!');
            setEstudante(null);
          } else {
            // 2. Determinar Ida/Volta baseado no Horário
            // Margem de 45 minutos para cima e para baixo
            let sentidoCalculado = tipoViagem; // Usa o manual como base
            if (isHorarioProximo(horaIda, 45)) sentidoCalculado = 'ida';
            else if (isHorarioProximo(horaVolta, 45)) sentidoCalculado = 'volta';
            
            // Atualiza o botão visualmente para o motorista saber o que o sistema escolheu
            setTipoViagem(sentidoCalculado);

            // 3. Lógica de Passe-Livre Universal
            const isRotaExata = dadosEstudante.rota === rotaAtual;

            // 4. Registra a viagem no Histórico
            await addDoc(collection(db, 'historico_viagens'), {
              id_estudante: dadosEstudante.id_estudante,
              nome_estudante: dadosEstudante.nome,
              id_motorista: user?.uid,
              nome_motorista: user?.nome || user?.email,
              id_rota_onibus: rotaAtual, 
              rota_original_aluno: dadosEstudante.rota, 
              tipo_viagem: sentidoCalculado,
              data_hora: new Date(),
              acesso_universal: !isRotaExata 
            });

            // 5. Atualiza a tela com os dados do estudante
            setEstudante({
              nome: dadosEstudante.nome,
              foto_url: dadosEstudante.foto_url,
              instituicao: dadosEstudante.instituicao_destino || '-',
              curso: dadosEstudante.curso || '-',
              turno: dadosEstudante.turno || '-',
              rota_aluno: dadosEstudante.rota || '-',
              vencimento: dadosEstudante.data_vencimento
            });

            if (isRotaExata) {
              setStatus('success');
              setMensagem(`Embarque de ${sentidoCalculado.toUpperCase()} Autorizado!`);
            } else {
              setStatus('warning');
              setMensagem('Acesso Liberado (Rota Diferente da Matrícula)');
            }
          }
        } else {
          setStatus('error');
          setMensagem('Carteira Inválida ou Estudante Não Encontrado.');
          setEstudante(null);
        }
      } catch (error) {
        console.error(error);
        setStatus('error');
        setMensagem('Erro de conexão ao validar qr code.');
      }

      // Limpa a tela após 4.5 segundos para o próximo aluno
      setTimeout(() => {
        setStatus('idle');
        setEstudante(null);
        setMensagem('');
        isProcessingRef.current = false;
      }, 4500);
    };

    scanner.render(onScanSuccess, () => {});

    return () => {
      scanner.clear().catch(console.error);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaAtual, horaIda, horaVolta, tipoViagem, user]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans">
      
      {/* Navbar do Motorista */}
      <nav className="bg-[#0B2341] text-white p-4 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center">
          <div className="bg-white/10 p-2 rounded-lg mr-3">
            <BusFront size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Leitor de Embarque</h1>
            <p className="text-[10px] text-gray-300 font-mono tracking-wider">{user?.email}</p>
          </div>
        </div>
        <button onClick={() => signOut(auth)} className="text-white/80 p-2 hover:bg-[#890013] hover:text-white rounded-full transition-colors">
          <LogOut size={22} />
        </button>
      </nav>

      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative">
        
        {/* Controles da Viagem */}
        <div className="bg-white p-5 rounded-2xl mb-6 shadow-md border border-gray-200">
          <div className="mb-4">
            <label className="block text-xs font-bold text-[#0B2341] uppercase tracking-wider mb-2">Selecione sua Rota Atual</label>
            <select 
              value={rotaAtual} 
              onChange={e => setRotaAtual(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-gray-800 font-bold focus:outline-none focus:border-[#395D34] focus:ring-1 focus:ring-[#395D34] appearance-none"
            >
              {rotasDisponiveis.length === 0 ? (
                <option value="">Nenhuma rota atribuída a você</option>
              ) : (
                rotasDisponiveis.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))
              )}
            </select>
          </div>

          {/* Configuração de Horários Automáticos */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-center text-[#0B2341] text-xs font-bold uppercase tracking-wider mb-3">
              <Clock size={14} className="mr-1.5"/> Auto-Detecção de Sentido
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1">HORA IDA</label>
                <input 
                  type="time" 
                  value={horaIda} 
                  onChange={e => setHoraIda(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] focus:outline-none focus:border-[#395D34]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-1">HORA VOLTA</label>
                <input 
                  type="time" 
                  value={horaVolta} 
                  onChange={e => setHoraVolta(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] focus:outline-none focus:border-[#395D34]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sentido (Manual / Status Atual)</label>
            <div className="flex gap-3">
              <button 
                onClick={() => setTipoViagem('ida')}
                className={`flex-1 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${tipoViagem === 'ida' ? 'bg-[#395D34] border-[#395D34] text-white shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                IDA
              </button>
              <button 
                onClick={() => setTipoViagem('volta')}
                className={`flex-1 py-3 rounded-xl font-bold transition-all duration-200 border-2 ${tipoViagem === 'volta' ? 'bg-[#0B2341] border-[#0B2341] text-white shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                VOLTA
              </button>
            </div>
          </div>
        </div>

        {/* Leitor da Câmera (Injetado pela Lib) */}
        <div className={`bg-black rounded-2xl overflow-hidden shadow-xl mb-6 relative border-[4px] transition-all duration-300
          ${status === 'success' ? 'border-[#395D34] shadow-[0_0_30px_rgba(57,93,52,0.3)]' : 
            status === 'warning' ? 'border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]' : 
            status === 'error' ? 'border-[#890013] shadow-[0_0_30px_rgba(137,0,19,0.4)]' : 
            'border-[#0B2341]'}`}
        >
          {status === 'loading' && (
            <div className="absolute inset-0 bg-[#0B2341]/90 z-10 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-bold text-white tracking-widest uppercase text-sm">Validando...</p>
            </div>
          )}
          
          <div id="qr-reader" className="w-full text-black bg-black"></div>
        </div>

        {/* ================= RESPOSTAS VISUAIS ================= */}

        {/* Sucesso (Rota Exata) */}
        {status === 'success' && estudante && (
          <div className="bg-[#395D34] text-white p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <img src={estudante.foto_url} alt="Estudante" className="w-20 h-20 rounded-xl border-2 border-white/50 object-cover mr-4 shadow-lg bg-gray-100" />
            <div className="flex-1 overflow-hidden">
              <h2 className="font-black text-xl leading-tight truncate mb-1">{estudante.nome}</h2>
              <p className="text-green-100 text-[11px] font-bold uppercase tracking-wider">{estudante.instituicao} • {estudante.curso}</p>
              <div className="mt-2 inline-flex items-center bg-white/20 px-2 py-1 rounded text-[10px] font-bold uppercase">
                <CheckCircle size={12} className="mr-1"/> Válido até {estudante.vencimento ? new Date(estudante.vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Ano Vigente'}
              </div>
            </div>
            <CheckCircle size={40} className="text-white shrink-0 ml-2" />
          </div>
        )}

        {/* Aviso (Acesso Universal - Rota Diferente) */}
        {status === 'warning' && estudante && (
          <div className="bg-yellow-500 text-gray-900 p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <img src={estudante.foto_url} alt="Estudante" className="w-20 h-20 rounded-xl border-2 border-gray-900/20 object-cover mr-4 shadow-lg bg-gray-100" />
            <div className="flex-1 overflow-hidden">
              <h2 className="font-black text-xl leading-tight truncate mb-1">{estudante.nome}</h2>
              <div className="flex flex-col gap-1">
                <p className="text-yellow-900 text-[10px] font-bold uppercase leading-tight bg-yellow-400/50 rounded px-1.5 py-0.5 inline-block w-fit">
                  Destino Oficial: {estudante.rota_aluno}
                </p>
                <p className="text-gray-800 text-xs font-bold">{estudante.instituicao} • {estudante.turno}</p>
              </div>
            </div>
            <AlertTriangle size={40} className="text-yellow-900 shrink-0 ml-2" />
          </div>
        )}

        {/* Erro (Vencido ou Inválido) */}
        {status === 'error' && (
          <div className="bg-[#890013] text-white p-5 rounded-2xl shadow-xl flex items-center animate-in fade-in slide-in-from-bottom-4">
            <XCircle size={40} className="mr-4 shrink-0" />
            <div>
              <h2 className="font-black text-xl leading-tight mb-1">Bloqueado</h2>
              <p className="text-red-100 text-sm font-medium">{mensagem}</p>
            </div>
          </div>
        )}

        {/* Estado Ocioso */}
        {status === 'idle' && (
          <div className="text-center text-gray-500 mt-2 flex flex-col items-center justify-center flex-1">
            <ScanLine size={40} className="mb-2 opacity-30 text-[#0B2341]" />
            <p className="font-medium text-sm w-3/4">Aponte a câmera para o QR Code para liberar o embarque.</p>
          </div>
        )}

      </div>
    </div>
  );
}
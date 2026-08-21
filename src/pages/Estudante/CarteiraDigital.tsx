// src/pages/Estudante/CarteiraDigital.tsx
import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { LogOut, Bus, Repeat, MapPin, Calendar, Download, AlertOctagon, MessageCircle, Map, FileText, Printer, X, ShieldCheck } from 'lucide-react';

interface EstudanteDados {
  nome: string;
  cpf: string;
  id_estudante: string;
  matricula: string;
  foto_url: string;
  rota: string;
  instituicao_destino: string;
  curso: string;
  turno: string;
  data_vencimento?: string;
}

interface Viagem {
  id: string;
  data_hora: any;
  id_rota_onibus?: string;
  id_rota?: string;
  tipo_viagem: 'ida' | 'volta';
  link_maps?: string;
}

interface RotaInfo {
  nome_rota: string;
  whatsapp_link?: string;
}

interface Declaracao {
  id: string;
  titulo: string;
  conteudoHtml: string;
  assinatura_url?: string | null;
  assinatura_posicao?: { x: number; y: number };
  timbre_base64?: string | null;
  rotas: string[];
}

export default function CarteiraDigital() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  
  const [estudante, setEstudante] = useState<EstudanteDados | null>(null);
  const [historico, setHistorico] = useState<Viagem[]>([]);
  const [whatsappRota, setWhatsappRota] = useState<string>('');
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  const [declaracaoAtiva, setDeclaracaoAtiva] = useState<Declaracao | null>(null);
  const [modalLgpdAberto, setModalLgpdAberto] = useState(false);
  
  const [cpfVinculo, setCpfVinculo] = useState('');
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [modoImpressao, setModoImpressao] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  const descriptografarCpf = (cpfDb: string): string => {
    if (!cpfDb) return '';
    try {
      if (/^[A-Za-z0-9+/]+=*$/.test(cpfDb)) {
        const decoded = atob(cpfDb);
        if (/^\d{11}$/.test(decoded)) {
          return decoded;
        }
      }
    } catch {
      // Ignora erro
    }
    return cpfDb.replace(/\D/g, '');
  };

  const formatarCPF = (cpf: string) => {
    if (!cpf) return '';
    let cpfLimpo = descriptografarCpf(cpf);
    const numeros = cpfLimpo.replace(/\D/g, '');
    if (numeros.length !== 11) return cpf;
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  useEffect(() => {
    const buscarDados = async () => {
      try {
        if (!user) {
          const cachedKey = Object.keys(localStorage).find(k => k.startsWith('cache_estudante_'));
          if (cachedKey) {
            const cachedData = localStorage.getItem(cachedKey);
            if (cachedData) {
              setEstudante(JSON.parse(cachedData));
              setLoading(false);
              return;
            }
          }
          setLoading(false);
          return;
        }

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let cpfEstudante = '';

        if (userSnap.exists()) {
          const userData = userSnap.data();
          cpfEstudante = userData.id_estudante || userData.cpf;
        }

        if (cpfEstudante) {
          const cpfLimpo = descriptografarCpf(cpfEstudante);
          
          const qEstudante = query(collection(db, 'estudantes'), where('cpf_hash', '==', btoa(cpfLimpo)));
          const snapEstudante = await getDocs(qEstudante);
          
          let estudanteDocId = cpfLimpo;
          let dadosAluno: EstudanteDados | null = null;

          if (!snapEstudante.empty) {
            estudanteDocId = snapEstudante.docs[0].id;
            dadosAluno = snapEstudante.docs[0].data() as EstudanteDados;
          } else {
            const estudanteRef = doc(db, 'estudantes', cpfLimpo);
            const estudanteSnap = await getDoc(estudanteRef);
            if (estudanteSnap.exists()) {
              dadosAluno = estudanteSnap.data() as EstudanteDados;
            }
          }
          
          if (dadosAluno) {
            setEstudante(dadosAluno);
            localStorage.setItem(`cache_estudante_${cpfLimpo}`, JSON.stringify(dadosAluno));

            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              nome: dadosAluno.nome,
              role: 'estudante',
              cpf: dadosAluno.cpf,
              id_estudante: estudanteDocId,
              atualizadoEm: new Date()
            }, { merge: true });

            buscarHistorico(estudanteDocId);
            buscarWhatsappDaRota(dadosAluno.rota);
            buscarDeclaracoes(dadosAluno.rota);
          }
        }
      } catch (error) {
        console.warn("Sem conexão com o Firebase. Carregando do cache local...", error);
        const cachedKey = Object.keys(localStorage).find(k => k.startsWith('cache_estudante_'));
        if (cachedKey) {
          const cachedData = localStorage.getItem(cachedKey);
          if (cachedData) {
            setEstudante(JSON.parse(cachedData));
          }
        }
      } finally {
        setLoading(false);
      }
    };
    buscarDados();
  }, [user]);

  const handleLogout = async () => {
    try {
      const chavesParaLimpar = Object.keys(localStorage).filter(k => k.startsWith('cache_estudante_'));
      chavesParaLimpar.forEach(chave => localStorage.removeItem(chave));

      await signOut(auth);
      navigate('/'); 
    } catch {
      showAlert('Erro ao sair da conta.', 'error');
    }
  };

  const buscarWhatsappDaRota = async (nomeRota: string) => {
    if (!nomeRota) return;
    try {
      const q = query(collection(db, 'rotas'), where('nome_rota', '==', nomeRota));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const dadosRota = snap.docs[0].data() as RotaInfo;
        if (dadosRota.whatsapp_link) {
          setWhatsappRota(dadosRota.whatsapp_link);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar whatsapp da rota", err);
    }
  };

  const buscarHistorico = async (idEstudante: string) => {
    try {
      const q = query(
        collection(db, 'historico_viagens'),
        where('id_estudante', '==', idEstudante),
        orderBy('data_hora', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const viagens = querySnapshot.docs.map(docItem => {
        const data = docItem.data();
        return {
          id: docItem.id,
          data_hora: data.data_hora,
          id_rota_onibus: data.id_rota_onibus,
          id_rota: data.id_rota,
          tipo_viagem: data.tipo_viagem as 'ida' | 'volta',
          link_maps: data.link_maps || undefined
        };
      }) as Viagem[];
      
      setHistorico(viagens);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    }
  };

  const buscarDeclaracoes = async (nomeRota: string) => {
    try {
      const snap = await getDocs(collection(db, 'declaracoes'));
      const lista: Declaracao[] = [];
      
      snap.forEach(docItem => {
        const data = docItem.data() as Declaracao;
        if (data.rotas && (data.rotas.includes(nomeRota) || data.rotas.includes('Todas'))) {
          lista.push({ ...data, id: docItem.id });
        }
      });
      
      setDeclaracoes(lista);
    } catch (error) {
      console.error("Erro ao buscar declarações:", error);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpfVinculo(value);
  };

  const handleVincularConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      const cpfLimpo = cpfVinculo.replace(/\D/g, '');
      const cpfHash = btoa(cpfLimpo);
      
      const qEstudante = query(collection(db, 'estudantes'), where('cpf_hash', '==', cpfHash));
      const snapEstudante = await getDocs(qEstudante);
      
      let estudanteDocId = cpfLimpo;
      let dadosAluno: EstudanteDados | null = null;

      if (!snapEstudante.empty) {
        estudanteDocId = snapEstudante.docs[0].id;
        dadosAluno = snapEstudante.docs[0].data() as EstudanteDados;
      } else {
        const estudanteRef = doc(db, 'estudantes', cpfLimpo);
        const estudanteSnap = await getDoc(estudanteRef);
        if (estudanteSnap.exists()) {
          dadosAluno = estudanteSnap.data() as EstudanteDados;
        }
      }
      
      if (dadosAluno) {
        localStorage.setItem(`cache_estudante_${cpfLimpo}`, JSON.stringify(dadosAluno));
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          nome: dadosAluno.nome,
          role: 'estudante',
          cpf: dadosAluno.cpf,
          id_estudante: estudanteDocId,
          atualizadoEm: new Date()
        }, { merge: true });

        setEstudante(dadosAluno);
        buscarHistorico(estudanteDocId);
        buscarWhatsappDaRota(dadosAluno.rota);
        buscarDeclaracoes(dadosAluno.rota);
        showAlert('Sua carteirinha foi vinculada com sucesso!', 'success');
      } else {
        showAlert('CPF não encontrado. Procure a prefeitura para se cadastrar.', 'error');
      }
    } catch (error) {
      console.error(error);
      showAlert('Erro ao vincular conta. Tente novamente mais tarde.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const abreviarNome = (nomeCompleto: string) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    const primeiro = partes[0];
    const ultimo = partes[partes.length - 1];
    const doMeio = partes.slice(1, -1).map(p => p.length > 2 ? p[0] + '.' : p).join(' ');
    return `${primeiro} ${doMeio} ${ultimo}`;
  };

  const handleSalvarCarteira = () => {
    if (!estudante) return;
    
    const janelaSalvar = window.open('', '_blank');
    if (!janelaSalvar) {
      showAlert('Permita pop-ups no navegador para salvar a carteirinha.', 'error');
      return;
    }

    const qrCodeSvg = document.getElementById('qr-code-export-container')?.innerHTML || '';

    janelaSalvar.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Carteirinha - ${estudante.nome}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-900 flex flex-col items-center justify-center min-h-screen p-4 font-sans text-white">
        <div class="mb-4 text-center">
          <h2 class="text-lg font-black text-white">Passe Livre Estudantil</h2>
          <p class="text-xs text-gray-400">Tire um print ou segure na imagem para salvar na galeria do celular</p>
        </div>
        
        <div class="w-full max-w-sm aspect-[1.58] bg-gradient-to-br from-white via-gray-50 to-blue-50 rounded-2xl p-4 flex flex-col justify-between text-gray-800 border-2 border-[#0B2341] shadow-2xl relative">
          <div class="flex justify-between items-start">
            <div class="flex items-center gap-2">
              <img src="/logo-prefeitura.png" alt="Prefeitura" class="h-6 w-auto object-contain" />
              <div>
                <h3 class="font-black uppercase tracking-wider text-[9px] text-[#0B2341]">Passe Livre Estudantil</h3>
                <p class="text-[8px] font-bold text-gray-500">Prefeitura de Angelim</p>
              </div>
            </div>
            <span class="bg-[#395D34] text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">Oficial</span>
          </div>

          <div class="flex gap-3 items-center my-auto">
            <img src="${estudante.foto_url}" alt="Foto" class="w-16 h-20 object-cover rounded-xl border-2 border-[#0B2341] shadow-md bg-gray-200 shrink-0" />
            <div class="flex flex-col justify-center overflow-hidden text-left w-full">
              <p class="text-[8px] text-gray-400 uppercase tracking-widest font-extrabold leading-none">Estudante</p>
              <p class="font-black text-sm leading-tight truncate w-full mt-0.5 text-[#0B2341]">${estudante.nome}</p>
              
              <div class="mt-1">
                <p class="text-[8px] text-gray-400 uppercase tracking-widest font-extrabold leading-none">Instituição</p>
                <p class="font-bold text-[10px] text-gray-700 leading-tight truncate w-full">${estudante.instituicao_destino}</p>
              </div>

              <div class="flex justify-between gap-1 mt-1 w-full">
                <div>
                  <span class="text-[7px] text-gray-400 uppercase tracking-widest block">Rota</span>
                  <p class="text-[9px] font-bold text-[#395D34] truncate max-w-[90px]">${estudante.rota || '-'}</p>
                </div>
                <div>
                  <span class="text-[7px] text-gray-400 uppercase tracking-widest block">Validade</span>
                  <p class="text-[9px] font-bold text-gray-700">${estudante.data_vencimento ? new Date(estudante.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/----'}</p>
                </div>
              </div>
            </div>

            <div class="flex flex-col items-center justify-center border-l border-gray-200 pl-2 shrink-0">
              <div class="bg-white p-1 border rounded-lg shadow-sm">
                ${qrCodeSvg}
              </div>
              <span class="text-[7px] font-bold text-gray-500 mt-0.5">QR CODE</span>
            </div>
          </div>
        </div>

        <div class="mt-6 flex gap-3">
          <button onclick="window.print()" class="bg-[#395D34] text-white font-bold py-3 px-6 rounded-xl shadow-lg text-sm">
            Imprimir / Salvar PDF
          </button>
        </div>
      </body>
      </html>
    `);
    janelaSalvar.document.close();
  };

  const verificarVencimento = () => {
    if (!estudante?.data_vencimento) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataVenc = new Date(`${estudante.data_vencimento}T12:00:00`); 
    dataVenc.setHours(23, 59, 59, 999);
    return hoje > dataVenc;
  };
  
  const estaVencido = verificarVencimento();

  const parseVariaveisDeclaracao = (html: string) => {
    if (!html || !estudante) return '';
    return html
      .replace(/\{\{nome_aluno\}\}/g, estudante.nome || '')
      .replace(/\{\{cpf_aluno\}\}/g, formatarCPF(estudante.cpf) || '')
      .replace(/\{\{instituicao\}\}/g, estudante.instituicao_destino || '')
      .replace(/\{\{rota\}\}/g, estudante.rota || '')
      .replace(/\{\{curso\}\}/g, estudante.curso || '')
      .replace(/\{\{matricula\}\}/g, estudante.matricula || '')
      .replace(/\n/g, '<br />');
  };

  const imprimirDeclaracao = (decl: Declaracao) => {
    setDeclaracaoAtiva(decl);
    setModoImpressao(true);
    setTimeout(() => {
      window.print();
      setModoImpressao(false);
    }, 500);
  };

  const obterPosicaoAssinatura = (declaracao: Declaracao) => declaracao.assinatura_posicao || { x: 50, y: 84 };

  if (loading) return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col items-center justify-center font-bold text-[#0B2341]">
      <div className="w-10 h-10 border-4 border-[#395D34] border-t-transparent rounded-full animate-spin mb-4"></div>
      Carregando carteira...
    </div>
  );

  return (
    <div className={`h-[100dvh] bg-gray-100 flex flex-col font-sans overflow-hidden ${modoImpressao ? 'print:bg-white print:overflow-visible' : ''}`}>
      
      <style>
        {`
          @media print {
            @page { size: A4; margin: 0; }
            body, html { width: 210mm; height: 297mm; background: white !important; margin: 0 !important; padding: 0 !important; }
            .print\\:block { display: block !important; }
            .print\\:hidden { display: none !important; }
          }
        `}
      </style>

      {estudante && (
        <div id="qr-code-export-container" className="hidden">
          <QRCode value={estudante.id_estudante} size={70} level="M" />
        </div>
      )}

      {modoImpressao && declaracaoAtiva && (
        <div className="hidden print:block fixed inset-0 z-[99999] w-[210mm] h-[297mm] bg-white overflow-hidden m-0 p-0">
          <div className="relative w-full h-full box-border p-[2.5cm]" style={{ fontFamily: 'Calibri, Aptos, Arial, sans-serif' }}>
            {declaracaoAtiva.timbre_base64 && (
              <img src={declaracaoAtiva.timbre_base64} alt="Timbre" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
            )}
            <div className="relative z-10 w-full h-full text-[11pt] leading-[1.15] text-justify text-gray-900"
                 style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                 dangerouslySetInnerHTML={{ __html: parseVariaveisDeclaracao(declaracaoAtiva.conteudoHtml) }} />
            {declaracaoAtiva.assinatura_url && (
              <div style={{ left: `${obterPosicaoAssinatura(declaracaoAtiva).x}%`, top: `${obterPosicaoAssinatura(declaracaoAtiva).y}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2">
                <img src={declaracaoAtiva.assinatura_url} alt="Assinatura autorizada" className="h-24 w-auto object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      {!modoImpressao && declaracaoAtiva && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in print:hidden">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[92vh]">
            <div className="bg-[#0B2341] p-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center">
                <FileText size={20} className="mr-2 text-[#395D34]" />
                <h3 className="font-bold text-sm sm:text-base">{declaracaoAtiva.titulo}</h3>
              </div>
              <button onClick={() => setDeclaracaoAtiva(null)} className="text-white/60 hover:text-white p-1"><X size={24} /></button>
            </div>
            
            <div className="p-2 sm:p-6 overflow-y-auto flex-1 bg-gray-100 flex justify-center items-start">
              <div className="relative bg-white shadow-xl w-full max-h-none sm:max-w-[210mm] sm:min-h-[297mm] aspect-[1/1.4142] sm:aspect-auto p-6 sm:p-[2.5cm] box-border overflow-hidden rounded-lg sm:rounded-none">
                 {declaracaoAtiva.timbre_base64 && (
                   <img src={declaracaoAtiva.timbre_base64} alt="Timbre" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />
                 )}
                 <div className="relative z-10 w-full h-full text-[10pt] sm:text-[11pt] leading-[1.15] text-justify text-gray-900" 
                      style={{ fontFamily: 'Calibri, Aptos, Arial, sans-serif', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: parseVariaveisDeclaracao(declaracaoAtiva.conteudoHtml) }} />
                 {declaracaoAtiva.assinatura_url && (
                    <div style={{ left: `${obterPosicaoAssinatura(declaracaoAtiva).x}%`, top: `${obterPosicaoAssinatura(declaracaoAtiva).y}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2">
                      <img src={declaracaoAtiva.assinatura_url} alt="Assinatura autorizada" className="h-16 sm:h-20 w-auto object-contain" />
                    </div>
                 )}
              </div>
            </div>
            
            <div className="p-4 bg-white flex gap-3 shrink-0 border-t border-gray-200">
              <button onClick={() => setDeclaracaoAtiva(null)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancelar</button>
              <button onClick={() => imprimirDeclaracao(declaracaoAtiva)} className="flex-1 flex justify-center items-center bg-[#395D34] text-white py-3 rounded-xl font-bold hover:bg-[#2c4928] shadow transition text-sm">
                <Printer size={20} className="mr-2" /> Salvar PDF / Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {modalLgpdAberto && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-[#0B2341] p-4 flex items-center justify-between text-white shrink-0">
              <h3 className="font-bold flex items-center"><ShieldCheck size={20} className="mr-2 text-[#395D34]" /> Privacidade & LGPD</h3>
              <button onClick={() => setModalLgpdAberto(false)} className="text-white/60 hover:text-white p-1"><X size={24} /></button>
            </div>
            <div className="p-6 text-sm text-gray-700 space-y-3 max-h-[60vh] overflow-y-auto">
              <p><strong>Uso dos seus dados:</strong> Seus dados (Nome, CPF, Instituição) são utilizados exclusivamente pela Prefeitura para gerenciar o Passe Livre Estudantil e validar embarques na frota oficial.</p>
              <p><strong>Segurança:</strong> O sistema utiliza criptografia de ponta a ponta em trânsito (HTTPS) e dados protegidos em repouso nos servidores do Google Firebase.</p>
              <p><strong>Minimização:</strong> Coletamos apenas as informações necessárias para confirmar o seu direito ao benefício.</p>
            </div>
            <div className="p-4 bg-gray-50">
              <button onClick={() => setModalLgpdAberto(false)} className="w-full bg-[#395D34] text-white py-3 rounded-xl font-bold shadow hover:bg-[#2c4928] transition">Ciente</button>
            </div>
          </div>
        </div>
      )}

      <nav className="shrink-0 bg-[#0B2341] text-white p-4 flex justify-between items-center shadow-md z-10 print:hidden">
        <div className="flex items-center">
          <Bus size={22} className="mr-2 text-[#395D34]" />
          <span className="font-bold text-lg">Transporte Escolar</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setModalLgpdAberto(true)} className="text-white/70 hover:text-white transition-colors" title="Informações LGPD">
            <ShieldCheck size={20} />
          </button>
          <button onClick={handleLogout} className="hover:text-red-300 transition-colors p-1" title="Sair">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-4 w-full max-w-md mx-auto flex flex-col gap-6 print:hidden">
        
        {!estudante ? (
          <div className="bg-white p-6 rounded-2xl shadow-md mt-10 border border-gray-200">
            <h2 className="text-xl font-bold text-[#0B2341] mb-2">Bem-vindo(a)!</h2>
            <p className="text-gray-600 mb-6 text-sm font-medium">
              Para acessar sua carteirinha digital, digite o seu CPF cadastrado na prefeitura:
            </p>
            <form onSubmit={handleVincularConta} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0B2341] mb-1">Seu CPF</label>
                <input 
                  type="tel" 
                  inputMode="numeric"
                  required
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full rounded-xl border-gray-300 p-3 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none"
                  value={cpfVinculo} 
                  onChange={handleCpfChange} 
                />
              </div>
              <button type="submit" className="w-full bg-[#395D34] text-white py-3 rounded-xl font-bold hover:bg-[#2c4928] shadow-md transition-colors">
                Vincular Carteirinha
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center mt-2 shrink-0">
              <p className="text-gray-400 text-xs mb-2 uppercase font-semibold tracking-wider">Toque no cartão para girar</p>
              
              {estaVencido && (
                <div className="mb-4 bg-[#890013] text-white p-3 rounded-xl shadow-lg border border-red-700 flex items-center justify-center animate-in fade-in slide-in-from-top-2">
                  <AlertOctagon size={20} className="mr-2 shrink-0" />
                  <span className="text-sm font-bold leading-tight">CARTEIRA VENCIDA! Procure a prefeitura para renovação.</span>
                </div>
              )}
              
              <div 
                ref={exportRef}
                className="w-full aspect-[1.58] bg-transparent cursor-pointer group relative"
                style={{ perspective: '1000px' }}
                onClick={() => setFlipped(!flipped)}
              >
                <div 
                  className="relative w-full h-full transition-transform duration-700 shadow-2xl rounded-2xl"
                  style={{ 
                    transformStyle: 'preserve-3d', 
                    WebkitTransformStyle: 'preserve-3d', 
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
                  }}
                >
                  
                  <div 
                    className={`absolute inset-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-blue-50 rounded-2xl p-5 flex flex-col justify-between text-gray-800 overflow-hidden border-2 shadow-xl ${estaVencido ? 'border-[#890013]' : 'border-[#0B2341]/30'}`}
                    style={{ 
                      backfaceVisibility: 'hidden', 
                      WebkitBackfaceVisibility: 'hidden', 
                      backgroundColor: '#ffffff',
                      zIndex: flipped ? 1 : 2 
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                      <img src="/logo-prefeitura.png" alt="Marca D'água" className="w-2/3 object-contain" />
                    </div>

                    <div className="flex justify-between items-start z-10">
                      <div className="flex items-center gap-2">
                        <img src="/logo-prefeitura.png" alt="Prefeitura" className="h-7 w-auto object-contain drop-shadow-sm" />
                        <div>
                          <h3 className="font-black uppercase tracking-wider text-[10px] text-[#0B2341]">Passe Livre Estudantil</h3>
                          <p className="text-[9px] font-bold text-gray-500">Prefeitura de Angelim</p>
                        </div>
                      </div>
                      <span className="bg-[#395D34] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shadow-sm">Oficial</span>
                    </div>

                    <div className="flex gap-4 items-center z-10 h-full mt-2">
                      <img src={estudante.foto_url} alt="Foto" className={`w-20 h-24 object-cover rounded-xl border-2 shadow-md bg-gray-200 shrink-0 ${estaVencido ? 'border-[#890013] grayscale opacity-80' : 'border-[#0B2341]'}`} />
                      <div className="flex flex-col justify-center overflow-hidden text-left w-full h-full">
                        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-extrabold leading-none">Estudante</p>
                        <p className={`font-black text-base leading-tight truncate w-full mt-0.5 text-[#0B2341]`} title={estudante.nome}>{abreviarNome(estudante.nome)}</p>
                        
                        <div className="mt-1.5">
                          <p className="text-[9px] text-gray-400 uppercase tracking-widest font-extrabold leading-none">Instituição</p>
                          <p className="font-bold text-xs text-gray-700 leading-tight truncate w-full mt-0.5">{estudante.instituicao_destino}</p>
                        </div>

                        <div className="flex justify-between gap-2 mt-1.5 w-full">
                          <div className="flex-1">
                            <span className="text-[8px] text-gray-400 uppercase tracking-widest font-extrabold block truncate">Matrícula</span>
                            <p className="text-[10px] font-bold text-gray-700 truncate">{estudante.matricula || '-'}</p>
                          </div>
                          <div className="flex-1">
                            <span className="text-[8px] text-gray-400 uppercase tracking-widest font-extrabold block truncate">Curso</span>
                            <p className="text-[10px] font-bold text-gray-700 truncate">{estudante.curso || '-'}</p>
                          </div>
                          <div>
                            <span className="text-[8px] text-[#890013] bg-red-50 px-1 rounded uppercase tracking-widest font-extrabold block">Turno</span>
                            <p className="text-[10px] font-bold text-gray-700">{estudante.turno || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div 
                    className="absolute inset-0 w-full h-full bg-white rounded-2xl p-5 flex flex-col justify-between border-2 border-gray-200 shadow-xl text-gray-800"
                    style={{ 
                      backfaceVisibility: 'hidden', 
                      WebkitBackfaceVisibility: 'hidden', 
                      transform: 'rotateY(180deg)',
                      WebkitTransform: 'rotateY(180deg)', 
                      backgroundColor: '#ffffff',
                      zIndex: flipped ? 2 : 1 
                    }}
                  >
                    <div className="flex w-full h-full">
                      <div className="flex flex-col justify-center h-full w-[55%] pr-2 relative z-10">
                        <div className="mb-2">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Documento (CPF)</p>
                          <p className="text-sm font-black text-[#0B2341]">{formatarCPF(estudante.cpf)}</p>
                        </div>
                        <div className="mb-2">
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Rota Oficial</p>
                          <p className="text-[11px] font-bold text-[#395D34] bg-green-50 py-1 px-2 rounded-lg mt-0.5 inline-block border border-green-100 truncate w-full">
                            {estudante.rota}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Validade</p>
                          <p className={`text-[11px] font-bold mt-0.5 ${estaVencido ? 'text-[#890013]' : 'text-gray-800'}`}>
                            {estudante.data_vencimento ? new Date(estudante.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/----'}
                          </p>
                        </div>
                      </div>

                      <div className="w-[45%] flex flex-col items-center justify-center border-l border-gray-100 pl-3 relative z-10">
                        <div className={`bg-white p-1.5 border-2 rounded-xl shadow-sm ${estaVencido ? 'border-[#890013]' : 'border-[#0B2341]'}`}>
                          <QRCode value={estudante.id_estudante} size={90} level="M" />
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 mt-1.5 text-center flex items-center">
                          <Repeat size={10} className="mr-1"/> Girar Cartão
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button 
                  onClick={handleSalvarCarteira}
                  className="w-full flex items-center justify-center gap-2 bg-[#0B2341] text-white py-3.5 rounded-xl font-bold hover:bg-[#071629] transition-colors shadow-md text-sm"
                >
                  <Download size={18} /> Salvar Carteirinha (PNG)
                </button>
                
                {whatsappRota && (
                  <a 
                    href={whatsappRota} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-[#20ba5a] transition-colors shadow-md text-sm"
                  >
                    <MessageCircle size={18} /> Grupo da Rota
                  </a>
                )}
              </div>
            </div>

            {declaracoes.length > 0 && (
              <div className="bg-blue-50/50 rounded-2xl shadow-sm border border-blue-100 p-4 shrink-0">
                <h3 className="font-bold text-[#0B2341] mb-3 flex items-center border-b border-blue-200 pb-2 text-sm uppercase tracking-wider">
                  <FileText size={18} className="mr-2 text-blue-600" /> Declarações Oficiais
                </h3>
                <div className="space-y-2">
                  {declaracoes.map(decl => (
                    <button 
                      key={decl.id}
                      onClick={() => setDeclaracaoAtiva(decl)}
                      className="w-full flex justify-between items-center bg-white border border-blue-200 p-3 rounded-xl shadow-sm hover:border-blue-400 transition group text-left"
                    >
                      <span className="font-bold text-gray-800 text-sm group-hover:text-blue-700">{decl.titulo}</span>
                      <Printer size={16} className="text-gray-400 group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col flex-1 min-h-[250px] mb-4">
              <h3 className="font-bold text-[#0B2341] mb-3 flex items-center border-b pb-2 text-sm uppercase tracking-wider shrink-0">
                <Calendar size={18} className="mr-2 text-[#395D34]" /> Meu Histórico
              </h3>
              
              <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                {historico.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6 font-medium">Nenhuma viagem registrada ainda.</p>
                ) : (
                  historico.map((viagem) => (
                    <div key={viagem.id} className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white transition-colors">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-xl mr-3 ${viagem.tipo_viagem === 'ida' ? 'bg-[#395D34]/10 text-[#395D34]' : 'bg-[#0B2341]/10 text-[#0B2341]'}`}>
                            {viagem.tipo_viagem === 'ida' ? <MapPin size={16} /> : <Bus size={16} />}
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{viagem.tipo_viagem} • {viagem.id_rota_onibus || viagem.id_rota || 'Rota Padrão'}</p>
                            <p className="text-[10px] text-gray-500 font-medium capitalize mt-0.5">
                              {viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Data recente'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-[#0B2341]">
                            {viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </p>
                        </div>
                      </div>
                      
                      {viagem.link_maps && (
                        <div className="mt-2 pl-12">
                          <a 
                            href={viagem.link_maps} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            <Map size={12} className="mr-1.5" /> Ver Local do Embarque
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
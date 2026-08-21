// src/pages/Cadastro/CadastroEstudante.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QRCode from 'react-qr-code';
import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp, addDoc, updateDoc, arrayUnion, arrayRemove, where, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAlert } from '../../contexts/AlertContext';
import { 
  Camera, Save, Printer, User, Search, Edit, ImagePlus, X, List, UserPlus, LogOut, 
  Trash2, Users, Truck, MapPin, Clock, FileText, Plus, Building, 
  Menu, FileSignature, BarChart3, KeyRound, AlertTriangle, ShieldCheck,
  Database, Route, GraduationCap, CheckCircle2, UserCheck, LockKeyhole, Scale, Info, Activity, CalendarDays
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface DocumentoAnexo {
  id: string;
  titulo: string;
  nome_arquivo: string;
  url?: string;
  base64?: string;
}

interface Estudante {
  id_estudante: string;
  nome: string;
  cpf: string;
  matricula: string;
  data_nascimento: string;
  instituicao_destino: string;
  curso: string;
  turno: string;
  rota: string; 
  foto_url: string;
  data_vencimento: string;
  documentos?: DocumentoAnexo[];
  documento_base64?: string;
  documento_nome?: string;   
}

interface InstituicaoDB {
  id: string;
  nome: string;
}

interface Motorista {
  id: string; 
  nome: string;
  cpf: string;
  cnh: string;
  telefone: string;
  foto_url?: string;
  uid_vinculado?: string;
  criadoEm?: any;
  atualizadoEm?: any;
  ativo?: boolean;
}

interface Rota {
  id: string;
  nome_rota: string;
  whatsapp_link?: string;
  paradas?: string[];
  motorista_cpf?: string;
  motorista_email?: string;
  motorista_nome?: string;
}

interface ViagemHistorico {
  id: string;
  data_hora: any;
  id_rota_onibus?: string;
  rota_original_aluno?: string;
  id_rota?: string;
  tipo_viagem: 'ida' | 'volta';
  nome_estudante?: string;
  id_estudante?: string;
  acesso_universal?: boolean;
}

interface Declaracao {
  id: string;
  titulo: string;
  conteudoHtml: string;
  assinatura_url?: string | null;
  assinatura_posicao?: { x: number; y: number };
  timbre_base64?: string | null;
  rotas: string[];
  data_validade: string;
}

type ViewType = 'dashboard' | 'estudantes_cad' | 'estudantes_lista' | 'motoristas_cad' | 'motoristas_lista' | 'instituicoes' | 'rotas' | 'declaracoes' | 'privacidade';

export default function CadastroEstudante() {
  const { showAlert, showConfirm } = useAlert();
  const LGPD_NOTICE_VERSION = '2026-01';

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const hoje = new Date();
  const dataHojeStr = hoje.toISOString().split('T')[0];
  const fimDoAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split('T')[0];

  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [matricula, setMatricula] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [dataVencimento, setDataVencimento] = useState(fimDoAno);
  const [instituicao, setInstituicao] = useState('');
  const [curso, setCurso] = useState('');
  const [turno, setTurno] = useState('Matutino');
  const [rotaAtrelada, setRotaAtrelada] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [documentosForm, setDocumentosForm] = useState<DocumentoAnexo[]>([]);
  const [aceiteLgpd, setAceiteLgpd] = useState(false);
  
  const [instituicoesDisponiveis, setInstituicoesDisponiveis] = useState<InstituicaoDB[]>([]);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [isEditando, setIsEditando] = useState(false);

  const [motEditId, setMotEditId] = useState<string | null>(null);
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
  const [motFoto, setMotFoto] = useState<string | null>(null);
  const [showMotWebcam, setShowMotWebcam] = useState(false);
  const motWebcamRef = useRef<Webcam>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [buscaMotorista, setBuscaMotorista] = useState('');

  const [rotaEditId, setRotaEditId] = useState<string | null>(null);
  const [rotaNome, setRotaNome] = useState('');
  const [whatsappRota, setWhatsappRota] = useState('');
  const [rotaMotoristaCpf, setRotaMotoristaCpf] = useState('');
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionadaParaParadas, setRotaSelecionadaParaParadas] = useState<Rota | null>(null);
  const [modalParadasAberto, setModalParadasAberto] = useState(false);
  const [novaInstNome, setNovaInstNome] = useState('');

  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  const [declTitulo, setDeclTitulo] = useState('');
  const [declConteudo, setDeclConteudo] = useState('');
  const [declRotas, setDeclRotas] = useState<string[]>([]);
  const [declValidade, setDeclValidade] = useState(fimDoAno);
  const [declAssinatura, setDeclAssinatura] = useState<string | null>(null);
  const [declTimbreBase64, setDeclTimbreBase64] = useState<string | null>(null);
  const [carregandoTimbre, setCarregandoTimbre] = useState(false);
  const [declAssinaturaPos, setDeclAssinaturaPos] = useState({ x: 50, y: 84 });
  const [arrastandoAssinatura, setArrastandoAssinatura] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [dashFiltro, setDashFiltro] = useState<'hoje' | 'mes' | 'ano' | 'custom'>('hoje');
  const [dashDataInicio, setDashDataInicio] = useState(dataHojeStr);
  const [dashDataFim, setDashDataFim] = useState(dataHojeStr);
  const [dashMotoristaFiltro, setDashMotoristaFiltro] = useState('todos');
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashResumo, setDashResumo] = useState({
    alunosAtivos: 0,
    motoristasAtivos: 0,
    rotasAtivas: 0,
    instituicoes: 0,
    viagensPeriodo: 0,
    alunosTransportados: 0,
    ida: 0,
    volta: 0,
    avulsos: 0,
    carteirasVencendo: 0,
    motoristasComAcesso: 0,
  });
  const [dashRotas, setDashRotas] = useState<Array<{ nome: string; total: number }>>([]);
  const [dashMotoristas, setDashMotoristas] = useState<Array<{ nome: string; total: number }>>([]);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [alunoHistorico, setAlunoHistorico] = useState<Estudante | null>(null);
  const [historicoViagens, setHistoricoViagens] = useState<ViagemHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [modalDocsAlunoAberto, setModalDocsAlunoAberto] = useState(false);
  const [alunoDocs, setAlunoDocs] = useState<Estudante | null>(null);

  const [showWebcam, setShowWebcam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modoImpressaoLote, setModoImpressaoLote] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const assinaturaInputRef = useRef<HTMLInputElement>(null);
  const timbreInputRef = useRef<HTMLInputElement>(null);

  const criptografarCpf = (cpfStr: string): string => {
    try {
      const limpo = cpfStr.replace(/\D/g, '');
      return btoa(limpo);
    } catch {
      return cpfStr;
    }
  };

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

  const mascararCpf = (cpfStr: string) => {
    const limpo = descriptografarCpf(cpfStr);
    if (limpo.length !== 11) return '***.***.***-**';
    const ultimos = limpo.slice(-2);
    const penultimos = limpo.slice(-4, -2);
    return `***.***.${penultimos}-${ultimos}`;
  };

  const formatarCpfCompleto = (cpfStr: string) => {
    const limpo = descriptografarCpf(cpfStr);
    if (limpo.length !== 11) return cpfStr;
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const parseVariaveisDeclaracao = (html: string, alunoContexto?: Partial<Estudante>) => {
    if (!html) return '';
    const a = alunoContexto || {
      nome: 'NOME DE EXEMPLO DO ESTUDANTE',
      cpf: '000.000.000-00',
      matricula: '123456',
      instituicao_destino: 'INSTITUIÇÃO DE ENSINO DE EXEMPLO',
      curso: 'CURSO DE EXEMPLO',
      turno: 'MATUTINO',
      rota: 'ROTA OFICIAL DE EXEMPLO',
      data_nascimento: '2005-01-01',
      data_vencimento: fimDoAno
    };

    const valorTurno = a.turno || (a as any).Turno || '';
    const valorNascimento = a.data_nascimento || (a as any).dataNascimento || '';

    return html
      .replace(/\{\{nome_aluno\}\}/gi, a.nome || '')
      .replace(/\{\{cpf_aluno\}\}/gi, formatarCpfCompleto(a.cpf || ''))
      .replace(/\{\{matricula\}\}/gi, a.matricula || '')
      .replace(/\{\{instituicao\}\}/gi, a.instituicao_destino || '')
      .replace(/\{\{curso\}\}/gi, a.curso || '')
      .replace(/\{\{turno\}\}/gi, valorTurno)
      .replace(/\{\{rota\}\}/gi, a.rota || '')
      .replace(/\{\{data_nascimento\}\}/gi, valorNascimento ? new Date(valorNascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '')
      .replace(/\{\{data_vencimento\}\}/gi, a.data_vencimento ? new Date(a.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '')
      .replace(/\n/g, '<br />');
  };

  const registrarAuditoria = async (
    acao: string,
    recurso: string,
    recursoId: string,
    detalhes?: Record<string, unknown>
  ) => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await addDoc(collection(db, 'auditoria_lgpd'), {
        acao,
        recurso,
        recurso_id: recursoId,
        operador_uid: uid,
        criadoEm: serverTimestamp(),
        detalhes: detalhes || {},
      });
    } catch (error) {
      console.error('Falha ao registrar auditoria:', error);
    }
  };

  const carregarDados = async () => {
    try {
      const qEstudantes = query(collection(db, 'estudantes'), orderBy('nome'));
      const snapEstudantes = await getDocs(qEstudantes);
      setEstudantes(snapEstudantes.docs.map(docItem => {
        const data = docItem.data() as Estudante;
        return {
          ...data,
          cpf: descriptografarCpf(data.cpf)
        };
      }));

      const snapInstituicoes = await getDocs(query(collection(db, 'instituicoes'), orderBy('nome')));
      setInstituicoesDisponiveis(snapInstituicoes.docs.map(docItem => ({ id: docItem.id, nome: docItem.data().nome })));

      const snapMotoristas = await getDocs(collection(db, 'motoristas'));
      setMotoristas(snapMotoristas.docs.map(d => {
        const data = d.data() as Motorista;
        return {
          ...data,
          id: d.id,
          cpf: descriptografarCpf(data.cpf)
        };
      }));

      const snapRotas = await getDocs(collection(db, 'rotas'));
      setRotas(snapRotas.docs.map(d => ({ id: d.id, ...d.data() } as Rota)));

      const snapDecl = await getDocs(collection(db, 'declaracoes'));
      const declsValidas: Declaracao[] = [];
      for (const d of snapDecl.docs) {
        const data = d.data() as Declaracao;
        if (data.data_validade && data.data_validade < dataHojeStr) {
          await deleteDoc(doc(db, 'declaracoes', d.id));
        } else {
          declsValidas.push({ ...data, id: d.id });
        }
      }
      setDeclaracoes(declsValidas);
      setIsDataLoaded(true);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [currentView]);

  const carregarDashboard = async () => {
    setLoadingDash(true);
    try {
      let dataInicio = new Date(dashDataInicio + 'T00:00:00');
      let dataFim = new Date(dashDataFim + 'T23:59:59.999');

      if (dashFiltro === 'hoje') {
        dataInicio = new Date(); dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(); dataFim.setHours(23, 59, 59, 999);
      } else if (dashFiltro === 'mes') {
        const now = new Date();
        dataInicio = new Date(now.getFullYear(), now.getMonth(), 1);
        dataFim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (dashFiltro === 'ano') {
        const now = new Date();
        dataInicio = new Date(now.getFullYear(), 0, 1);
        dataFim = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      }

      const q = query(
        collection(db, 'historico_viagens'),
        where('data_hora', '>=', dataInicio),
        where('data_hora', '<=', dataFim)
      );
      const snap = await getDocs(q);
      let viagens = snap.docs.map(d => ({ id: d.id, ...d.data() } as ViagemHistorico));

      if (dashMotoristaFiltro !== 'todos') {
        const rotaNomesDoMotorista = rotas
          .filter(r => r.motorista_cpf === dashMotoristaFiltro || r.motorista_email === dashMotoristaFiltro)
          .map(r => r.nome_rota);
        viagens = viagens.filter(v => rotaNomesDoMotorista.includes(v.id_rota_onibus || ''));
      }

      const avulsos = viagens.filter(v =>
        v.acesso_universal || (v.rota_original_aluno && v.rota_original_aluno !== (v.id_rota_onibus || ''))
      ).length;

      const alunosTransportados = new Set(
        viagens.map(v => v.id_estudante).filter(Boolean)
      ).size;

      const porRota = new Map<string, number>();
      const porMotorista = new Map<string, number>();

      viagens.forEach(v => {
        const rota = v.id_rota_onibus || v.id_rota || 'Não identificada';
        porRota.set(rota, (porRota.get(rota) || 0) + 1);
        const rotaObj = rotas.find(r => r.nome_rota === rota);
        const motorista = rotaObj?.motorista_nome || 'Sem motorista';
        porMotorista.set(motorista, (porMotorista.get(motorista) || 0) + 1);
      });

      const hojeMs = new Date().getTime();
      const em30Dias = hojeMs + 30 * 24 * 60 * 60 * 1000;
      const carteirasVencendo = estudantes.filter(e => {
        if (!e.data_vencimento) return false;
        const t = new Date(e.data_vencimento + 'T23:59:59').getTime();
        return t >= hojeMs && t <= em30Dias;
      }).length;

      const resumo = {
        alunosAtivos: estudantes.length,
        motoristasAtivos: motoristas.filter(m => m.ativo !== false).length,
        rotasAtivas: rotas.length,
        instituicoes: instituicoesDisponiveis.length,
        viagensPeriodo: viagens.length,
        alunosTransportados,
        ida: viagens.filter(v => v.tipo_viagem === 'ida').length,
        volta: viagens.filter(v => v.tipo_viagem === 'volta').length,
        avulsos,
        carteirasVencendo,
        motoristasComAcesso: motoristas.filter(m => !!m.uid_vinculado).length,
      };

      setDashResumo(resumo);
      setDashRotas([...porRota.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6).map(([nome,total]) => ({nome,total})));
      setDashMotoristas([...porMotorista.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6).map(([nome,total]) => ({nome,total})));
    } catch (err) {
      console.error('Erro dashboard', err);
      showAlert('Erro ao buscar dados do dashboard', 'error');
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (currentView === 'dashboard' && isDataLoaded) {
      carregarDashboard();
    }
  }, [currentView, dashFiltro, dashMotoristaFiltro, isDataLoaded]);

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpf(value);
  };

  const handleCpfMotoristaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setMotCpf(value);
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/, '($1) $2');
    value = value.replace(/(\d{5})(\d{4})$/, '$1-$2');
    setMotTelefone(value);
  };

  const abreviarNome = (nomeCompleto: string) => {
    if (!nomeCompleto) return '';
    const partes = nomeCompleto.trim().split(' ');
    if (partes.length <= 2) return nomeCompleto;
    return `${partes[0]} ${partes.slice(1, -1).map(p => p.length > 2 ? p[0] + '.' : p).join(' ')} ${partes[partes.length - 1]}`;
  };

  const comprimirImagem = (file: File, maxWidth = 400): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scaleSize = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * (scaleSize < 1 ? scaleSize : 1);
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = await comprimirImagem(file);
      setFoto(img);
      setShowWebcam(false);
    }
  };

  const capturarFoto = useCallback(() => {
    if (webcamRef.current) {
      setFoto(webcamRef.current.getScreenshot());
      setShowWebcam(false);
    }
  }, [webcamRef]);

  const handleNovoCadastro = () => {
    setNome(''); setCpf(''); setMatricula(''); setDataNascimento(''); 
    setDataVencimento(fimDoAno); setInstituicao(''); setCurso(''); 
    setTurno('Matutino'); setRotaAtrelada(''); setFoto(null);
    setDocumentosForm([]);
    setAceiteLgpd(false);
    setIsEditando(false);
    setCurrentView('estudantes_cad');
  };

  const proximoIdEstudante = async (): Promise<string> => {
    const q = query(collection(db, 'estudantes'), orderBy('id_estudante_int', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return '1';
    const maiorId = Number(snap.docs[0].data().id_estudante_int || 0);
    return String(maiorId + 1);
  };

  const proximoIdMotorista = async (): Promise<string> => {
    const q = query(collection(db, 'motoristas'), orderBy('id_motorista_int', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return '1';
    const maiorId = Number(snap.docs[0].data().id_motorista_int || 0);
    return String(maiorId + 1);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foto) return showAlert('É necessário ter uma foto do estudante!', 'error');
    if (!cpf || cpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');
    if (!instituicao) return showAlert('Selecione uma instituição.', 'error');
    
    if (foto.length > 900000) {
       return showAlert('A foto capturada ou enviada é muito grande. Tente um arquivo menor para salvar no banco.', 'error');
    }

    if (!aceiteLgpd && !isEditando) {
      return showAlert('Você deve confirmar a ciência da LGPD para registrar novos alunos.', 'error');
    }
    
    setLoading(true);
    try {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const cpfCriptografado = criptografarCpf(cpfLimpo);

      let idFinal = '';
      let idIntFinal = 1;

      if (isEditando) {
        const qBusca = query(collection(db, 'estudantes'), where('cpf_hash', '==', cpfCriptografado));
        const snapBusca = await getDocs(qBusca);
        if (!snapBusca.empty) {
          idFinal = snapBusca.docs[0].id;
          idIntFinal = Number(snapBusca.docs[0].data().id_estudante_int || 1);
        } else {
          idFinal = await proximoIdEstudante();
          idIntFinal = Number(idFinal);
        }
      } else {
        idFinal = await proximoIdEstudante();
        idIntFinal = Number(idFinal);
      }

      const instExiste = instituicoesDisponiveis.some(i => i.nome.toLowerCase() === instituicao.toLowerCase());
      if (!instExiste && instituicao.trim() !== '') {
        await addDoc(collection(db, 'instituicoes'), { nome: instituicao.trim() });
      }

      await setDoc(doc(db, 'estudantes', idFinal), {
        id_estudante: idFinal,
        id_estudante_int: idIntFinal,
        nome, 
        cpf: cpfCriptografado,
        cpf_hash: cpfCriptografado,
        matricula, 
        data_nascimento: dataNascimento, 
        data_vencimento: dataVencimento,
        instituicao_destino: instituicao, 
        curso, 
        turno, 
        rota: rotaAtrelada,
        foto_url: foto, 
        documentos: documentosForm.map(({ base64, url, ...docItem }) => ({ ...docItem, base64: base64 || url || '' })), 
        lgpd: {
          aviso_versao: LGPD_NOTICE_VERSION,
          finalidade: 'Gestão do Transporte Escolar',
          registrado_em: serverTimestamp(),
          registrado_por: auth.currentUser?.uid || null,
        },
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || null
      });

      await registrarAuditoria(isEditando ? 'ATUALIZACAO' : 'CRIACAO', 'estudante', idFinal, { documentos: documentosForm.length });
      showAlert(isEditando ? 'Estudante atualizado com sucesso!' : 'Estudante salvo com sucesso!', 'success');
      carregarDados();
      handleNovoCadastro(); 
      setCurrentView('estudantes_lista');
    } catch {
      showAlert('Erro ao salvar estudante. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (aluno: Estudante) => {
    setNome(aluno.nome); setCpf(formatarCpfCompleto(aluno.cpf)); setMatricula(aluno.matricula || '');
    setDataNascimento(aluno.data_nascimento); setDataVencimento(aluno.data_vencimento || fimDoAno);
    setInstituicao(aluno.instituicao_destino); setCurso(aluno.curso || '');
    setTurno(aluno.turno || 'Matutino'); setRotaAtrelada(aluno.rota); setFoto(aluno.foto_url);
    
    let docsIniciais = aluno.documentos ? [...aluno.documentos] : [];
    if (aluno.documento_base64 && docsIniciais.length === 0) {
      docsIniciais.push({
        id: 'legacy_doc', titulo: 'Documento Antigo', base64: aluno.documento_base64, nome_arquivo: aluno.documento_nome || 'documento.pdf'
      });
    }
    setDocumentosForm(docsIniciais);
    setAceiteLgpd(true);
    setIsEditando(true);
    setCurrentView('estudantes_cad');
  };

  const handleExcluir = (id_estudante: string) => {
    showConfirm('Atenção: deseja excluir este estudante? A exclusão física deve respeitar os prazos de retenção e obrigações legais definidos pela Prefeitura.', async () => {
      try {
        await deleteDoc(doc(db, 'estudantes', id_estudante));
        await registrarAuditoria('EXCLUSAO', 'estudante', id_estudante);
        showAlert('Estudante excluído.', 'success');
        carregarDados();
      } catch {
        showAlert('Não foi possível excluir o estudante.', 'error');
      }
    });
  };

  const pdfToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDocumentoMultiploUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const novosDocs: DocumentoAnexo[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
          const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
          
          const base64Pdf = await pdfToBase64(compressedBlob);
          
          if (base64Pdf.length > 1024 * 700) { 
            showAlert(`O arquivo ${file.name} é muito grande para o Firestore após compressão. O limite seguro é ~700KB.`, 'error');
            continue;
          }
          
          const idDoc = `${Date.now()}_${i}`;
          novosDocs.push({ id: idDoc, titulo: `Documento ${documentosForm.length + novosDocs.length + 1}`, nome_arquivo: file.name, base64: base64Pdf });
        } else if (file.type.startsWith('image/')) {
          const compressedDataUrl = await comprimirImagem(file, 800);
          
          if (compressedDataUrl.length > 1024 * 700) {
            showAlert(`A imagem ${file.name} é muito grande. O limite seguro é ~700KB.`, 'error');
            continue;
          }
          
          const idDoc = `${Date.now()}_${i}`;
          novosDocs.push({ id: idDoc, titulo: `Documento ${documentosForm.length + novosDocs.length + 1}`, nome_arquivo: file.name, base64: compressedDataUrl });
        } else {
          showAlert(`Formato não suportado: ${file.name}`, 'error');
          continue;
        }
      }
      setDocumentosForm(prev => [...prev, ...novosDocs]);
      if (novosDocs.length > 0) showAlert('Documento(s) processado(s) com sucesso em Base64!', 'success');
    } catch {
      showAlert('Erro ao processar arquivo(s).', 'error');
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const resetMotoristaForm = () => {
    setMotEditId(null);
    setMotNome('');
    setMotCpf('');
    setMotCnh('');
    setMotTelefone('');
    setMotFoto(null);
    setShowMotWebcam(false);
  };

  const capturarFotoMotorista = useCallback(() => {
    const fotoCapturada = motWebcamRef.current?.getScreenshot();
    if (fotoCapturada) {
      setMotFoto(fotoCapturada);
      setShowMotWebcam(false);
    }
  }, []);

  const handleFotoMotoristaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('Selecione uma imagem válida.', 'error');
      return;
    }
    const img = await comprimirImagem(file, 600);
    setMotFoto(img);
    setShowMotWebcam(false);
  };

  const handleSalvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motNome.trim()) return showAlert('Informe o nome do motorista.', 'error');
    if (!motCpf || motCpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');
    if (!motCnh.trim()) return showAlert('Informe a CNH.', 'error');
    if (!motTelefone.trim()) return showAlert('Informe o WhatsApp.', 'error');
    if (!motFoto && !motEditId) return showAlert('A foto do motorista é obrigatória.', 'error');

    if (motFoto && motFoto.length > 900000) {
      return showAlert('A imagem está muito grande. Use uma câmera mais leve ou comprima a imagem antes.', 'error');
    }

    setLoading(true);
    try {
      const cpfLimpo = motCpf.replace(/\D/g, '');
      const cpfCriptografado = criptografarCpf(cpfLimpo);

      let id = motEditId;
      let idIntFinal = 1;

      if (!id) {
        const proximoId = await proximoIdMotorista();
        id = proximoId;
        idIntFinal = Number(proximoId);
      } else {
        const motEncontrado = motoristas.find(m => m.id === id);
        if (motEncontrado) {
          const qBusca = query(collection(db, 'motoristas'), where('cpf', '==', cpfCriptografado));
          const snapBusca = await getDocs(qBusca);
          if (!snapBusca.empty) {
            idIntFinal = Number(snapBusca.docs[0].data().id_motorista_int || 1);
          }
        }
      }

      const dataMotorista = {
        id,
        id_motorista_int: idIntFinal,
        nome: motNome.trim(),
        cpf: cpfCriptografado,
        cpf_hash: cpfCriptografado,
        cnh: motCnh.trim(),
        telefone: motTelefone.trim(),
        foto_url: motFoto || null, 
        ativo: true,
        atualizadoEm: serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || null,
      };

      if (motEditId) {
        await updateDoc(doc(db, 'motoristas', motEditId), dataMotorista);
        await registrarAuditoria('ATUALIZACAO', 'motorista', motEditId, { campos: ['nome', 'cnh', 'telefone', 'foto'] });
      } else {
        await setDoc(doc(db, 'motoristas', id!), {
          ...dataMotorista,
          data_cadastro: serverTimestamp(),
          criadoEm: serverTimestamp(),
          criadoPor: auth.currentUser?.uid || null,
        });
        await registrarAuditoria('CRIACAO', 'motorista', id!, { foto: !!motFoto });
      }

      showAlert('Motorista salvo com sucesso!', 'success');
      resetMotoristaForm();
      await carregarDados();
      setCurrentView('motoristas_lista');
    } catch (error) {
      console.error(error);
      showAlert('Erro ao salvar motorista. O tamanho dos dados pode estar excedendo o limite do Firestore.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleZerarSenhaMotorista = (mot: Motorista) => {
    showConfirm(
      `Para zerar a senha, apague a conta antiga deste motorista no painel Authentication do Firebase. Clique em OK para desvincular o cadastro e permitir que ele crie uma nova senha no próximo acesso.`,
      async () => {
        try {
          await updateDoc(doc(db, 'motoristas', mot.id), {
            uid_vinculado: null
          });
          showAlert('Vínculo apagado! O motorista já pode criar uma nova senha.', 'success');
          carregarDados();
        } catch {
          showAlert('Erro ao desvincular senha.', 'error');
        }
      }
    );
  };

  const handleSalvarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotaMotoristaCpf) return showAlert('Selecione um motorista para a rota.', 'error');
    setLoading(true);
    try {
      const motSelecionado = motoristas.find(m => m.cpf === rotaMotoristaCpf);
      const dataRota = { nome_rota: rotaNome, whatsapp_link: whatsappRota, motorista_cpf: motSelecionado?.cpf, motorista_nome: motSelecionado?.nome };

      if (rotaEditId) await updateDoc(doc(db, 'rotas', rotaEditId), dataRota);
      else await addDoc(collection(db, 'rotas'), { ...dataRota, paradas: [] });
      
      showAlert('Rota salva!', 'success');
      setRotaEditId(null); setRotaNome(''); setWhatsappRota(''); setRotaMotoristaCpf('');
      carregarDados();
    } catch { showAlert('Erro ao salvar rota.', 'error'); } finally { setLoading(false); }
  };

  const handleSalvarInstituicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaInstNome.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'instituicoes'), { nome: novaInstNome.trim() });
      showAlert('Instituição cadastrada!', 'success');
      setNovaInstNome(''); carregarDados();
    } catch { showAlert('Erro ao cadastrar.', 'error'); } finally { setLoading(false); }
  };

  const toggleParadaInstituicao = async (instituicaoNome: string, includes: boolean) => {
    if (!rotaSelecionadaParaParadas) return;
    try {
      const rotaRef = doc(db, 'rotas', rotaSelecionadaParaParadas.id);
      if (includes) {
        await updateDoc(rotaRef, { paradas: arrayRemove(instituicaoNome) });
        setRotaSelecionadaParaParadas(prev => prev ? {...prev, paradas: prev.paradas?.filter(p => p !== instituicaoNome)} : null);
      } else {
        await updateDoc(rotaRef, { paradas: arrayUnion(instituicaoNome) });
        setRotaSelecionadaParaParadas(prev => prev ? {...prev, paradas: [...(prev.paradas || []), instituicaoNome]} : null);
      }
      carregarDados();
    } catch { showAlert('Erro ao atualizar parada.', 'error'); }
  };

  const insertVariable = (variable: string) => {
    const campoTexto = editorRef.current;
    const tag = `{{${variable}}}`;
    if (!campoTexto) {
      setDeclConteudo((conteudo) => `${conteudo}${tag}`);
      return;
    }
    const inicio = campoTexto.selectionStart;
    const fim = campoTexto.selectionEnd;
    setDeclConteudo(`${declConteudo.slice(0, inicio)}${tag}${declConteudo.slice(fim)}`);
    setTimeout(() => {
      campoTexto.focus();
      campoTexto.selectionStart = inicio + tag.length;
      campoTexto.selectionEnd = inicio + tag.length;
    }, 0);
  };

  const aplicarFormatacaoHtml = (inicioTag: string, fimTag: string) => {
    const campoTexto = editorRef.current;
    if (!campoTexto) return;
    const inicio = campoTexto.selectionStart;
    const fim = campoTexto.selectionEnd;
    const textoSelecionado = declConteudo.slice(inicio, fim) || 'texto';
    const textoFormatado = `${inicioTag}${textoSelecionado}${fimTag}`;
    setDeclConteudo(`${declConteudo.slice(0, inicio)}${textoFormatado}${declConteudo.slice(fim)}`);
    setTimeout(() => {
      campoTexto.focus();
      campoTexto.selectionStart = inicio + inicioTag.length;
      campoTexto.selectionEnd = inicio + inicioTag.length + textoSelecionado.length;
    }, 0);
  };

  const handleEnterDocumento = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const campoTexto = editorRef.current;
    if (!campoTexto) return;
    const inicio = campoTexto.selectionStart;
    const fim = campoTexto.selectionEnd;
    const recuo = '          ';
    setDeclConteudo(`${declConteudo.slice(0, inicio)}\n${recuo}${declConteudo.slice(fim)}`);
    setTimeout(() => {
      campoTexto.focus();
      campoTexto.selectionStart = inicio + recuo.length + 1;
      campoTexto.selectionEnd = inicio + recuo.length + 1;
    }, 0);
  };

  const handleAssinaturaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = await comprimirImagem(file, 600);
      setDeclAssinatura(img);
    }
  };

  const handleTimbreUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showAlert('Envie o timbre como imagem PNG ou JPG em formato A4.', 'error');
      return;
    }

    setCarregandoTimbre(true);
    try {
      const imagemBase64 = await comprimirImagem(file, 800);
      if (imagemBase64.length > 700000) {
        showAlert('O timbre ficou muito grande para salvar no Firestore. Use uma imagem A4 mais leve.', 'error');
        return;
      }
      setDeclTimbreBase64(imagemBase64);
      showAlert('Timbre carregado e convertido para salvar junto à declaração.', 'success');
    } catch {
      showAlert('Não foi possível processar o timbre.', 'error');
    } finally {
      setCarregandoTimbre(false);
      if (timbreInputRef.current) timbreInputRef.current.value = '';
    }
  };

  const atualizarPosicaoAssinatura = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!arrastandoAssinatura) return;
    const area = e.currentTarget.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - area.left) / area.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - area.top) / area.height) * 100));
    setDeclAssinaturaPos({ x, y });
  };

  const handleSalvarDeclaracao = async () => {
    if (!declTitulo.trim()) return showAlert('Dê um título à declaração.', 'info');
    if (!declConteudo.trim()) return showAlert('O conteúdo não pode estar vazio.', 'info');
    if (declRotas.length === 0) return showAlert('Selecione pelo menos uma rota.', 'info');

    setLoading(true);
    try {
      await addDoc(collection(db, 'declaracoes'), {
        titulo: declTitulo,
        conteudoHtml: declConteudo,
        assinatura_url: declAssinatura || null,
        assinatura_posicao: declAssinaturaPos,
        timbre_base64: declTimbreBase64 || null,
        rotas: declRotas,
        data_validade: declValidade,
        criadoEm: serverTimestamp()
      });
      showAlert('Declaração criada e enviada com sucesso!', 'success');
      setDeclTitulo(''); setDeclRotas([]); setDeclAssinatura(null); setDeclTimbreBase64(null); setDeclAssinaturaPos({ x: 50, y: 84 }); setDeclValidade(fimDoAno);
      setDeclConteudo('');
      carregarDados();
    } catch {
      showAlert('Erro ao salvar declaração.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirDeclaracao = async (id: string) => {
    showConfirm('Deseja apagar esta declaração permanentemente?', async () => {
      await deleteDoc(doc(db, 'declaracoes', id));
      showAlert('Declaração removida.', 'success');
      carregarDados();
    });
  };

  const CarteirinhaTemplate = ({ aluno }: { aluno: Partial<Estudante> }) => (
    <div className="w-[171.2mm] h-[53.98mm] bg-white border border-gray-300 shadow-lg flex flex-row print:shadow-none print:border-black rounded-lg overflow-hidden shrink-0 relative">
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
        <img src="/logo-prefeitura.png" alt="Marca D'água" className="w-1/2 object-contain" />
      </div>
      <div className="w-[85.6mm] h-full border-r border-dashed border-gray-400 p-2 flex flex-col relative z-10 bg-white print:bg-transparent">
        <div className="flex items-center justify-between border-b border-[#0B2341]/20 pb-1 mb-1.5 shrink-0">
          <div className="flex items-center text-[#0B2341]">
            <img src="/logo-prefeitura.png" alt="Prefeitura" className="h-4 mr-1 object-contain" />
            <span className="text-[9px] font-bold leading-tight uppercase tracking-tight">Pref. Angelim</span>
          </div>
          <span className="text-[8px] font-bold bg-[#395D34] text-white px-2 py-0.5 rounded-full uppercase">Passe Livre</span>
        </div>
        <div className="flex gap-2 flex-1 items-start w-full">
          <div className="w-[22mm] h-[28mm] bg-gray-200 rounded border border-[#0B2341] overflow-hidden shrink-0 relative">
            {aluno.foto_url ? <img src={aluno.foto_url} className="absolute inset-0 w-full h-full object-cover" /> : <User size={24} className="text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />}
          </div>
          <div className="flex flex-col flex-1 h-full align-center">
            <div>
              <span className="text-[7px] text-gray-500 uppercase leading-none block">Estudante</span>
              <div className="text-[10px] font-bold text-[#0B2341] leading-tight line-clamp-2" title={aluno.nome}>{abreviarNome(aluno.nome || '') || 'Nome do Aluno'}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-1">
              <div><span className="text-[6px] text-gray-500 uppercase leading-none block">Matrícula</span><span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.matricula || '-'}</span></div>
              <div><span className="text-[6px] text-gray-500 uppercase leading-none block">Turno</span><span className="text-[8px] font-bold text-[#890013] leading-tight block truncate w-full">{aluno.turno || '-'}</span></div>
              <div className="col-span-2"><span className="text-[6px] text-gray-500 uppercase leading-none block">Curso</span><span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.curso || '-'}</span></div>
              <div className="col-span-2"><span className="text-[6px] text-gray-500 uppercase leading-none block">Instituição</span><span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.instituicao_destino || '-'}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-auto bg-[#890013] text-white text-[8px] p-1 flex justify-between rounded uppercase font-semibold shrink-0 w-full px-2">
          <span>Transporte Escolar</span><span>Venc: {aluno.data_vencimento ? new Date(aluno.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/----'}</span>
        </div>
      </div>
      <div className="w-[85.6mm] h-full p-2 flex flex-row items-center bg-white print:bg-transparent">
        <div className="flex flex-col justify-around w-[50%] pr-2">
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Documento (CPF)</span><p className="text-[10px] font-bold text-[#0B2341]">{formatarCpfCompleto(aluno.cpf || '')}</p></div>
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Nascimento</span><p className="text-[10px] font-bold text-[#0B2341]">{aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '00/00/0000'}</p></div>
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Rota Oficial</span><p className="text-[9px] font-bold text-[#395D34] leading-tight line-clamp-2">{aluno.rota || 'Não vinculada'}</p></div>
        </div>
        <div className="w-[50%] flex flex-col items-center justify-center border-l border-gray-100 pl-2">
          <div className="bg-white p-1 border border-[#0B2341] rounded shadow-md"><QRCode value={aluno.id_estudante || 'ID_ESTUDANTE'} size={60} level="M"/></div>
          <span className="text-[6px] font-bold text-gray-400 mt-1.5 text-center leading-tight">USO PESSOAL E<br/>INTRANSFERÍVEL</span>
        </div>
      </div>
    </div>
  );

  const filterEstudantes = estudantes.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || formatarCpfCompleto(e.cpf).includes(busca));
  const filterMotoristas = motoristas.filter(m => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) || formatarCpfCompleto(m.cpf).includes(buscaMotorista));

  return (
    <div className={`h-screen flex bg-gray-50 overflow-hidden ${modoImpressaoLote ? 'print:p-0 print:bg-white' : ''}`}>
      
      {modoImpressaoLote && (
        <div className="hidden print:flex flex-col gap-4 w-full items-center">
          {estudantes.filter(e => selecionados.includes(e.id_estudante)).map((aluno) => (
            <CarteirinhaTemplate key={aluno.id_estudante} aluno={aluno} />
          ))}
        </div>
      )}

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-[#0B2341] text-white flex flex-col h-full transition-all duration-300 print:hidden
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} 
          lg:translate-x-0 lg:static ${isSidebarHovered ? 'lg:w-64' : 'lg:w-20'} shadow-2xl overflow-hidden`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-white/15 overflow-hidden shrink-0 bg-[#0B2341] z-10">
          <div className="flex items-center gap-3">
            <img src="/logo-prefeitura.png" alt="Logo" className="w-8 h-8 object-contain shrink-0 bg-white p-1 rounded" />
            <span className={`font-bold text-sm whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Pref. Angelim</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white"><X size={24} /></button>
        </div>

        <div className="flex-1 min-h-0 py-4 flex flex-col gap-1 px-3 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <button onClick={() => {setCurrentView('dashboard'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'dashboard' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <BarChart3 size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Dashboard Auditoria</span>
          </button>

          {(isSidebarHovered || isSidebarOpen) ? (
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 mt-3 p-3 tracking-wider whitespace-nowrap overflow-hidden">
              Gestão de Alunos
            </div>
          ) : (
            <div className="my-2 border-t border-white/10 mx-2 lg:block hidden"></div>
          )}

          <button onClick={() => {setCurrentView('estudantes_lista'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'estudantes_lista' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <List size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Lista de Estudantes</span>
          </button>
          <button onClick={() => {handleNovoCadastro(); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'estudantes_cad' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <UserPlus size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Cadastrar Estudante</span>
          </button>
          <button onClick={() => {setCurrentView('declaracoes'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'declaracoes' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <FileSignature size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Declarações (Word)</span>
          </button>

          {(isSidebarHovered || isSidebarOpen) ? (
            <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 mt-3 p-3 tracking-wider whitespace-nowrap overflow-hidden">
              Logística & Frota
            </div>
          ) : (
            <div className="my-2 border-t border-white/10 mx-2 lg:block hidden"></div>
          )}

          <button onClick={() => {setCurrentView('motoristas_lista'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'motoristas_lista' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Users size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Motoristas Ativos</span>
          </button>
          <button onClick={() => {setCurrentView('motoristas_cad'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'motoristas_cad' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Truck size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Cadastrar Motorista</span>
          </button>
          <button onClick={() => {setCurrentView('rotas'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'rotas' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <MapPin size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Gestão de Rotas</span>
          </button>
          <button onClick={() => {setCurrentView('instituicoes'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'instituicoes' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Building size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Instituições</span>
          </button>
          <button onClick={() => {setCurrentView('privacidade'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'privacidade' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <LockKeyhole size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Privacidade & LGPD</span>
          </button>
        </div>

        <div className="p-4 border-t border-white/15 shrink-0 bg-[#0B2341] z-10">
          <button onClick={() => signOut(auth)} className="flex items-center gap-4 px-3 py-3 w-full rounded-xl hover:bg-red-900/50 text-red-300 transition">
            <LogOut size={20} className="shrink-0" />
            <span className={`transition-opacity whitespace-nowrap ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden print:overflow-visible relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:hidden shrink-0 print:hidden justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-[#0B2341]"><Menu size={24} /></button>
            <h1 className="font-bold text-[#0B2341]">Menu Principal</h1>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${modoImpressaoLote ? 'print:p-0' : ''}`}>
          
          {currentView === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in max-w-7xl mx-auto">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col xl:flex-row justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-[#0B2341] text-white"><ShieldCheck size={24} /></div>
                    <div>
                      <h2 className="text-2xl font-black text-[#0B2341]">Painel de Gestão do Transporte</h2>
                      <p className="text-sm text-gray-500">Indicadores operacionais, acesso e conformidade da base.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={dashMotoristaFiltro} onChange={e => setDashMotoristaFiltro(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-[#0B2341] bg-gray-50">
                      <option value="todos">Todos os motoristas</option>
                      {motoristas.map(m => <option key={m.id} value={m.cpf}>{m.nome}</option>)}
                    </select>
                    <div className="bg-gray-100 rounded-lg p-1 flex">
                      {(['hoje','mes','ano','custom'] as const).map(f => (
                        <button key={f} onClick={() => setDashFiltro(f)}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold ${dashFiltro === f ? 'bg-white shadow text-[#0B2341]' : 'text-gray-500'}`}>
                          {f === 'hoje' ? 'Hoje' : f === 'mes' ? 'Mês' : f === 'ano' ? 'Ano' : 'Período'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {dashFiltro === 'custom' && (
                  <div className="mt-4 flex flex-wrap gap-2 items-center">
                    <input type="date" value={dashDataInicio} onChange={e => setDashDataInicio(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <span className="text-gray-400">até</span>
                    <input type="date" value={dashDataFim} onChange={e => setDashDataFim(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                    <button onClick={carregarDashboard} className="bg-[#0B2341] text-white px-4 py-2 rounded-lg text-sm font-bold">Atualizar</button>
                  </div>
                )}
              </div>

              {loadingDash ? (
                <div className="bg-white rounded-2xl border p-16 flex flex-col items-center">
                  <div className="w-10 h-10 border-4 border-[#395D34] border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-bold text-gray-500">Atualizando indicadores...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {([
                      { label: 'Alunos ativos', value: dashResumo.alunosAtivos, icon: GraduationCap, cls: 'bg-blue-50 text-blue-700' },
                      { label: 'Motoristas', value: dashResumo.motoristasAtivos, icon: Truck, cls: 'bg-green-50 text-green-700' },
                      { label: 'Rotas', value: dashResumo.rotasAtivas, icon: Route, cls: 'bg-purple-50 text-purple-700' },
                      { label: 'Instituições', value: dashResumo.instituicoes, icon: Building, cls: 'bg-orange-50 text-orange-700' },
                    ] as Array<{ label: string; value: number; icon: LucideIcon; cls: string }>).map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.label} className="bg-white rounded-2xl p-5 border shadow-sm">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.cls}`}><Icon size={20} /></div>
                          <p className="text-3xl font-black text-[#0B2341] mt-3">{card.value}</p>
                          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{card.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-5 border shadow-sm">
                      <div className="flex items-center gap-2 mb-4"><Activity size={19} className="text-[#395D34]" /><h3 className="font-black text-[#0B2341]">Operação no período</h3></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-xl p-4"><p className="text-2xl font-black">{dashResumo.viagensPeriodo}</p><p className="text-xs text-gray-500">Embarques</p></div>
                        <div className="bg-gray-50 rounded-xl p-4"><p className="text-2xl font-black">{dashResumo.alunosTransportados}</p><p className="text-xs text-gray-500">Alunos únicos</p></div>
                        <div className="bg-blue-50 rounded-xl p-4"><p className="text-2xl font-black text-blue-700">{dashResumo.ida}</p><p className="text-xs text-blue-700">Idas</p></div>
                        <div className="bg-orange-50 rounded-xl p-4"><p className="text-2xl font-black text-orange-700">{dashResumo.volta}</p><p className="text-xs text-orange-700">Voltas</p></div>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border shadow-sm">
                      <div className="flex items-center gap-2 mb-4"><Route size={19} className="text-[#0B2341]" /><h3 className="font-black text-[#0B2341]">Rotas mais utilizadas</h3></div>
                      <div className="space-y-3">
                        {dashRotas.length === 0 ? <p className="text-sm text-gray-400">Sem dados no período.</p> : dashRotas.map((r, i) => (
                          <div key={r.nome} className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black">{i+1}</span>
                            <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{r.nome}</p><div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-1.5 bg-[#395D34] rounded-full" style={{width: `${Math.max(8, (r.total / Math.max(1, dashRotas[0].total)) * 100)}%`}} /></div></div>
                            <span className="text-xs font-black">{r.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl p-5 border shadow-sm">
                      <div className="flex items-center gap-2 mb-4"><UserCheck size={19} className="text-[#0B2341]" /><h3 className="font-black text-[#0B2341]">Motoristas</h3></div>
                      <div className="space-y-3">
                        {dashMotoristas.length === 0 ? <p className="text-sm text-gray-400">Sem dados no período.</p> : dashMotoristas.map((m, i) => (
                          <div key={m.nome} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50">
                            <span className="text-sm font-bold truncate">{i+1}. {m.nome}</span><span className="text-xs font-black">{m.total} embarques</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-yellow-50 text-yellow-700"><AlertTriangle size={22}/></div>
                      <div><p className="text-2xl font-black">{dashResumo.avulsos}</p><p className="text-xs text-gray-500">Embarques avulsos</p></div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-red-50 text-red-700"><CalendarDays size={22}/></div>
                      <div><p className="text-2xl font-black">{dashResumo.carteirasVencendo}</p><p className="text-xs text-gray-500">Validades nos próximos 30 dias</p></div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border shadow-sm flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-green-50 text-green-700"><KeyRound size={22}/></div>
                      <div><p className="text-2xl font-black">{dashResumo.motoristasComAcesso}/{dashResumo.motoristasAtivos}</p><p className="text-xs text-gray-500">Motoristas com acesso</p></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="text-[#395D34] mt-1" />
                      <div>
                        <p className="font-black text-[#0B2341]">Privacidade e LGPD</p>
                        <p className="text-sm text-gray-500">Dados pessoais devem ser acessados somente por usuários autorizados e utilizados para a finalidade institucional definida.</p>
                      </div>
                    </div>
                    <button onClick={() => setCurrentView('privacidade')} className="px-4 py-2 rounded-lg bg-[#0B2341] text-white text-sm font-bold">Ver controles</button>
                  </div>
                </>
              )}
            </div>
          )}

          {currentView === 'estudantes_lista' && (
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border print:hidden animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-[#0B2341]">Alunos Cadastrados</h2>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <input type="text" placeholder="Buscar por nome ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-[#0B2341] outline-none text-sm" />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  </div>
                  <button onClick={() => {setModoImpressaoLote(true); setTimeout(() => { window.print(); setModoImpressaoLote(false); }, 500);}} disabled={selecionados.length === 0} className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#071629] disabled:opacity-50 text-sm whitespace-nowrap"><Printer size={16} className="mr-2" /> Imprimir ({selecionados.length})</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3"><input type="checkbox" checked={selecionados.length > 0 && selecionados.length === filterEstudantes.length} onChange={() => setSelecionados(selecionados.length === filterEstudantes.length ? [] : filterEstudantes.map(e => e.id_estudante))} className="rounded border-gray-300 text-[#395D34]" /></th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estudante</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Instituição / Rota</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filterEstudantes.map((aluno) => (
                      <tr key={aluno.id_estudante} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-4"><input type="checkbox" checked={selecionados.includes(aluno.id_estudante)} onChange={() => setSelecionados(prev => prev.includes(aluno.id_estudante) ? prev.filter(i => i !== aluno.id_estudante) : [...prev, aluno.id_estudante])} className="rounded border-gray-300 text-[#395D34]" /></td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          <img src={aluno.foto_url} alt="" className="w-10 h-10 rounded-full object-cover border" />
                          <div>
                            <div className="text-sm font-bold text-[#0B2341]">{aluno.nome}</div>
                            <div className="text-xs text-gray-500 font-mono">{mascararCpf(aluno.cpf)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="text-sm text-[#0B2341] font-semibold">{aluno.instituicao_destino}</div><div className="text-xs text-gray-500">Rota: {aluno.rota}</div></td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => {setAlunoDocs(aluno); setModalDocsAlunoAberto(true);}} className="text-purple-600 bg-purple-50 hover:bg-purple-100 p-2 rounded-full transition" title="Documentos"><FileText size={18} /></button>
                            <button onClick={async () => {
                              setAlunoHistorico(aluno); setModalHistoricoAberto(true); setCarregandoHistorico(true);
                              try { const q = query(collection(db, 'historico_viagens'), where('id_estudante', '==', aluno.id_estudante), orderBy('data_hora', 'desc')); setHistoricoViagens((await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })) as ViagemHistorico[]); } 
                              catch { showAlert('Erro ao carregar histórico.', 'error'); } finally { setCarregandoHistorico(false); }
                            }} className="text-[#395D34] bg-green-50 hover:bg-green-100 p-2 rounded-full transition" title="Histórico"><Clock size={18} /></button>
                            <button onClick={() => handleEditar(aluno)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition" title="Editar"><Edit size={18} /></button>
                            <button onClick={() => handleExcluir(aluno.id_estudante)} className="text-[#890013] bg-red-50 hover:bg-red-100 p-2 rounded-full transition" title="Excluir"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === 'estudantes_cad' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in">
              <div className="bg-white p-6 rounded-2xl shadow-sm border print:hidden h-fit">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <h2 className="text-xl font-bold text-[#0B2341]">{isEditando ? 'Editando Estudante' : 'Novo Estudante'}</h2>
                  <button type="button" onClick={handleNovoCadastro} className="text-sm text-[#890013] hover:underline font-bold">Limpar / Novo</button>
                </div>
                <form onSubmit={handleSalvar} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome Completo</label>
                      <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF</label>
                      <input type="text" required value={cpf} onChange={handleCPFChange} placeholder="000.000.000-00" maxLength={14} className="w-full rounded-lg p-2.5 border outline-none bg-gray-50 border-gray-300 focus:border-[#395D34]" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Matrícula</label>
                      <input type="text" required value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="000000" className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Data Nascimento</label>
                      <input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Validade Carteira</label>
                      <input type="date" required value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Instituição</label>
                      <select required value={instituicao} onChange={e => {
                        setInstituicao(e.target.value);
                        const rotaFind = rotas.find(r => r.paradas?.includes(e.target.value));
                        if(rotaFind) setRotaAtrelada(rotaFind.nome_rota);
                      }} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none">
                        <option value="">Selecione...</option>
                        {instituicoesDisponiveis.map(inst => <option key={inst.id} value={inst.nome}>{inst.nome}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Rota Oficial</label>
                      <select required value={rotaAtrelada} onChange={e => setRotaAtrelada(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none">
                        <option value="">Selecione...</option>
                        {rotas.map(r => <option key={r.id} value={r.nome_rota}>{r.nome_rota}</option>)}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Curso</label>
                      <input type="text" required value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ex: Direito" className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Turno</label>
                      <div className="flex gap-4 pt-2">
                        {['Matutino', 'Vespertino', 'Noturno'].map(t => (
                          <label key={t} className="flex items-center cursor-pointer">
                            <input type="radio" value={t} checked={turno === t} onChange={e => setTurno(e.target.value)} className="mr-2 text-[#395D34]" />
                            <span className="text-sm text-[#0B2341] font-medium">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border border-gray-200 p-4 rounded-xl bg-gray-50">
                    <label className="block text-sm font-bold text-[#0B2341] mb-3">Foto do Estudante</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="bg-white rounded-lg overflow-hidden w-32 h-40 flex items-center justify-center border-2 border-dashed border-gray-300 relative shadow-sm shrink-0">
                        {showWebcam ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} className="w-full h-full object-cover" /> : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-300" />}
                        {showWebcam && <button type="button" onClick={() => setShowWebcam(false)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><X size={16} /></button>}
                      </div>
                      <div className="flex flex-col gap-2 w-full justify-center">
                        {showWebcam ? (
                          <button type="button" onClick={capturarFoto} className="flex justify-center items-center bg-[#395D34] text-white px-4 py-2 rounded-lg font-bold"><Camera size={18} className="mr-2"/> Capturar</button>
                        ) : (
                          <><button type="button" onClick={() => setShowWebcam(true)} className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2.5 rounded-lg font-bold"><Camera size={18} className="mr-2"/> Abrir Câmera</button>
                            <div className="relative w-full"><input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><button type="button" className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-bold w-full"><ImagePlus size={18} className="mr-2"/> Enviar Arquivo</button></div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 p-4 rounded-xl bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-bold text-[#0B2341]">Documentos Anexos</label>
                      <input type="file" multiple accept=".pdf,image/*" ref={docInputRef} onChange={handleDocumentoMultiploUpload} className="hidden" />
                      <button type="button" onClick={() => docInputRef.current?.click()} className="bg-[#0B2341] text-white px-3 py-1.5 rounded-lg font-bold text-xs"><Plus size={14} className="inline mr-1" /> Adicionar</button>
                    </div>
                    {documentosForm.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Nenhum documento.</p>
                    ) : (
                      <div className="space-y-2">
                        {documentosForm.map((docAnexo) => (
                          <div key={docAnexo.id} className="flex items-center gap-3 bg-white p-2 border border-gray-200 rounded-lg">
                            <FileText size={18} className="text-gray-400"/>
                            <input type="text" value={docAnexo.titulo} onChange={(e) => setDocumentosForm(prev => prev.map(d => d.id === docAnexo.id ? {...d, titulo: e.target.value} : d))} className="text-sm font-bold text-[#0B2341] border-b border-gray-300 outline-none bg-transparent w-full" />
                            <button type="button" onClick={() => setDocumentosForm(prev => prev.filter(d => d.id !== docAnexo.id))} className="text-red-500 p-1"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-green-200 p-4 rounded-xl bg-green-50 mb-4">
                     <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={aceiteLgpd} onChange={e => setAceiteLgpd(e.target.checked)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-[#395D34] focus:ring-[#395D34]" />
                        <span className="text-sm text-gray-700 font-medium">
                          Declaro que o titular/responsável recebeu as informações de privacidade e ciência sobre o tratamento dos dados para a gestão do Transporte Escolar. A base legal e os prazos de retenção devem estar definidos pela Prefeitura antes do uso em produção.
                        </span>
                     </label>
                     <button type="button" onClick={() => setShowPrivacyNotice(true)} className="mt-3 text-xs font-bold text-[#0B2341] underline">
                       Consultar aviso de privacidade
                     </button>
                  </div>

                  <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-4 rounded-xl font-bold shadow hover:bg-[#2c4928] disabled:opacity-50 text-lg">
                    <Save size={20} className="mr-2" /> {loading ? 'Salvando...' : (isEditando ? 'Atualizar Estudante' : 'Salvar e Gerar')}
                  </button>
                </form>
              </div>

              <div className="hidden xl:flex flex-col items-start print:fixed print:top-0 print:left-0 print:w-full print:bg-white print:p-8">
                <h2 className="text-lg font-bold mb-4 text-[#0B2341] print:hidden w-full border-b pb-2">Pré-visualização</h2>
                <CarteirinhaTemplate aluno={{ nome, cpf, matricula, data_nascimento: dataNascimento, data_vencimento: dataVencimento, instituicao_destino: instituicao, curso, turno, rota: rotaAtrelada, foto_url: foto || '' }} />
              </div>
            </div>
          )}

          {currentView === 'declaracoes' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 animate-in fade-in h-full">
              <div className="xl:col-span-9 bg-white rounded-2xl shadow-sm border p-4 md:p-6 flex flex-col h-full min-h-[800px]">
                <h2 className="text-xl font-bold text-[#0B2341] border-b pb-3 mb-4 flex items-center">
                  <FileSignature size={24} className="mr-2 text-[#395D34]" /> Criar Nova Declaração
                </h2>
                
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <label className="block text-sm font-semibold text-[#0B2341] mb-1">Título</label>
                    <input type="text" value={declTitulo} onChange={e => setDeclTitulo(e.target.value)} placeholder="Ex: Declaração de Transporte" className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#0B2341] outline-none" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Rotas (Destinatários)</label>
                      <div className="max-h-28 space-y-2 overflow-y-auto rounded-lg border border-gray-300 bg-white p-3">
                        {rotas.map((rota) => (
                          <label key={rota.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={declRotas.includes(rota.nome_rota)} onChange={() => setDeclRotas((selecionadas) => selecionadas.includes(rota.nome_rota) ? selecionadas.filter((nomeRota) => nomeRota !== rota.nome_rota) : [...selecionadas, rota.nome_rota])} className="h-4 w-4 accent-[#395D34]" />
                            {rota.nome_rota}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Validade</label>
                        <input type="date" value={declValidade} onChange={e => setDeclValidade(e.target.value)} className="w-full rounded-lg border-gray-300 p-2 border focus:border-[#0B2341] outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[#0B2341] mb-1">Assinatura</label>
                          <input type="file" accept="image/*" ref={assinaturaInputRef} onChange={handleAssinaturaUpload} className="hidden" />
                          <button onClick={() => assinaturaInputRef.current?.click()} className="w-full bg-gray-100 text-[#0B2341] border border-gray-300 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition">
                            {declAssinatura ? 'Trocar' : 'Anexar'}
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#0B2341] mb-1">Timbre A4</label>
                          <input type="file" accept="image/png,image/jpeg" ref={timbreInputRef} onChange={handleTimbreUpload} className="hidden" />
                          <button type="button" disabled={carregandoTimbre} onClick={() => timbreInputRef.current?.click()} className="w-full bg-gray-100 text-[#0B2341] border border-gray-300 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition disabled:cursor-not-allowed disabled:opacity-60">
                            {carregandoTimbre ? 'Processando...' : (declTimbreBase64 ? 'Trocar' : 'Adicionar')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="mb-1 text-base font-bold text-[#0B2341]">Texto base do documento e formatação</h3>
                    <p className="mb-3 text-sm text-gray-500">Selecione um trecho e use os botões abaixo. As variáveis serão preenchidas com os dados de exemplo.</p>
                    
                    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-100 p-2 border border-gray-300">
                      <span className="text-xs font-bold text-gray-600">Formatar:</span>
                      <button type="button" onClick={() => aplicarFormatacaoHtml('<strong>', '</strong>')} className="rounded border bg-white px-2 py-1 text-sm font-bold hover:bg-gray-50" title="Negrito"><b>B</b></button>
                      <button type="button" onClick={() => aplicarFormatacaoHtml('<i>', '</i>')} className="rounded border bg-white px-2 py-1 text-sm italic hover:bg-gray-50" title="Itálico"><i>I</i></button>
                      <button type="button" onClick={() => aplicarFormatacaoHtml('<u>', '</u>')} className="rounded border bg-white px-2 py-1 text-sm underline hover:bg-gray-50" title="Sublinhado"><u>U</u></button>
                      <button type="button" onClick={() => aplicarFormatacaoHtml('<div style="text-align: center;">', '</div>')} className="rounded border bg-white px-2 py-1 text-xs font-bold hover:bg-gray-50">Centralizar</button>
                      
                      <div className="w-px h-6 bg-gray-300 mx-2"></div>
                      
                      <span className="text-xs font-bold text-blue-800">Inserir variáveis:</span>
                      <button type="button" onClick={() => insertVariable('nome_aluno')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;nome_aluno&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('cpf_aluno')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;cpf_aluno&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('matricula')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;matricula&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('instituicao')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;instituicao&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('curso')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;curso&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('turno')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;turno&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('rota')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;rota&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('data_nascimento')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;data_nascimento&#125;&#125;</button>
                      <button type="button" onClick={() => insertVariable('data_vencimento')} className="rounded bg-white px-2 py-1 text-xs font-bold text-blue-700 shadow-sm">&#123;&#123;data_vencimento&#125;&#125;</button>
                    </div>

                    <div className="bg-[#e5e7eb] p-4 md:p-8 rounded-xl overflow-x-auto flex justify-center border border-gray-200">
                      <textarea 
                        ref={editorRef} 
                        value={declConteudo} 
                        onChange={e => setDeclConteudo(e.target.value)} 
                        onKeyDown={handleEnterDocumento} 
                        placeholder="Comece a digitar o texto da declaração..." 
                        className="w-full max-w-[794px] min-h-[1123px] shrink-0 p-8 sm:p-[20mm] bg-white shadow-lg border border-gray-300 text-[11pt] sm:text-[12pt] leading-[1.6] text-black outline-none focus:ring-2 focus:ring-[#395D34] resize-vertical" 
                        style={{ fontFamily: 'Arial, sans-serif' }} 
                      />
                    </div>
                  </div>

                  <div className="mt-8 border-t border-gray-200 pt-4">
                    <h3 className="mb-2 text-sm font-bold text-[#0B2341]">Prévia Final (Com Timbre e Assinatura - Dados Fictícios)</h3>
                    <p className="mb-3 text-xs text-gray-500">Arraste a assinatura para o ponto desejado da folha.</p>
                    
                    <div className="bg-[#e5e7eb] p-4 md:p-8 rounded-xl overflow-x-auto flex justify-center border border-gray-200">
                      <div 
                        className="relative w-full max-w-[794px] min-h-[1123px] shrink-0 overflow-hidden bg-white shadow-lg border border-gray-300 p-8 sm:p-[20mm]" 
                        onPointerMove={atualizarPosicaoAssinatura} 
                        onPointerUp={() => setArrastandoAssinatura(false)} 
                        onPointerCancel={() => setArrastandoAssinatura(false)}
                      >
                        {declTimbreBase64 && <img src={declTimbreBase64} alt="Timbre da declaração" className="pointer-events-none absolute inset-0 h-full w-full object-cover z-0 opacity-90" />}
                        
                        <div
                          className="relative z-10 text-[11pt] sm:text-[12pt] leading-[1.6] text-black break-words whitespace-pre-wrap"
                          style={{ fontFamily: 'Arial, sans-serif' }}
                          dangerouslySetInnerHTML={{ __html: parseVariaveisDeclaracao(declConteudo) || '<span style="color: #9ca3af;">O texto da declaração aparecerá aqui...</span>' }}
                        />

                        {declAssinatura && (
                          <button type="button" onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setArrastandoAssinatura(true); }} style={{ left: `${declAssinaturaPos.x}%`, top: `${declAssinaturaPos.y}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-move touch-none rounded border border-dashed border-[#395D34] bg-white/80 p-1 shadow-md">
                            <img src={declAssinatura} alt="Assinatura arrastável" className="h-16 w-auto object-contain pointer-events-none" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <button onClick={handleSalvarDeclaracao} disabled={loading} className="w-full bg-[#395D34] text-white py-4 rounded-xl font-bold shadow hover:bg-[#2c4928] disabled:opacity-50 text-lg flex justify-center items-center mt-6">
                    <Save size={20} className="mr-2" /> Emitir Declaração
                  </button>
                </div>
              </div>

              <div className="xl:col-span-3 bg-white rounded-2xl shadow-sm border p-4 md:p-6 h-fit">
                <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">Declarações Ativas</h2>
                <div className="space-y-3">
                  {declaracoes.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhuma declaração ativa.</p>
                  ) : (
                    declaracoes.map(decl => (
                      <div key={decl.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-[#0B2341] leading-tight pr-2">{decl.titulo}</h3>
                          <button onClick={() => handleExcluirDeclaracao(decl.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg hover:bg-red-100 transition shrink-0"><Trash2 size={16} /></button>
                        </div>
                        <div className="text-xs text-gray-500 font-medium mb-2">Rotas: {decl.rotas.join(', ')}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {currentView === 'motoristas_cad' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 max-w-6xl mx-auto animate-in fade-in">
              <div className="bg-white p-6 rounded-2xl shadow-sm border">
                <div className="flex justify-between items-center border-b pb-4 mb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Logística & Frota</p>
                    <h2 className="text-2xl font-black text-[#0B2341]">{motEditId ? 'Editar motorista' : 'Novo motorista'}</h2>
                  </div>
                  {motEditId && <button type="button" onClick={resetMotoristaForm} className="text-sm text-[#890013] font-bold">Cancelar</button>}
                </div>

                <form onSubmit={handleSalvarMotorista} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-[#0B2341] mb-1">Nome completo</label>
                      <input type="text" required value={motNome} onChange={e => setMotNome(e.target.value)}
                        className="w-full rounded-xl border-gray-300 p-3 border bg-gray-50 outline-none focus:border-[#395D34]" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0B2341] mb-1">CPF</label>
                      <input type="text" required value={motCpf} onChange={handleCpfMotoristaChange} placeholder="000.000.000-00" maxLength={14}
                        className="w-full rounded-xl p-3 border outline-none bg-gray-50 border-gray-300 focus:border-[#395D34]" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#0B2341] mb-1">CNH</label>
                      <input type="text" required value={motCnh} onChange={e => setMotCnh(e.target.value)}
                        className="w-full rounded-xl border-gray-300 p-3 border bg-gray-50 outline-none focus:border-[#395D34]" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-[#0B2341] mb-1">WhatsApp</label>
                      <input type="text" required value={motTelefone} onChange={handleTelefoneChange} maxLength={15}
                        className="w-full rounded-xl border-gray-300 p-3 border bg-gray-50 outline-none focus:border-[#395D34]" />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-black text-[#0B2341]">Foto do motorista</p>
                        <p className="text-xs text-gray-500">Obrigatória para novos cadastros. JPEG.</p>
                      </div>
                      {motFoto && <span className="text-xs font-bold text-green-700 flex items-center gap-1"><CheckCircle2 size={14}/> Foto pronta</span>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="w-32 h-40 rounded-xl overflow-hidden bg-white border-2 border-dashed border-gray-300 flex items-center justify-center relative shrink-0">
                        {showMotWebcam ? (
                          <Webcam audio={false} ref={motWebcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: 'user' }} className="w-full h-full object-cover" />
                        ) : motFoto ? (
                          <img src={motFoto} alt="Pré-visualização do motorista" className="w-full h-full object-cover" />
                        ) : (
                          <User size={42} className="text-gray-300" />
                        )}
                        {showMotWebcam && <button type="button" onClick={() => setShowMotWebcam(false)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"><X size={15}/></button>}
                      </div>
                      <div className="flex flex-col gap-2 justify-center flex-1">
                        {showMotWebcam ? (
                          <button type="button" onClick={capturarFotoMotorista} className="bg-[#395D34] text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center"><Camera size={18} className="mr-2"/> Capturar foto</button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setShowMotWebcam(true)} className="bg-[#0B2341] text-white py-2.5 px-4 rounded-xl font-bold flex items-center justify-center"><Camera size={18} className="mr-2"/> Usar câmera</button>
                            <label className="bg-white border border-gray-300 text-gray-700 py-2.5 px-4 rounded-xl font-bold flex items-center justify-center cursor-pointer">
                              <ImagePlus size={18} className="mr-2"/> Escolher foto
                              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFotoMotoristaUpload} className="hidden" />
                            </label>
                          </>
                        )}
                        <p className="text-[11px] text-gray-400">A foto é dado pessoal e será armazenada diretamente no Firestore como código seguro (Base64).</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900 flex gap-2">
                    <Info size={17} className="shrink-0 mt-0.5"/>
                    <p>Os dados são utilizados exclusivamente para identificação, gestão da frota, segurança operacional e autenticação do motorista, conforme a finalidade e a base legal definidas pelo controlador.</p>
                  </div>

                  <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3.5 rounded-xl font-black shadow hover:bg-[#2c4928] disabled:opacity-50 text-lg flex items-center justify-center">
                    <Save size={20} className="mr-2"/> {loading ? 'Salvando...' : (motEditId ? 'Atualizar motorista' : 'Salvar motorista')}
                  </button>
                </form>
              </div>

              <div className="bg-[#0B2341] text-white rounded-2xl p-6 h-fit">
                <div className="flex items-center gap-3 mb-5"><ShieldCheck size={25}/><h3 className="font-black text-lg">Cadastro protegido</h3></div>
                <div className="space-y-4 text-sm text-white/80">
                  <div className="flex gap-3"><LockKeyhole size={18} className="shrink-0"/><p>CPF e CNH não aparecem em listas públicas do painel. A interface exibe apenas o necessário para a operação.</p></div>
                  <div className="flex gap-3"><Database size={18} className="shrink-0"/><p>Fotos e documentos agora são salvos diretamente no banco em formato criptografado, garantindo alta disponibilidade.</p></div>
                  <div className="flex gap-3"><Activity size={18} className="shrink-0"/><p>Alterações importantes podem ser registradas na coleção de auditoria para rastreabilidade.</p></div>
                  <div className="flex gap-3"><Scale size={18} className="shrink-0"/><p>A base legal não deve ser escolhida automaticamente pelo sistema. O controlador precisa documentar finalidade, hipótese legal e retenção.</p></div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'motoristas_lista' && (
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border animate-in fade-in max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Logística & Frota</p>
                  <h2 className="text-2xl font-black text-[#0B2341]">Motoristas ativos</h2>
                </div>
                <div className="relative w-full md:w-72">
                  <input type="text" placeholder="Buscar por nome..." value={buscaMotorista} onChange={e => setBuscaMotorista(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:border-[#0B2341] outline-none" />
                  <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filterMotoristas.map(m => (
                  <div key={m.id} className="rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border shrink-0">
                        {m.foto_url ? <img src={m.foto_url} alt="" className="w-full h-full object-cover"/> : <User className="w-full h-full p-4 text-gray-300"/>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-[#0B2341] truncate">{m.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">CPF {mascararCpf(m.cpf)}</p>
                        <p className="text-xs text-gray-500">{m.telefone}</p>
                        <div className="mt-2">
                          {m.uid_vinculado
                            ? <span className="text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded-full font-bold inline-flex items-center"><KeyRound size={11} className="mr-1"/> Acesso ativo</span>
                            : <span className="text-[10px] text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full font-bold inline-flex items-center"><AlertTriangle size={11} className="mr-1"/> Sem acesso</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                      {m.uid_vinculado && <button onClick={() => handleZerarSenhaMotorista(m)} className="text-orange-600 bg-orange-50 hover:bg-orange-100 p-2 rounded-lg" title="Desvincular acesso"><KeyRound size={17}/></button>}
                      <button onClick={() => {setMotEditId(m.id); setMotNome(m.nome); setMotCpf(formatarCpfCompleto(m.cpf)); setMotCnh(m.cnh); setMotTelefone(m.telefone); setMotFoto(m.foto_url || null); setCurrentView('motoristas_cad');}} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg" title="Editar"><Edit size={17}/></button>
                      <button onClick={() => {showConfirm('Deseja desativar este motorista? A exclusão física deve respeitar a política de retenção.', async () => {await updateDoc(doc(db, 'motoristas', m.id), { ativo: false, atualizadoEm: serverTimestamp(), atualizadoPor: auth.currentUser?.uid || null }); await registrarAuditoria('DESATIVACAO', 'motorista', m.id); carregarDados();});}} className="text-[#890013] bg-red-50 hover:bg-red-100 p-2 rounded-lg" title="Desativar"><Trash2 size={17}/></button>
                    </div>
                  </div>
                ))}
              </div>
              {filterMotoristas.length === 0 && <p className="text-center text-gray-400 py-10">Nenhum motorista encontrado.</p>}
            </div>
          )}

          {currentView === 'instituicoes' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in max-w-5xl mx-auto">
                <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">Nova Instituição</h2>
                  <form onSubmit={handleSalvarInstituicao} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nome da Escola/Faculdade</label>
                      <input type="text" required value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)} placeholder="Ex: UFRPE, AESGA..." className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold shadow hover:bg-[#2c4928]">Salvar Instituição</button>
                  </form>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Instituições Cadastradas</h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nome</th><th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th></tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {instituicoesDisponiveis.map(inst => (
                          <tr key={inst.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-sm text-[#0B2341]">{inst.nome}</td><td className="px-6 py-4 text-center"><button onClick={() => {showConfirm('Excluir Instituição?', async () => {await deleteDoc(doc(db, 'instituicoes', inst.id)); carregarDados();});}} className="text-[#890013] bg-red-50 p-2 rounded-full hover:bg-red-100 transition"><Trash2 size={16} /></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          )}

          {currentView === 'rotas' && (
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in max-w-7xl mx-auto">
                <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">{rotaEditId ? 'Editar Rota' : 'Nova Rota'}</h2>
                  <form onSubmit={handleSalvarRota} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Nome da Rota</label>
                      <input type="text" required value={rotaNome} onChange={e => setRotaNome(e.target.value)} placeholder="Ex: Rota 01 - Matutino" className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Motorista Vinculado</label>
                      <select required value={rotaMotoristaCpf} onChange={e => setRotaMotoristaCpf(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none">
                        <option value="">Selecione um motorista...</option>
                        {motoristas.filter(m => m.ativo !== false).map(m => (
                          <option key={m.id} value={m.cpf}>{m.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Link do Grupo WhatsApp</label>
                      <input type="url" value={whatsappRota} onChange={e => setWhatsappRota(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    
                    <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold shadow hover:bg-[#2c4928] transition">
                      {rotaEditId ? 'Atualizar Rota' : 'Salvar Rota'}
                    </button>
                    {rotaEditId && (
                      <button type="button" onClick={() => {setRotaEditId(null); setRotaNome(''); setWhatsappRota(''); setRotaMotoristaCpf('');}} className="w-full text-red-600 font-bold mt-2">
                        Cancelar
                      </button>
                    )}
                  </form>
                </div>
                
                <div className="lg:col-span-8 bg-white p-6 rounded-2xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Rotas Cadastradas</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rotas.length === 0 ? (
                      <p className="text-gray-400 text-sm md:col-span-2 text-center py-6">Nenhuma rota cadastrada no momento.</p>
                    ) : (
                      rotas.map(rota => (
                        <div key={rota.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:shadow-sm transition">
                          <h3 className="font-bold text-lg text-[#0B2341]">{rota.nome_rota}</h3>
                          <p className="text-sm text-gray-600 mt-1 flex items-center">
                            <Truck size={14} className="mr-1 text-gray-400" /> {rota.motorista_nome || 'Sem motorista vinculado'}
                          </p>
                          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                            <button onClick={() => {setRotaEditId(rota.id); setRotaNome(rota.nome_rota); setWhatsappRota(rota.whatsapp_link || ''); setRotaMotoristaCpf(rota.motorista_cpf || '');}} className="text-blue-600 bg-blue-100 hover:bg-blue-200 p-2 rounded-lg transition" title="Editar"><Edit size={16}/></button>
                            <button onClick={() => {setRotaSelecionadaParaParadas(rota); setModalParadasAberto(true);}} className="text-purple-600 bg-purple-100 hover:bg-purple-200 p-2 rounded-lg transition" title="Paradas / Instituições Atendidas"><MapPin size={16}/></button>
                            <button onClick={() => {showConfirm('Excluir Rota? Isso não apaga os estudantes, apenas a rota.', async () => {await deleteDoc(doc(db, 'rotas', rota.id)); carregarDados();});}} className="text-red-600 bg-red-100 hover:bg-red-200 p-2 rounded-lg transition" title="Excluir"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
             </div>
          )}

          {currentView === 'privacidade' && (
            <div className="max-w-4xl mx-auto bg-white p-6 md:p-10 rounded-2xl shadow-sm border animate-in fade-in">
              <div className="flex items-center gap-4 border-b pb-4 mb-6">
                <LockKeyhole size={36} className="text-[#395D34]" />
                <div>
                  <h2 className="text-2xl font-black text-[#0B2341]">Privacidade e Proteção de Dados (LGPD)</h2>
                  <p className="text-gray-500">Diretrizes de uso do sistema de Transporte Escolar Municipal</p>
                </div>
              </div>
              <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#0B2341] mb-2 flex items-center gap-2"><Scale size={18} /> Finalidade do Tratamento</h3>
                  <p>Os dados pessoais dos estudantes e motoristas são coletados e armazenados exclusivamente para a gestão, segurança e roteirização do Transporte Escolar Municipal, de acordo com o interesse público e obrigação legal da Prefeitura.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#0B2341] mb-2 flex items-center gap-2"><Database size={18} /> Retenção e Exclusão</h3>
                  <p>Os dados devem ser eliminados das bases de dados assim que a finalidade for alcançada (ex: estudante concluinte) ou decorrido o prazo legal de guarda de documentos fiscais/públicos definidos pela Procuradoria do Município.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#0B2341] mb-2 flex items-center gap-2"><Activity size={18} /> Auditoria Operacional</h3>
                  <p>Todas as ações de criação, edição ou remoção de cadastros geram logs na base de dados para garantir a rastreabilidade em caso de incidente de segurança. O uso da plataforma é restrito a operadores autorizados.</p>
                </div>
                <p className="text-xs text-center text-gray-400 mt-8 pt-4 border-t">Aviso de Privacidade - Versão: {LGPD_NOTICE_VERSION}</p>
              </div>
            </div>
          )}

        </div>
      </main>

      {modalParadasAberto && rotaSelecionadaParaParadas && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-[#0B2341]">Instituições Atendidas</h3>
              <button onClick={() => setModalParadasAberto(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={24}/></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Selecione as instituições que fazem parte do itinerário da rota <strong>{rotaSelecionadaParaParadas.nome_rota}</strong>.</p>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-2">
              {instituicoesDisponiveis.map(inst => {
                const includes = rotaSelecionadaParaParadas.paradas?.includes(inst.nome) || false;
                return (
                  <label key={inst.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${includes ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50 border-gray-200'}`}>
                    <input type="checkbox" checked={includes} onChange={() => toggleParadaInstituicao(inst.nome, includes)} className="w-5 h-5 accent-[#395D34]" />
                    <span className={`font-medium ${includes ? 'text-green-800' : 'text-gray-700'}`}>{inst.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalDocsAlunoAberto && alunoDocs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-[#0B2341]">Documentos de {alunoDocs.nome.split(' ')[0]}</h3>
              <button onClick={() => setModalDocsAlunoAberto(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={24}/></button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {!alunoDocs.documentos || alunoDocs.documentos.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Nenhum documento anexado.</p>
              ) : (
                alunoDocs.documentos.map(docAnexo => (
                  <div key={docAnexo.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileText className="text-purple-600" size={20} />
                      <span className="font-semibold text-sm text-[#0B2341]">{docAnexo.titulo}</span>
                    </div>
                    
                    {docAnexo.url && !docAnexo.base64 ? (
                      <a href={docAnexo.url} target="_blank" rel="noreferrer" className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-200 transition">Abrir Link Antigo</a>
                    ) : docAnexo.base64 ? (
                      <a href={docAnexo.base64} download={docAnexo.nome_arquivo || 'documento'} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 transition">Baixar Documento</a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {modalHistoricoAberto && alunoHistorico && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-[#0B2341]">Histórico de Embarques - {alunoHistorico.nome.split(' ')[0]}</h3>
              <button onClick={() => setModalHistoricoAberto(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={24}/></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {carregandoHistorico ? (
                <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-[#395D34] border-t-transparent rounded-full animate-spin"></div></div>
              ) : historicoViagens.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Nenhum embarque registrado.</p>
              ) : (
                <div className="space-y-3 pr-2">
                  {historicoViagens.map(viagem => (
                    <div key={viagem.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <div>
                        <p className="font-bold text-[#0B2341] text-sm">{viagem.id_rota_onibus || viagem.id_rota || 'Desconhecida'}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12}/> {new Date(viagem.data_hora?.toDate?.() || viagem.data_hora).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${viagem.tipo_viagem === 'ida' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {viagem.tipo_viagem}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPrivacyNotice && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg text-[#0B2341] flex items-center gap-2"><Info className="text-[#395D34]"/> Aviso de Privacidade</h3>
              <button onClick={() => setShowPrivacyNotice(false)} className="text-gray-400 hover:text-gray-700 transition"><X size={24}/></button>
            </div>
            <div className="text-sm text-gray-600 space-y-3">
              <p>Ao realizar o cadastro, os dados inseridos (incluindo biometria facial) serão armazenados na nuvem (Firebase) para finalidade exclusiva de gestão do Transporte Escolar Municipal.</p>
              <p>A exclusão do aluno do painel remove a visualização imediata, mas a remoção física dos arquivos de imagem deve respeitar a política de retenção do município (LGPD Art. 16).</p>
            </div>
            <button onClick={() => setShowPrivacyNotice(false)} className="mt-6 w-full bg-[#0B2341] text-white py-2.5 rounded-lg font-bold">Ciente</button>
          </div>
        </div>
      )}

    </div>
  );
}
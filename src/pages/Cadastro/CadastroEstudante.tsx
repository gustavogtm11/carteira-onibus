// src/pages/Cadastro/CadastroEstudante.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QRCode from 'react-qr-code';
import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp, addDoc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAlert } from '../../contexts/AlertContext';
import { 
  Camera, Save, Printer, User, Search, Edit, ImagePlus, X, List, UserPlus, LogOut, 
  Trash2, Users, Truck, MapPin, Clock, FileText, MessageCircle, Eye, Plus, Building, 
  Menu, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, FileSignature
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

// ================= INTERFACES =================
interface DocumentoAnexo {
  id: string;
  titulo: string;
  base64: string;
  nome_arquivo: string;
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
}

interface Rota {
  id: string;
  nome_rota: string;
  whatsapp_link?: string;
  paradas?: string[];
  motorista_cpf?: string;
  motorista_nome?: string;
}

interface ViagemHistorico {
  id: string;
  data_hora: any;
  id_rota_onibus?: string;
  id_rota?: string;
  tipo_viagem: 'ida' | 'volta';
}

interface Declaracao {
  id: string;
  titulo: string;
  conteudoHtml: string;
  assinatura_url?: string;
  rotas: string[];
  data_validade: string;
}

// Tipagem das telas do menu
type ViewType = 'estudantes_cad' | 'estudantes_lista' | 'motoristas_cad' | 'motoristas_lista' | 'instituicoes' | 'rotas' | 'declaracoes';

export default function CadastroEstudante() {
  const { showAlert, showConfirm } = useAlert();

  // Estados de Navegação do Menu Sidebar
  const [currentView, setCurrentView] = useState<ViewType>('estudantes_lista');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile
  const [isSidebarHovered, setIsSidebarHovered] = useState(false); // Desktop

  const hoje = new Date();
  const dataHojeStr = hoje.toISOString().split('T')[0];
  const fimDoAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split('T')[0];

  // ================= ESTADOS ESTUDANTE =================
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
  
  const [instituicoesDisponiveis, setInstituicoesDisponiveis] = useState<InstituicaoDB[]>([]);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [isEditando, setIsEditando] = useState(false);

  // ================= ESTADOS MOTORISTA =================
  const [motEditId, setMotEditId] = useState<string | null>(null);
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [buscaMotorista, setBuscaMotorista] = useState('');

  // ================= ESTADOS ROTA =================
  const [rotaEditId, setRotaEditId] = useState<string | null>(null);
  const [rotaNome, setRotaNome] = useState('');
  const [whatsappRota, setWhatsappRota] = useState('');
  const [rotaMotoristaCpf, setRotaMotoristaCpf] = useState('');
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionadaParaParadas, setRotaSelecionadaParaParadas] = useState<Rota | null>(null);
  const [modalParadasAberto, setModalParadasAberto] = useState(false);
  
  const [novaInstNome, setNovaInstNome] = useState('');

  // ================= ESTADOS DECLARAÇÕES =================
  const [declaracoes, setDeclaracoes] = useState<Declaracao[]>([]);
  const [declTitulo, setDeclTitulo] = useState('');
  const [declRotas, setDeclRotas] = useState<string[]>([]);
  const [declValidade, setDeclValidade] = useState(fimDoAno);
  const [declAssinatura, setDeclAssinatura] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // ================= OUTROS ESTADOS =================
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

  // ================= CARREGAMENTO INICIAL =================
  const carregarDados = async () => {
    try {
      const qEstudantes = query(collection(db, 'estudantes'), orderBy('nome'));
      const snapEstudantes = await getDocs(qEstudantes);
      setEstudantes(snapEstudantes.docs.map(doc => doc.data() as Estudante));

      const snapInstituicoes = await getDocs(query(collection(db, 'instituicoes'), orderBy('nome')));
      setInstituicoesDisponiveis(snapInstituicoes.docs.map(doc => ({ id: doc.id, nome: doc.data().nome })));

      const snapMotoristas = await getDocs(collection(db, 'motoristas'));
      setMotoristas(snapMotoristas.docs.map(d => ({ id: d.id, ...d.data() } as Motorista)));

      const snapRotas = await getDocs(collection(db, 'rotas'));
      setRotas(snapRotas.docs.map(d => ({ id: d.id, ...d.data() } as Rota)));

      // Carregar e Excluir Declarações Vencidas
      const snapDecl = await getDocs(collection(db, 'declaracoes'));
      const declsValidas: Declaracao[] = [];
      snapDecl.forEach(async (d) => {
        const data = d.data() as Declaracao;
        if (data.data_validade && data.data_validade < dataHojeStr) {
          await deleteDoc(doc(db, 'declaracoes', d.id)); // Exclui do banco
        } else {
          declsValidas.push({ ...data, id: d.id });
        }
      });
      setDeclaracoes(declsValidas);

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // ================= FUNÇÕES UTILITÁRIAS =================
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
    const primeiro = partes[0];
    const ultimo = partes[partes.length - 1];
    const doMeio = partes.slice(1, -1).map(p => p.length > 2 ? p[0] + '.' : p).join(' ');
    return `${primeiro} ${doMeio} ${ultimo}`;
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

  // ================= ESTUDANTES =================
  const handleNovoCadastro = () => {
    setNome(''); setCpf(''); setMatricula(''); setDataNascimento(''); 
    setDataVencimento(fimDoAno); setInstituicao(''); setCurso(''); 
    setTurno('Matutino'); setRotaAtrelada(''); setFoto(null);
    setDocumentosForm([]);
    setIsEditando(false);
    setCurrentView('estudantes_cad');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foto) return showAlert('É necessário ter uma foto do estudante!', 'error');
    if (!cpf || cpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');
    if (!instituicao) return showAlert('Selecione uma instituição.', 'error');
    
    setLoading(true);
    try {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const instExiste = instituicoesDisponiveis.some(i => i.nome.toLowerCase() === instituicao.toLowerCase());
      if (!instExiste && instituicao.trim() !== '') {
        await addDoc(collection(db, 'instituicoes'), { nome: instituicao.trim() });
      }

      await setDoc(doc(db, 'estudantes', cpfLimpo), {
        id_estudante: cpfLimpo,
        nome, cpf, matricula, data_nascimento: dataNascimento, data_vencimento: dataVencimento,
        instituicao_destino: instituicao, curso, turno, rota: rotaAtrelada,
        foto_url: foto, documentos: documentosForm, atualizadoEm: serverTimestamp()
      });

      showAlert(isEditando ? 'Estudante atualizado com sucesso!' : 'Estudante salvo com sucesso!', 'success');
      carregarDados();
      handleNovoCadastro(); 
      setCurrentView('estudantes_lista');
    } catch (error) {
      showAlert('Erro ao salvar estudante. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (aluno: Estudante) => {
    setNome(aluno.nome); setCpf(aluno.cpf); setMatricula(aluno.matricula || '');
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
    setIsEditando(true);
    setCurrentView('estudantes_cad');
  };

  const handleExcluir = (id_estudante: string) => {
    showConfirm('Atenção: Tem certeza que deseja EXCLUIR este estudante permanentemente?', async () => {
      await deleteDoc(doc(db, 'estudantes', id_estudante));
      showAlert('Estudante excluído.', 'success');
      carregarDados();
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
        let finalBase64 = '';

        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
          const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
          if (compressedBlob.size > 1024 * 1024 * 1.5) { showAlert(`O arquivo ${file.name} é muito grande.`, 'error'); continue; }
          finalBase64 = await new Promise((resolve) => {
            const reader = new FileReader(); reader.readAsDataURL(compressedBlob); reader.onload = () => resolve(reader.result as string);
          });
        } else if (file.type.startsWith('image/')) {
          finalBase64 = await comprimirImagem(file, 800);
        } else {
           showAlert(`Formato não suportado: ${file.name}`, 'error'); continue;
        }
        novosDocs.push({ id: Date.now().toString() + i, titulo: `Documento ${documentosForm.length + novosDocs.length + 1}`, base64: finalBase64, nome_arquivo: file.name });
      }
      setDocumentosForm(prev => [...prev, ...novosDocs]);
      showAlert('Documento(s) anexado(s) com sucesso!', 'success');
    } catch (error) {
      showAlert('Erro ao processar arquivo(s).', 'error');
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  // ================= MOTORISTAS & ROTAS & INSTITUIÇÕES =================
  const handleSalvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motCpf || motCpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');
    setLoading(true);
    try {
      const cpfLimpo = motCpf.replace(/\D/g, '');
      const dataMotorista = { id: cpfLimpo, nome: motNome, cpf: cpfLimpo, cnh: motCnh, telefone: motTelefone };
      
      if (motEditId) await updateDoc(doc(db, 'motoristas', motEditId), dataMotorista);
      else await setDoc(doc(db, 'motoristas', cpfLimpo), { ...dataMotorista, data_cadastro: serverTimestamp() });
      
      showAlert('Motorista salvo com sucesso!', 'success');
      setMotEditId(null); setMotNome(''); setMotCpf(''); setMotCnh(''); setMotTelefone('');
      carregarDados();
    } catch (error) { showAlert('Erro ao salvar motorista.', 'error'); } finally { setLoading(false); }
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
    } catch (error) { showAlert('Erro ao salvar rota.', 'error'); } finally { setLoading(false); }
  };

  const handleSalvarInstituicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaInstNome.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'instituicoes'), { nome: novaInstNome.trim() });
      showAlert('Instituição cadastrada!', 'success');
      setNovaInstNome(''); carregarDados();
    } catch (error) { showAlert('Erro ao cadastrar.', 'error'); } finally { setLoading(false); }
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
    } catch (err) { showAlert('Erro ao atualizar parada.', 'error'); }
  };

  // ================= DECLARAÇÕES (WYSIWYG) =================
  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertVariable = (variable: string) => {
    const textToInsert = `{{${variable}}}`;
    document.execCommand('insertText', false, textToInsert);
    editorRef.current?.focus();
  };

  const handleAssinaturaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = await comprimirImagem(file, 600);
      setDeclAssinatura(img);
    }
  };

  const handleSalvarDeclaracao = async () => {
    if (!declTitulo.trim()) return showAlert('Dê um título à declaração.', 'info');
    if (!editorRef.current?.innerHTML || editorRef.current.innerHTML === '<br>') return showAlert('O conteúdo não pode estar vazio.', 'info');
    if (declRotas.length === 0) return showAlert('Selecione pelo menos uma rota.', 'info');

    setLoading(true);
    try {
      await addDoc(collection(db, 'declaracoes'), {
        titulo: declTitulo,
        conteudoHtml: editorRef.current.innerHTML,
        assinatura_url: declAssinatura || null,
        rotas: declRotas,
        data_validade: declValidade,
        criadoEm: serverTimestamp()
      });
      showAlert('Declaração criada e enviada com sucesso!', 'success');
      setDeclTitulo(''); setDeclRotas([]); setDeclAssinatura(null); setDeclValidade(fimDoAno);
      if (editorRef.current) editorRef.current.innerHTML = '';
      carregarDados();
    } catch (err) {
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

  // ================= TEMPLATE DE IMPRESSÃO (CARTEIRA) =================
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
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Documento (CPF)</span><p className="text-[10px] font-bold text-[#0B2341]">{aluno.cpf || '000.000.000-00'}</p></div>
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Nascimento</span><p className="text-[10px] font-bold text-[#0B2341]">{aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '00/00/0000'}</p></div>
          <div><span className="text-[7px] text-gray-500 uppercase leading-none">Rota Oficial</span><p className="text-[9px] font-bold text-[#395D34] leading-tight line-clamp-2">{aluno.rota || 'Não vinculada'}</p></div>
        </div>
        <div className="w-[50%] flex flex-col items-center justify-center border-l border-gray-100 pl-2">
          <div className="bg-white p-1 border border-[#0B2341] rounded shadow-md"><QRCode value={aluno.cpf ? aluno.cpf.replace(/\D/g, '') : 'ID_ESTUDANTE'} size={60} level="M"/></div>
          <span className="text-[6px] font-bold text-gray-400 mt-1.5 text-center leading-tight">USO PESSOAL E<br/>INTRANSFERÍVEL</span>
        </div>
      </div>
    </div>
  );

  const filterEstudantes = estudantes.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.cpf.includes(busca));
  const filterMotoristas = motoristas.filter(m => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) || m.cpf.includes(buscaMotorista));

  // ================= RENDERIZAÇÃO PRINCIPAL =================
  return (
    <div className={`h-screen flex bg-gray-50 overflow-hidden ${modoImpressaoLote ? 'print:p-0 print:bg-white' : ''}`}>
      
      {/* IMPRESSÃO EM LOTE (Oculta na tela normal) */}
      {modoImpressaoLote && (
        <div className="hidden print:flex flex-col gap-4 w-full items-center">
          {estudantes.filter(e => selecionados.includes(e.id_estudante)).map((aluno) => (
            <CarteirinhaTemplate key={aluno.id_estudante} aluno={aluno} />
          ))}
        </div>
      )}

      {/* OVERLAY MOBILE PARA SIDEBAR */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* SIDEBAR HAMBURGUER (Responsivo) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-[#0B2341] text-white flex flex-col transition-all duration-300 print:hidden
          ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} 
          lg:translate-x-0 lg:static ${isSidebarHovered ? 'lg:w-64' : 'lg:w-20'} shadow-2xl`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-white/10 overflow-hidden shrink-0">
          <div className="flex items-center gap-3">
            <img src="/logo-prefeitura.png" alt="Logo" className="w-8 h-8 object-contain shrink-0 bg-white p-1 rounded" />
            <span className={`font-bold text-sm whitespace-nowrap transition-opacity duration-300 ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Prefeitura Angelim</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/60 hover:text-white"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
          <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 mt-2 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
            {(isSidebarHovered || isSidebarOpen) ? 'Gestão de Alunos' : '...'}
          </div>
          <button onClick={() => {setCurrentView('estudantes_lista'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'estudantes_lista' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <List size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Lista de Estudantes</span>
          </button>
          <button onClick={() => {handleNovoCadastro(); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'estudantes_cad' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <UserPlus size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Cadastrar Estudante</span>
          </button>
          <button onClick={() => {setCurrentView('declaracoes'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'declaracoes' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <FileSignature size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Declarações (Word)</span>
          </button>

          <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 mt-4 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
            {(isSidebarHovered || isSidebarOpen) ? 'Logística & Cadastros' : '...'}
          </div>
          <button onClick={() => {setCurrentView('motoristas_lista'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'motoristas_lista' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Users size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Motoristas Ativos</span>
          </button>
          <button onClick={() => {setCurrentView('motoristas_cad'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'motoristas_cad' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Truck size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Cadastrar Motorista</span>
          </button>
          <button onClick={() => {setCurrentView('rotas'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'rotas' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <MapPin size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Gestão de Rotas</span>
          </button>
          <button onClick={() => {setCurrentView('instituicoes'); setIsSidebarOpen(false);}} className={`flex items-center gap-4 px-3 py-3 rounded-xl transition ${currentView === 'instituicoes' ? 'bg-[#395D34] text-white font-bold' : 'hover:bg-white/10 text-gray-300'}`}>
            <Building size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Instituições (Escolas)</span>
          </button>
        </div>

        <div className="p-4 border-t border-white/10 shrink-0">
          <button onClick={() => signOut(auth)} className="flex items-center gap-4 px-3 py-3 w-full rounded-xl hover:bg-red-900/50 text-red-300 transition">
            <LogOut size={20} className="shrink-0" />
            <span className={`whitespace-nowrap transition-opacity ${(isSidebarHovered || isSidebarOpen) ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden print:overflow-visible relative">
        
        {/* Topbar Mobile */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:hidden shrink-0 print:hidden justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-[#0B2341] hover:bg-gray-100 rounded-lg"><Menu size={24} /></button>
            <h1 className="font-bold text-[#0B2341]">Menu Principal</h1>
          </div>
        </header>

        {/* Conteúdo Dinâmico */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${modoImpressaoLote ? 'print:p-0' : ''}`}>
          
          {/* =========== TELA: LISTA ESTUDANTES =========== */}
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
                          <div><div className="text-sm font-bold text-[#0B2341]">{aluno.nome}</div><div className="text-xs text-gray-500">{aluno.cpf}</div></div>
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

          {/* =========== TELA: CADASTRO ESTUDANTE =========== */}
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
                      <input type="text" required value={cpf} onChange={handleCPFChange} disabled={isEditando} placeholder="000.000.000-00" maxLength={14} className={`w-full rounded-lg p-2.5 border outline-none ${isEditando ? 'bg-gray-200 cursor-not-allowed border-gray-200' : 'bg-gray-50 border-gray-300 focus:border-[#395D34]'}`} />
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

                  <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-4 rounded-xl font-bold shadow hover:bg-[#2c4928] disabled:opacity-50 text-lg">
                    <Save size={20} className="mr-2" /> {loading ? 'Salvando...' : (isEditando ? 'Atualizar Estudante' : 'Salvar e Gerar')}
                  </button>
                </form>
              </div>

              <div className="flex flex-col items-center xl:items-start print:fixed print:top-0 print:left-0 print:w-full print:bg-white print:p-8">
                <h2 className="text-lg font-bold mb-4 text-[#0B2341] print:hidden w-full border-b pb-2">Pré-visualização (Tamanho Real)</h2>
                <CarteirinhaTemplate aluno={{ nome, cpf, matricula, data_nascimento: dataNascimento, data_vencimento: dataVencimento, instituicao_destino: instituicao, curso, turno, rota: rotaAtrelada, foto_url: foto || '' }} />
              </div>
            </div>
          )}

          {/* =========== TELA: DECLARAÇÕES (WORD-LIKE) =========== */}
          {currentView === 'declaracoes' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in h-full">
              
              {/* Formulário do Documento */}
              <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6 flex flex-col h-full min-h-[600px]">
                <h2 className="text-xl font-bold text-[#0B2341] border-b pb-3 mb-4 flex items-center">
                  <FileSignature size={24} className="mr-2 text-[#395D34]" /> Criar Nova Declaração
                </h2>
                
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <label className="block text-sm font-semibold text-[#0B2341] mb-1">Título do Documento</label>
                    <input type="text" value={declTitulo} onChange={e => setDeclTitulo(e.target.value)} placeholder="Ex: Declaração de Uso de Transporte" className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#0B2341] outline-none" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Rotas (Destinatários)</label>
                      <select multiple value={declRotas} onChange={e => setDeclRotas(Array.from(e.target.selectedOptions, o => o.value))} className="w-full rounded-lg border-gray-300 p-2 border h-24 text-sm focus:border-[#0B2341] outline-none">
                        <option value="Todas" className="font-bold">Todas as Rotas</option>
                        {rotas.map(r => <option key={r.id} value={r.nome_rota}>{r.nome_rota}</option>)}
                      </select>
                      <p className="text-[10px] text-gray-500 mt-1">Segure Ctrl para selecionar várias.</p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Data de Expiração</label>
                        <input type="date" value={declValidade} onChange={e => setDeclValidade(e.target.value)} className="w-full rounded-lg border-gray-300 p-2 border focus:border-[#0B2341] outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Imagem de Assinatura (Opcional)</label>
                        <input type="file" accept="image/*" ref={assinaturaInputRef} onChange={handleAssinaturaUpload} className="hidden" />
                        <button onClick={() => assinaturaInputRef.current?.click()} className="w-full bg-gray-100 text-[#0B2341] border border-gray-300 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 transition">
                          {declAssinatura ? 'Trocar Assinatura' : 'Anexar Assinatura'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* WYSIWYG EDITOR */}
                  <div className="border border-gray-300 rounded-xl flex flex-col flex-1 overflow-hidden mt-2 bg-gray-50">
                    
                    {/* Toolbar Formatação */}
                    <div className="bg-white border-b border-gray-300 p-2 flex flex-wrap gap-2 items-center shrink-0">
                      <div className="flex bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <button onClick={() => execFormat('bold')} className="p-2 hover:bg-gray-200 transition text-gray-700" title="Negrito"><Bold size={16} /></button>
                        <button onClick={() => execFormat('italic')} className="p-2 hover:bg-gray-200 border-l border-gray-200 transition text-gray-700" title="Itálico"><Italic size={16} /></button>
                        <button onClick={() => execFormat('underline')} className="p-2 hover:bg-gray-200 border-l border-gray-200 transition text-gray-700" title="Sublinhado"><Underline size={16} /></button>
                      </div>
                      <div className="flex bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <button onClick={() => execFormat('justifyLeft')} className="p-2 hover:bg-gray-200 transition text-gray-700"><AlignLeft size={16} /></button>
                        <button onClick={() => execFormat('justifyCenter')} className="p-2 hover:bg-gray-200 border-l border-gray-200 transition text-gray-700"><AlignCenter size={16} /></button>
                        <button onClick={() => execFormat('justifyRight')} className="p-2 hover:bg-gray-200 border-l border-gray-200 transition text-gray-700"><AlignRight size={16} /></button>
                      </div>
                      
                      {/* Váriaveis */}
                      <div className="flex-1 flex flex-wrap gap-1 justify-end">
                        <button onClick={() => insertVariable('nome_aluno')} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">+ Nome</button>
                        <button onClick={() => insertVariable('cpf_aluno')} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">+ CPF</button>
                        <button onClick={() => insertVariable('instituicao')} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">+ Instituição</button>
                        <button onClick={() => insertVariable('rota')} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">+ Rota</button>
                      </div>
                    </div>

                    {/* Canvas do Editor */}
                    <div className="flex-1 overflow-y-auto p-0 bg-white relative">
                      <img src="/timbre.png" alt="Timbre" className="w-full h-auto object-cover pointer-events-none mb-4" />
                      <div 
                        ref={editorRef}
                        contentEditable
                        data-placeholder="Digite o conteúdo do documento aqui..."
                        className="px-8 pb-8 min-h-[200px] outline-none text-gray-800 text-justify font-serif empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 block"
                      />
                      {declAssinatura && (
                        <div className="mt-8 pb-8 flex flex-col items-center justify-center w-full">
                          <img src={declAssinatura} alt="Assinatura" className="h-16 w-auto object-contain mb-1" />
                          <div className="border-t border-black w-48 text-center pt-1 font-bold uppercase text-xs">Assinatura</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={handleSalvarDeclaracao} disabled={loading} className="w-full bg-[#395D34] text-white py-4 rounded-xl font-bold shadow hover:bg-[#2c4928] disabled:opacity-50 text-lg flex justify-center items-center mt-2 shrink-0">
                    <Save size={20} className="mr-2" /> Emitir Declaração
                  </button>
                </div>
              </div>

              {/* Lista de Declarações Ativas */}
              <div className="bg-white rounded-2xl shadow-sm border p-4 md:p-6 h-fit">
                <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">Declarações Ativas</h2>
                <div className="space-y-3">
                  {declaracoes.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">Nenhuma declaração ativa.</p>
                  ) : (
                    declaracoes.map(decl => (
                      <div key={decl.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-[#0B2341] leading-tight">{decl.titulo}</h3>
                          <button onClick={() => handleExcluirDeclaracao(decl.id)} className="text-red-500 bg-red-50 p-1.5 rounded-lg hover:bg-red-100 transition"><Trash2 size={16} /></button>
                        </div>
                        <div className="text-xs text-gray-500 font-medium mb-2 line-clamp-1">
                          Rotas: {decl.rotas.join(', ')}
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-[#890013] bg-red-50 px-2 py-1 rounded w-fit">
                          Expira em: {new Date(decl.data_validade).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========== TELA: MOTORISTAS =========== */}
          {currentView === 'motoristas_cad' && (
             <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-2xl mx-auto animate-in fade-in">
                <h2 className="text-xl font-bold text-[#0B2341] border-b pb-3 mb-4 flex justify-between items-center">
                  {motEditId ? 'Editar Motorista' : 'Novo Motorista'}
                  {motEditId && <button onClick={() => {setMotEditId(null); setMotNome(''); setMotCpf(''); setMotCnh(''); setMotTelefone('');}} className="text-sm text-[#890013]">Cancelar Edição</button>}
                </h2>
                <form onSubmit={handleSalvarMotorista} className="space-y-4">
                  <div><label className="block text-sm font-semibold mb-1">Nome Completo</label><input type="text" required value={motNome} onChange={e => setMotNome(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">CPF (Login)</label><input type="text" required value={motCpf} onChange={handleCpfMotoristaChange} placeholder="000.000.000-00" maxLength={14} className={`w-full rounded-lg p-2.5 border outline-none ${motEditId ? 'bg-gray-200 text-gray-500' : 'bg-gray-50 border-gray-300 focus:border-[#395D34]'}`} disabled={!!motEditId} /></div>
                  <div><label className="block text-sm font-semibold mb-1">CNH</label><input type="text" required value={motCnh} onChange={e => setMotCnh(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
                  <div><label className="block text-sm font-semibold mb-1">WhatsApp</label><input type="text" required value={motTelefone} onChange={handleTelefoneChange} maxLength={15} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
                  <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold shadow hover:bg-[#2c4928] mt-4 text-lg">{motEditId ? 'Atualizar Motorista' : 'Salvar Motorista'}</button>
                </form>
             </div>
          )}

          {currentView === 'motoristas_lista' && (
             <div className="bg-white p-6 rounded-2xl shadow-sm border animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-[#0B2341]">Motoristas Ativos</h2>
                  <div className="relative w-64"><input type="text" placeholder="Buscar motorista..." value={buscaMotorista} onChange={(e) => setBuscaMotorista(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-[#0B2341] outline-none" /><Search className="absolute left-3 top-2.5 text-gray-400" size={16} /></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nome</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contato</th><th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th></tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filterMotoristas.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-sm text-[#0B2341]">{m.nome}</td><td className="px-6 py-4 text-sm text-gray-700">CPF: {m.cpf}<br/><span className="text-xs text-gray-500">{m.telefone}</span></td><td className="px-6 py-4 text-center"><button onClick={() => {setMotEditId(m.id); setMotNome(m.nome); setMotCpf(m.cpf); setMotCnh(m.cnh); setMotTelefone(m.telefone); setCurrentView('motoristas_cad');}} className="text-blue-600 bg-blue-50 p-2 rounded-full mr-2"><Edit size={18} /></button><button onClick={() => {showConfirm('Deseja excluir este motorista?', async () => {await deleteDoc(doc(db, 'motoristas', m.id)); carregarDados();});}} className="text-[#890013] bg-red-50 p-2 rounded-full"><Trash2 size={18} /></button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {/* =========== TELA: INSTITUIÇÕES =========== */}
          {currentView === 'instituicoes' && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">Nova Instituição</h2>
                  <form onSubmit={handleSalvarInstituicao} className="space-y-4">
                    <div><label className="block text-sm font-semibold mb-1">Nome da Escola/Faculdade</label><input type="text" required value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)} placeholder="Ex: UFRPE, AESGA..." className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
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
                          <tr key={inst.id} className="hover:bg-gray-50"><td className="px-6 py-4 font-bold text-sm text-[#0B2341]">{inst.nome}</td><td className="px-6 py-4 text-center"><button onClick={() => {showConfirm('Excluir Instituição?', async () => {await deleteDoc(doc(db, 'instituicoes', inst.id)); carregarDados();});}} className="text-[#890013] bg-red-50 p-2 rounded-full"><Trash2 size={16} /></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          )}

          {/* =========== TELA: ROTAS =========== */}
          {currentView === 'rotas' && (
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4 flex justify-between">
                    {rotaEditId ? 'Editar Rota' : 'Nova Rota'}
                    {rotaEditId && <button onClick={() => {setRotaEditId(null); setRotaNome(''); setWhatsappRota(''); setRotaMotoristaCpf('');}} className="text-sm text-[#890013]">Cancelar</button>}
                  </h2>
                  <form onSubmit={handleSalvarRota} className="space-y-4">
                    <div><label className="block text-sm font-semibold mb-1">Nome da Rota</label><input type="text" required value={rotaNome} onChange={e => setRotaNome(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
                    <div><label className="block text-sm font-semibold mb-1">Motorista</label><select required value={rotaMotoristaCpf} onChange={e => setRotaMotoristaCpf(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none"><option value="">Selecione...</option>{motoristas.map(m => <option key={m.id} value={m.cpf}>{m.nome}</option>)}</select></div>
                    <div><label className="block text-sm font-semibold mb-1">Grupo WhatsApp (Opcional)</label><input type="url" value={whatsappRota} onChange={e => setWhatsappRota(e.target.value)} className="w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" /></div>
                    <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold shadow hover:bg-[#2c4928]">{rotaEditId ? 'Atualizar' : 'Salvar Rota'}</button>
                  </form>
                </div>
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Rotas e Paradas</h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rota</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Paradas</th><th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th></tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rotas.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-bold text-sm text-[#0B2341]">{r.nome_rota}</div><div className="text-xs text-gray-500 flex items-center mt-1"><User size={12} className="mr-1"/> {r.motorista_nome || 'Sem motorista'}</div></td><td className="px-6 py-4"><div className="flex items-center gap-2">{r.whatsapp_link && <a href={r.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center"><MessageCircle size={14} className="mr-1" /> Grupo</a>}<button onClick={() => {setRotaSelecionadaParaParadas(r); setModalParadasAberto(true);}} className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center"><MapPin size={14} className="mr-1" /> {r.paradas?.length || 0} Paradas</button></div></td><td className="px-6 py-4 text-center"><button onClick={() => {setRotaEditId(r.id); setRotaNome(r.nome_rota); setWhatsappRota(r.whatsapp_link || ''); setRotaMotoristaCpf(r.motorista_cpf || '');}} className="text-blue-600 bg-blue-50 p-2 rounded-full mr-2"><Edit size={18} /></button><button onClick={() => {showConfirm('Excluir Rota?', async () => {await deleteDoc(doc(db, 'rotas', r.id)); carregarDados();});}} className="text-[#890013] bg-red-50 p-2 rounded-full"><Trash2 size={18} /></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
             </div>
          )}

        </div>
      </main>

      {/* MODAL PARADAS ROTA */}
      {modalParadasAberto && rotaSelecionadaParaParadas && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setModalParadasAberto(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white"><div className="flex items-center gap-2"><MapPin size={20} className="text-[#395D34]" /><h3 className="font-bold text-lg">Instituições da Rota</h3></div><button onClick={() => setModalParadasAberto(false)} className="text-white/80 hover:text-white p-1"><X size={24} /></button></div>
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-4">
              <p className="text-sm font-bold text-gray-500 mb-2">Marque as instituições pertencentes à rota <strong>{rotaSelecionadaParaParadas.nome_rota}</strong>:</p>
              <div className="bg-white rounded-xl border border-gray-200 p-2 space-y-1">
                {instituicoesDisponiveis.map((inst) => {
                  const includes = rotaSelecionadaParaParadas.paradas?.includes(inst.nome) || false;
                  return (
                    <label key={inst.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-100 cursor-pointer"><span className="text-sm font-bold text-gray-800">{inst.nome}</span><input type="checkbox" checked={includes} onChange={() => toggleParadaInstituicao(inst.nome, includes)} className="w-5 h-5 rounded border-gray-300 text-[#395D34] focus:ring-[#395D34]"/></label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OUTROS MODAIS (Documentos e Histórico - Mantidos idênticos logicamente mas estilizados) */}
      {modalDocsAlunoAberto && alunoDocs && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setModalDocsAlunoAberto(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
             <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white"><div className="flex items-center gap-2"><FileText size={20} className="text-white" /><h3 className="font-bold text-lg">Documentos Anexos</h3></div><button onClick={() => setModalDocsAlunoAberto(false)} className="text-white/80 hover:text-white"><X size={24} /></button></div>
            <div className="p-6 bg-gray-50 flex-1 overflow-y-auto">
               <div className="mb-4 text-center"><p className="text-sm font-bold text-gray-800">{alunoDocs.nome}</p></div>
               <div className="space-y-3">
                 {alunoDocs.documentos?.map(doc => (
                   <button key={doc.id} onClick={() => {fetch(doc.base64).then(res=>res.blob()).then(blob=>{const url=URL.createObjectURL(blob); window.open(url, '_blank');})}} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:border-blue-400 group"><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText size={20} /></div><span className="font-bold text-gray-700">{doc.titulo}</span></div><Eye size={18} className="text-gray-400" /></button>
                 ))}
                 {alunoDocs.documento_base64 && (!alunoDocs.documentos || alunoDocs.documentos.length === 0) && (
                   <button onClick={() => {fetch(alunoDocs.documento_base64!).then(res=>res.blob()).then(blob=>{const url=URL.createObjectURL(blob); window.open(url, '_blank');})}} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:border-purple-400 group"><div className="flex items-center gap-3"><div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FileText size={20} /></div><span className="font-bold text-gray-700">Documento Antigo Original</span></div><Eye size={18} className="text-gray-400" /></button>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

      {modalHistoricoAberto && alunoHistorico && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setModalHistoricoAberto(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white">
              <div className="flex items-center gap-3"><img src={alunoHistorico.foto_url} alt="" className="w-10 h-10 rounded-full border-2 border-white/50 object-cover" /><div><h3 className="font-bold text-lg leading-tight">Histórico de Embarques</h3><p className="text-xs text-white/80">{alunoHistorico.nome}</p></div></div><button onClick={() => setModalHistoricoAberto(false)} className="text-white/80 hover:text-white"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              {carregandoHistorico ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <div className="w-8 h-8 border-4 border-[#0B2341] border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-sm font-medium">Carregando histórico...</p>
                </div>
              ) : historicoViagens.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum embarque registrado.</p>
              ) : (
                historicoViagens.map(viagem => (
                  <div key={viagem.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm mb-3">
                    <div className="flex items-center"><div className={`p-2.5 rounded-xl mr-4 ${viagem.tipo_viagem === 'ida' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{viagem.tipo_viagem === 'ida' ? <MapPin size={20} /> : <Truck size={20} />}</div><div><p className="text-sm font-bold text-gray-800 uppercase tracking-tight">{viagem.tipo_viagem} • {viagem.id_rota_onibus || viagem.id_rota || 'Rota Padrão'}</p><p className="text-xs text-gray-500 font-medium capitalize mt-0.5">{viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data recente'}</p></div></div>
                    <div className="text-right"><p className="text-sm font-black text-[#0B2341]">{viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
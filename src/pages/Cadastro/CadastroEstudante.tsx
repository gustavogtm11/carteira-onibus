// src/pages/Cadastro/CadastroEstudante.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QRCode from 'react-qr-code';
import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp, addDoc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAlert } from '../../contexts/AlertContext';
import { Camera, Save, Printer, User, Search, Edit, ImagePlus, X, List, UserPlus, LogOut, Trash2, Users, Truck, MapPin, Clock, FileText, Upload, MessageCircle, Plus, Eye } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

// --- INTERFACES ---
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
  motorista_id?: string;
  motorista_nome?: string;
}

interface ViagemHistorico {
  id: string;
  data_hora: any;
  id_rota_onibus?: string;
  id_rota?: string;
  tipo_viagem: 'ida' | 'volta';
}

export default function CadastroEstudante() {
  const { showAlert, showConfirm } = useAlert();

  // --- ESTADOS DE NAVEGAÇÃO (ABAS) ---
  const [mainTab, setMainTab] = useState<'estudantes' | 'motoristas'>('estudantes');
  const [subTabEstudantes, setSubTabEstudantes] = useState<'cadastro' | 'lista'>('cadastro');
  const [subTabMotoristas, setSubTabMotoristas] = useState<'cadastro' | 'lista' | 'rotas'>('cadastro');

  // --- DATA PADRÃO (FINAL DO ANO VIGENTE) ---
  const hoje = new Date();
  const fimDoAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split('T')[0];

  // --- ESTADOS: ESTUDANTE ---
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
  const [documentoBase64, setDocumentoBase64] = useState<string | null>(null);
  const [documentoNome, setDocumentoNome] = useState<string | null>(null);
  
  const [instituicoesDisponiveis, setInstituicoesDisponiveis] = useState<InstituicaoDB[]>([]);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // --- ESTADOS: MOTORISTA ---
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [buscaMotorista, setBuscaMotorista] = useState('');

  // --- ESTADOS: ROTA E PARADAS ---
  const [rotaNome, setRotaNome] = useState('');
  const [whatsappRota, setWhatsappRota] = useState('');
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSelecionadaParaParadas, setRotaSelecionadaParaParadas] = useState<Rota | null>(null);
  const [novaParada, setNovaParada] = useState('');
  const [modalParadasAberto, setModalParadasAberto] = useState(false);

  // --- ESTADOS: HISTÓRICO ---
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [alunoHistorico, setAlunoHistorico] = useState<Estudante | null>(null);
  const [historicoViagens, setHistoricoViagens] = useState<ViagemHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  // --- ESTADOS DA UI ---
  const [showWebcam, setShowWebcam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditando, setIsEditando] = useState(false);
  const [modoImpressaoLote, setModoImpressaoLote] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // --- CARREGAMENTO DE DADOS ---
  const carregarDados = async () => {
    try {
      const qEstudantes = query(collection(db, 'estudantes'), orderBy('nome'));
      const snapEstudantes = await getDocs(qEstudantes);
      setEstudantes(snapEstudantes.docs.map(doc => doc.data() as Estudante));

      const snapInstituicoes = await getDocs(collection(db, 'instituicoes'));
      const listaInstituicoes = snapInstituicoes.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
      }));
      setInstituicoesDisponiveis(listaInstituicoes);

      const snapMotoristas = await getDocs(collection(db, 'motoristas'));
      setMotoristas(snapMotoristas.docs.map(d => ({ id: d.id, ...d.data() } as Motorista)));

      const snapRotas = await getDocs(collection(db, 'rotas'));
      setRotas(snapRotas.docs.map(d => ({ id: d.id, ...d.data() } as Rota)));

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [mainTab, subTabEstudantes, subTabMotoristas]);

  // --- MÁSCARAS E FORMATAÇÕES ---
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

  // --- FUNÇÕES DE IMAGEM E DOCUMENTO (COMPACTAÇÃO AUTOMÁTICA) ---
  const capturarFoto = useCallback(() => {
    if (webcamRef.current) {
      setFoto(webcamRef.current.getScreenshot());
      setShowWebcam(false);
    }
  }, [webcamRef]);

  const comprimirImagem = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; 
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
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
      const imagemComprimida = await comprimirImagem(file);
      setFoto(imagemComprimida);
      setShowWebcam(false);
    }
  };

  // Upload e Compactação Automática de Documentos/PDFs
  const handleDocumentoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const nomeFinal = file.name;

      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
        
        const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
        
        if (compressedBlob.size > 1024 * 1024 * 0.9) {
          showAlert('O PDF ainda está muito grande. Tente enviar um arquivo mais leve.', 'error');
          setLoading(false);
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(compressedBlob);
        reader.onload = () => {
          setDocumentoBase64(reader.result as string);
          setDocumentoNome(nomeFinal);
          setLoading(false);
          showAlert('Documento compactado e anexado com sucesso!', 'success');
        };

      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * (scaleSize < 1 ? scaleSize : 1);
            
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
            
            setDocumentoBase64(compressedDataUrl);
            setDocumentoNome(nomeFinal);
            setLoading(false);
            showAlert('Imagem do documento compactada com sucesso!', 'success');
          };
        };
      } else {
        showAlert('Formato não suportado. Por favor, envie um PDF ou imagem.', 'error');
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro ao compactar documento:", error);
      showAlert('Erro ao processar o arquivo. Tente novamente.', 'error');
      setLoading(false);
    }
  };

  // --- SUBMITS E AÇÕES (ESTUDANTE) ---
  const handleNovoCadastro = () => {
    setNome(''); setCpf(''); setMatricula(''); setDataNascimento(''); 
    setDataVencimento(fimDoAno); setInstituicao(''); setCurso(''); 
    setTurno('Matutino'); setRotaAtrelada(''); setFoto(null);
    setDocumentoBase64(null); setDocumentoNome(null);
    setIsEditando(false);
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foto) return showAlert('É necessário ter uma foto do estudante!', 'error');
    if (!cpf || cpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');
    
    setLoading(true);
    try {
      const cpfLimpo = cpf.replace(/\D/g, '');

      await setDoc(doc(db, 'estudantes', cpfLimpo), {
        id_estudante: cpfLimpo,
        nome,
        cpf,
        matricula,
        data_nascimento: dataNascimento,
        data_vencimento: dataVencimento,
        instituicao_destino: instituicao,
        curso,
        turno,
        rota: rotaAtrelada,
        foto_url: foto,
        documento_base64: documentoBase64 || '',
        documento_nome: documentoNome || '',
        atualizadoEm: serverTimestamp(),
        qr_code_hash: cpfLimpo 
      });

      const instExiste = instituicoesDisponiveis.some(i => i.nome.toLowerCase() === instituicao.toLowerCase());
      if (!instExiste && instituicao.trim() !== '') {
        const instRef = doc(collection(db, 'instituicoes'));
        await setDoc(instRef, { nome: instituicao.trim() });
      }

      showAlert(isEditando ? 'Estudante atualizado com sucesso!' : 'Estudante salvo com sucesso!', 'success');
      carregarDados();
      handleNovoCadastro(); 

    } catch (error) {
      console.error(error);
      showAlert('Erro ao salvar estudante. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = (aluno: Estudante) => {
    setNome(aluno.nome);
    setCpf(aluno.cpf);
    setMatricula(aluno.matricula || '');
    setDataNascimento(aluno.data_nascimento);
    setDataVencimento(aluno.data_vencimento || fimDoAno);
    setInstituicao(aluno.instituicao_destino);
    setCurso(aluno.curso || '');
    setTurno(aluno.turno || 'Matutino');
    setRotaAtrelada(aluno.rota);
    setFoto(aluno.foto_url);
    setDocumentoBase64(aluno.documento_base64 || null);
    setDocumentoNome(aluno.documento_nome || null);
    setIsEditando(true);
    setMainTab('estudantes');
    setSubTabEstudantes('cadastro');
  };

  const handleExcluir = (id_estudante: string) => {
    showConfirm('Atenção: Tem certeza que deseja EXCLUIR este estudante permanentemente?', async () => {
      try {
        await deleteDoc(doc(db, 'estudantes', id_estudante));
        showAlert('Estudante excluído com sucesso!', 'success');
        carregarDados();
      } catch (error) {
        console.error("Erro ao excluir:", error);
        showAlert('Erro ao tentar excluir estudante. Tente novamente.', 'error');
      }
    });
  };

  // --- FUNÇÃO ABRIR HISTÓRICO ---
  const abrirHistorico = async (aluno: Estudante) => {
    setAlunoHistorico(aluno);
    setModalHistoricoAberto(true);
    setCarregandoHistorico(true);
    try {
      const q = query(
        collection(db, 'historico_viagens'),
        where('id_estudante', '==', aluno.id_estudante),
        orderBy('data_hora', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const viagens = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ViagemHistorico[];
      
      setHistoricoViagens(viagens);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      showAlert('Não foi possível carregar o histórico deste aluno.', 'error');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  // --- SUBMITS E AÇÕES (MOTORISTA E ROTA) ---
  const handleSalvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cpfLimpo = motCpf.replace(/\D/g, '');
      await addDoc(collection(db, 'motoristas'), {
        nome: motNome,
        cpf: cpfLimpo,
        cnh: motCnh,
        telefone: motTelefone,
        data_cadastro: serverTimestamp()
      });
      showAlert('Motorista cadastrado com sucesso!', 'success');
      setMotNome(''); setMotCpf(''); setMotCnh(''); setMotTelefone('');
      carregarDados();
    } catch (error) {
      showAlert('Erro ao salvar motorista.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirMotorista = (id: string) => {
    showConfirm('Deseja excluir este motorista?', async () => {
      await deleteDoc(doc(db, 'motoristas', id));
      showAlert('Motorista excluído.', 'success');
      carregarDados();
    });
  };

  const handleSalvarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'rotas'), {
        nome_rota: rotaNome,
        whatsapp_link: whatsappRota,
        paradas: []
      });
      showAlert('Rota cadastrada com sucesso!', 'success');
      setRotaNome(''); setWhatsappRota('');
      carregarDados();
    } catch (error) {
      showAlert('Erro ao salvar rota.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirRota = (id: string) => {
    showConfirm('Deseja excluir esta rota?', async () => {
      await deleteDoc(doc(db, 'rotas', id));
      showAlert('Rota excluída.', 'success');
      carregarDados();
    });
  };

  // --- GERENCIAMENTO DE PARADAS ---
  const abrirGerenciadorParadas = (rota: Rota) => {
    setRotaSelecionadaParaParadas(rota);
    setModalParadasAberto(true);
  };

  const adicionarParada = async () => {
    if (!novaParada.trim() || !rotaSelecionadaParaParadas) return;
    try {
      const rotaRef = doc(db, 'rotas', rotaSelecionadaParaParadas.id);
      await updateDoc(rotaRef, {
        paradas: arrayUnion(novaParada.trim())
      });
      const paradasAtualizadas = [...(rotaSelecionadaParaParadas.paradas || []), novaParada.trim()];
      setRotaSelecionadaParaParadas({ ...rotaSelecionadaParaParadas, paradas: paradasAtualizadas });
      setNovaParada('');
      carregarDados();
    } catch (err) {
      showAlert('Erro ao adicionar parada.', 'error');
    }
  };

  const removerParada = async (paradaNome: string) => {
    if (!rotaSelecionadaParaParadas) return;
    try {
      const rotaRef = doc(db, 'rotas', rotaSelecionadaParaParadas.id);
      await updateDoc(rotaRef, {
        paradas: arrayRemove(paradaNome)
      });
      const paradasAtualizadas = (rotaSelecionadaParaParadas.paradas || []).filter(p => p !== paradaNome);
      setRotaSelecionadaParaParadas({ ...rotaSelecionadaParaParadas, paradas: paradasAtualizadas });
      carregarDados();
    } catch (err) {
      showAlert('Erro ao remover parada.', 'error');
    }
  };

  // --- FILTROS E SELEÇÕES ---
  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleTodos = () => {
    if (selecionados.length === estudantesFiltrados.length) {
      setSelecionados([]);
    } else {
      setSelecionados(estudantesFiltrados.map(e => e.id_estudante));
    }
  };

  const handleImprimirLote = () => {
    if (selecionados.length === 0) return showAlert('Selecione pelo menos um estudante para imprimir.', 'info');
    setModoImpressaoLote(true);
    setTimeout(() => {
      window.print();
      setModoImpressaoLote(false);
    }, 500);
  };

  const estudantesFiltrados = estudantes.filter(e => 
    e.nome.toLowerCase().includes(busca.toLowerCase()) || e.cpf.includes(busca) || e.matricula?.includes(busca)
  );

  const motoristasFiltrados = motoristas.filter(m => 
    m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) || m.cpf.includes(buscaMotorista)
  );

  // --- TEMPLATE DA CARTEIRINHA ---
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
            {aluno.foto_url ? (
              <img src={aluno.foto_url} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <User size={24} className="text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            )}
          </div>
          
          <div className="flex flex-col flex-1 h-full align-center">
            <div>
              <span className="text-[7px] text-gray-500 uppercase leading-none block">Estudante</span>
              <div className="text-[10px] font-bold text-[#0B2341] leading-tight line-clamp-2" title={aluno.nome}>
                {abreviarNome(aluno.nome || '') || 'Nome do Aluno'}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-1">
              <div>
                <span className="text-[6px] text-gray-500 uppercase leading-none block">Matrícula</span>
                <span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.matricula || '-'}</span>
              </div>
              <div>
                <span className="text-[6px] text-gray-500 uppercase leading-none block">Turno</span>
                <span className="text-[8px] font-bold text-[#890013] leading-tight block truncate w-full">{aluno.turno || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[6px] text-gray-500 uppercase leading-none block">Curso</span>
                <span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.curso || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[6px] text-gray-500 uppercase leading-none block">Instituição</span>
                <span className="text-[8px] font-bold text-[#0B2341] leading-tight block truncate w-full">{aluno.instituicao_destino || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto bg-[#890013] text-white text-[8px] p-1 flex justify-between rounded uppercase font-semibold shrink-0 w-full px-2">
          <span>Transporte Escolar</span>
          <span>Venc: {aluno.data_vencimento ? new Date(aluno.data_vencimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/----'}</span>
        </div>
      </div>

      <div className="w-[85.6mm] h-full p-2 flex flex-row items-center bg-white print:bg-transparent">
        <div className="flex flex-col  justify-around w-[50%] pr-2">
          <div>
            <span className="text-[7px] text-gray-500 uppercase leading-none">Documento (CPF)</span>
            <p className="text-[10px] font-bold text-[#0B2341]">{aluno.cpf || '000.000.000-00'}</p>
          </div>
          <div>
            <span className="text-[7px] text-gray-500 uppercase leading-none">Nascimento</span>
            <p className="text-[10px] font-bold text-[#0B2341]">
              {aluno.data_nascimento ? new Date(aluno.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '00/00/0000'}
            </p>
          </div>
          <div>
            <span className="text-[7px] text-gray-500 uppercase leading-none">Rota Oficial</span>
            <p className="text-[9px] font-bold text-[#395D34] leading-tight line-clamp-2">{aluno.rota || 'Não vinculada'}</p>
          </div>
        </div>
        
        <div className="w-[50%] flex flex-col items-center justify-center border-l border-gray-100 pl-2">
          <div className="bg-white p-1 border border-[#0B2341] rounded shadow-md">
            <QRCode value={aluno.cpf ? aluno.cpf.replace(/\D/g, '') : 'ID_ESTUDANTE'} size={60} level="M"/>
          </div>
          <span className="text-[6px] font-bold text-gray-400 mt-1.5 text-center leading-tight">USO PESSOAL E<br/>INTRANSFERÍVEL</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50 p-6 ${modoImpressaoLote ? 'print:p-0 print:bg-white' : ''}`}>
      
      {/* Impressão em Lote */}
      {modoImpressaoLote && (
        <div className="hidden print:flex flex-col gap-4 w-full items-center">
          {estudantes.filter(e => selecionados.includes(e.id_estudante)).map((aluno) => (
            <CarteirinhaTemplate key={aluno.id_estudante} aluno={aluno} />
          ))}
        </div>
      )}

      {/* Modal de Histórico */}
      {modalHistoricoAberto && alunoHistorico && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white">
              <div className="flex items-center gap-3">
                <img src={alunoHistorico.foto_url} alt="" className="w-10 h-10 rounded-full border-2 border-white/50 object-cover" />
                <div>
                  <h3 className="font-bold text-lg leading-tight">Histórico de Embarques</h3>
                  <p className="text-xs text-white/80">{alunoHistorico.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalHistoricoAberto(false)} className="text-white/80 hover:text-white transition-colors p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              {carregandoHistorico ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-500">
                  <div className="w-8 h-8 border-4 border-[#0B2341] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p>Buscando histórico...</p>
                </div>
              ) : historicoViagens.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Clock size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum embarque registrado para este aluno.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historicoViagens.map(viagem => (
                    <div key={viagem.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center">
                        <div className={`p-2.5 rounded-xl mr-4 ${viagem.tipo_viagem === 'ida' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          {viagem.tipo_viagem === 'ida' ? <MapPin size={20} /> : <Truck size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 uppercase tracking-tight">
                            {viagem.tipo_viagem} • {viagem.id_rota_onibus || viagem.id_rota || 'Rota Padrão'}
                          </p>
                          <p className="text-xs text-gray-500 font-medium capitalize flex items-center mt-0.5">
                            <Clock size={12} className="mr-1" />
                            {viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Data recente'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-[#0B2341]">
                          {viagem.data_hora?.toDate ? viagem.data_hora.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Paradas */}
      {modalParadasAberto && rotaSelecionadaParaParadas && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-[#395D34]" />
                <h3 className="font-bold text-lg">Paradas da Rota: {rotaSelecionadaParaParadas.nome_rota}</h3>
              </div>
              <button onClick={() => setModalParadasAberto(false)} className="text-white/80 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Nome da parada (ex: Praça Central, Posto X)..."
                  value={novaParada}
                  onChange={e => setNovaParada(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-300 p-3 bg-white outline-none focus:border-[#395D34]"
                />
                <button 
                  type="button" 
                  onClick={adicionarParada}
                  className="bg-[#395D34] text-white px-5 rounded-xl font-bold hover:bg-[#2c4928] flex items-center shadow-md"
                >
                  <Plus size={20} className="mr-1" /> Adicionar
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Paradas Cadastradas</h4>
                {(!rotaSelecionadaParaParadas.paradas || rotaSelecionadaParaParadas.paradas.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma parada adicionada ainda.</p>
                ) : (
                  rotaSelecionadaParaParadas.paradas.map((parada, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="text-sm font-bold text-gray-800">{idx + 1}. {parada}</span>
                      <button onClick={() => removerParada(parada)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERFACE PRINCIPAL */}
      <div className={`max-w-7xl mx-auto ${modoImpressaoLote ? 'print:hidden' : ''}`}>
        
        {/* CABEÇALHO */}
        <div className="mb-6 print:hidden">
          <div className="flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h1 className="text-2xl font-bold text-[#0B2341] flex items-center">
              <img src="/logo-prefeitura.png" alt="Logo" className="h-8 mr-3 object-contain" />
              <span>Prefeitura de Angelim <span className="font-light text-gray-400">| Emissão</span></span>
            </h1>
            <div className="flex gap-3">
              {mainTab === 'estudantes' && subTabEstudantes === 'cadastro' && (
                <button onClick={() => window.print()} className="flex items-center bg-[#395D34] text-white px-4 py-2 rounded-lg shadow hover:bg-[#2c4928] transition font-semibold">
                  <Printer size={18} className="mr-2" /> Imprimir Atual
                </button>
              )}
              <button onClick={() => signOut(auth)} className="flex items-center text-[#890013] hover:bg-red-50 px-4 py-2 rounded-lg transition font-semibold">
                <LogOut size={18} className="mr-2" /> Sair
              </button>
            </div>
          </div>

          {/* ABAS PRINCIPAIS */}
          <div className="flex space-x-2 border-b-2 border-gray-300 pb-0">
            <button 
              onClick={() => setMainTab('estudantes')}
              className={`flex items-center px-6 py-3 rounded-t-lg font-bold transition text-lg ${mainTab === 'estudantes' ? 'bg-[#0B2341] text-white border-b-4 border-[#071629]' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <Users size={20} className="mr-2" /> Estudantes
            </button>
            <button 
              onClick={() => setMainTab('motoristas')}
              className={`flex items-center px-6 py-3 rounded-t-lg font-bold transition text-lg ${mainTab === 'motoristas' ? 'bg-[#0B2341] text-white border-b-4 border-[#071629]' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <Truck size={20} className="mr-2" /> Motoristas e Rotas
            </button>
          </div>
        </div>

        {/* =========================================================================
            SESSÃO: ESTUDANTES
        ========================================================================= */}
        {mainTab === 'estudantes' && (
          <div className="print:block">
            
            {/* SUB-ABAS DE ESTUDANTES */}
            <div className="flex space-x-2 mb-6 print:hidden">
              <button 
                onClick={() => setSubTabEstudantes('cadastro')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabEstudantes === 'cadastro' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <UserPlus size={18} className="mr-2" /> Cadastrar Novo
              </button>
              <button 
                onClick={() => setSubTabEstudantes('lista')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabEstudantes === 'lista' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <List size={18} className="mr-2" /> Lista dos Cadastrados
              </button>
            </div>

            {/* TELA DE CADASTRO ESTUDANTE */}
            <div className={subTabEstudantes === 'cadastro' ? 'block' : 'hidden print:block'}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <div className="bg-white p-6 rounded-xl shadow-sm border print:hidden h-fit">
                  <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-lg font-bold text-[#0B2341]">
                      {isEditando ? 'Editando Estudante' : 'Dados do Estudante'}
                    </h2>
                    <button type="button" onClick={handleNovoCadastro} className="text-sm text-[#890013] hover:underline font-bold">Limpar / Novo</button>
                  </div>
                  
                  <form onSubmit={handleSalvar} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome Completo</label>
                        <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF</label>
                        <input type="text" required value={cpf} onChange={handleCPFChange} disabled={isEditando} placeholder="000.000.000-00" maxLength={14}
                          className={`block w-full rounded-md shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] outline-none ${isEditando ? 'bg-gray-200 cursor-not-allowed border-gray-200 text-gray-500' : 'bg-gray-50 border-gray-300'}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Matrícula</label>
                        <input type="text" required value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="000000"
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Data de Nascimento</label>
                        <input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Validade da Carteira</label>
                        <input type="date" required value={dataVencimento} onChange={e => setDataVencimento(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Instituição de Ensino</label>
                        <input 
                          list="instituicoes-list" required value={instituicao} onChange={e => setInstituicao(e.target.value)}
                          placeholder="Ex: UFPE, IFPB..."
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" 
                        />
                        <datalist id="instituicoes-list">
                          {instituicoesDisponiveis.map(r => <option key={r.id} value={r.nome} />)}
                        </datalist>
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Curso</label>
                        <input type="text" required value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ex: Direito"
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Rota / Ônibus</label>
                        <select required value={rotaAtrelada} onChange={e => setRotaAtrelada(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none">
                          <option value="">Selecione uma rota...</option>
                          {rotas.map(r => (
                            <option key={r.id} value={r.nome_rota}>{r.nome_rota}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Turno</label>
                        <div className="flex gap-4 pt-2">
                          {['Matutino', 'Vespertino', 'Noturno'].map(t => (
                            <label key={t} className="flex items-center cursor-pointer">
                              <input type="radio" name="turno" value={t} checked={turno === t} onChange={e => setTurno(e.target.value)}
                                className="mr-2 text-[#395D34] focus:ring-[#395D34]" />
                              <span className="text-sm text-[#0B2341] font-medium">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Upload de Documentos (PDF/Comprovante com Compactação Automática) */}
                    <div className="mt-4 border border-gray-200 p-4 rounded-lg bg-gray-50">
                      <label className="block text-sm font-bold text-[#0B2341] mb-2">Documentos / Declaração (PDF ou Imagem)</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept=".pdf,image/*" ref={docInputRef} onChange={handleDocumentoUpload} className="hidden" />
                        <button type="button" onClick={() => docInputRef.current?.click()} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 flex items-center text-sm">
                          <Upload size={16} className="mr-2 text-[#395D34]" /> Anexar e Compactar
                        </button>
                        {documentoNome && (
                          <span className="text-xs font-bold text-green-700 truncate max-w-[200px]" title={documentoNome}>
                            {documentoNome}
                          </span>
                        )}
                        {documentoBase64 && (
                          <a href={documentoBase64} download={documentoNome || 'documento'} className="text-blue-600 hover:underline text-xs font-bold ml-auto flex items-center">
                            <Eye size={14} className="mr-1" /> Ver Anexo
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border border-gray-200 p-4 rounded-lg bg-gray-50">
                      <label className="block text-sm font-bold text-[#0B2341] mb-3">Foto do Estudante</label>
                      
                      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <div className="bg-white rounded-lg overflow-hidden w-40 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 relative shadow-sm shrink-0">
                          {showWebcam ? (
                            <Webcam 
                              audio={false} ref={webcamRef} screenshotFormat="image/jpeg" screenshotQuality={0.8} 
                              videoConstraints={{ width: 400, height: 400, facingMode: "user" }} 
                              className="w-full h-full object-cover" 
                            />
                          ) : foto ? (
                            <img src={foto} alt="Estudante" className="w-full h-full object-cover" />
                          ) : (
                            <User size={40} className="text-gray-300" />
                          )}
                          
                          {showWebcam && (
                            <button type="button" onClick={() => setShowWebcam(false)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                              <X size={16} />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 w-full">
                          {showWebcam ? (
                            <button type="button" onClick={capturarFoto} className="flex justify-center items-center bg-[#395D34] text-white px-4 py-3 rounded-md hover:bg-[#2c4928] font-bold shadow">
                              <Camera size={18} className="mr-2"/> Bater Foto Agora
                            </button>
                          ) : (
                            <>
                              <button type="button" onClick={() => setShowWebcam(true)} className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2.5 rounded-md hover:bg-[#071629] font-semibold">
                                <Camera size={18} className="mr-2"/> Abrir Webcam do PC
                              </button>
                              <div className="relative w-full">
                                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button type="button" className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-md hover:bg-gray-50 font-semibold w-full">
                                  <ImagePlus size={18} className="mr-2"/> Câmera Celular / Upload
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-4 rounded-lg font-bold shadow hover:bg-[#2c4928] disabled:opacity-50 transition mt-6 text-lg">
                      <Save size={20} className="mr-2" /> {loading ? 'Salvando...' : (isEditando ? 'Atualizar Estudante' : 'Salvar e Gerar Carteira')}
                    </button>
                  </form>
                </div>

                <div className="flex flex-col items-center justify-start print:fixed print:top-0 print:left-0 print:w-full print:h-full print:bg-white print:m-0 print:p-8">
                  <h2 className="text-lg font-bold mb-4 text-[#0B2341] print:hidden border-b pb-2 w-full text-center">Tamanho Real de Impressão</h2>
                  <CarteirinhaTemplate aluno={{
                    nome, cpf, matricula, data_nascimento: dataNascimento, data_vencimento: dataVencimento, instituicao_destino: instituicao, curso, turno, rota: rotaAtrelada, foto_url: foto || ''
                  }} />
                </div>
              </div>
            </div>

            {/* TELA DE LISTA DE ESTUDANTES */}
            <div className={`${subTabEstudantes === 'lista' ? 'block' : 'hidden'} bg-white p-6 rounded-xl shadow-sm border print:hidden`}>
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-lg font-bold text-[#0B2341]">Alunos Cadastrados</h2>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#0B2341] focus:border-[#0B2341] outline-none" />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  
                  <button 
                    onClick={handleImprimirLote}
                    disabled={selecionados.length === 0}
                    className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#071629] disabled:opacity-50 transition whitespace-nowrap"
                  >
                    <Printer size={18} className="mr-2" /> 
                    Imprimir ({selecionados.length})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input 
                          type="checkbox" 
                          checked={selecionados.length > 0 && selecionados.length === estudantesFiltrados.length}
                          onChange={toggleTodos}
                          className="rounded border-gray-300 text-[#395D34] focus:ring-[#395D34]"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estudante</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Matrícula</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Instituição</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {estudantesFiltrados.map((aluno) => (
                      <tr key={aluno.id_estudante} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input 
                            type="checkbox" 
                            checked={selecionados.includes(aluno.id_estudante)}
                            onChange={() => toggleSelecionado(aluno.id_estudante)}
                            className="rounded border-gray-300 text-[#395D34] focus:ring-[#395D34]"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                          <img src={aluno.foto_url} alt={aluno.nome} className="w-10 h-10 rounded-full object-cover border shadow-sm" />
                          <div>
                            <div className="text-sm font-bold text-[#0B2341]">{aluno.nome}</div>
                            <div className="text-xs text-gray-500">{aluno.cpf}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {aluno.matricula || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-[#0B2341] font-semibold">{aluno.instituicao_destino}</div>
                          <div className="text-xs text-gray-500">{aluno.curso}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex justify-center gap-2">
                            {aluno.documento_base64 && (
                              <a href={aluno.documento_base64} download={aluno.documento_nome || 'documento'} className="text-purple-600 hover:text-purple-800 bg-purple-50 p-2 rounded-full transition" title="Baixar Documento Anexado">
                                <FileText size={18} />
                              </a>
                            )}
                            <button onClick={() => abrirHistorico(aluno)} className="text-[#395D34] hover:text-[#2c4928] bg-green-50 p-2 rounded-full hover:bg-green-100 transition" title="Ver Histórico">
                              <Clock size={18} />
                            </button>
                            <button onClick={() => handleEditar(aluno)} className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-full hover:bg-blue-100 transition" title="Editar Estudante">
                              <Edit size={18} />
                            </button>
                            <button onClick={() => handleExcluir(aluno.id_estudante)} className="text-[#890013] hover:text-red-800 bg-red-50 p-2 rounded-full hover:bg-red-100 transition" title="Excluir Estudante">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            SESSÃO: MOTORISTAS E ROTAS
        ========================================================================= */}
        {mainTab === 'motoristas' && (
          <div>
            
            {/* SUB-ABAS DE MOTORISTAS */}
            <div className="flex space-x-2 mb-6">
              <button 
                onClick={() => setSubTabMotoristas('cadastro')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'cadastro' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <UserPlus size={18} className="mr-2" /> Cadastrar Motorista
              </button>
              <button 
                onClick={() => setSubTabMotoristas('lista')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'lista' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <List size={18} className="mr-2" /> Listar Motoristas
              </button>
              <button 
                onClick={() => setSubTabMotoristas('rotas')}
                className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'rotas' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <MapPin size={18} className="mr-2" /> Gestão de Rotas & Paradas
              </button>
            </div>

            {/* TELA: CADASTRAR MOTORISTA */}
            {subTabMotoristas === 'cadastro' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border max-w-3xl">
                <div className="border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-[#0B2341]">Dados do Motorista</h2>
                </div>
                <form onSubmit={handleSalvarMotorista} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome Completo</label>
                      <input type="text" required value={motNome} onChange={e => setMotNome(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF</label>
                      <input type="text" required value={motCpf} onChange={handleCpfMotoristaChange} placeholder="000.000.000-00" maxLength={14}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">CNH</label>
                      <input type="text" required value={motCnh} onChange={e => setMotCnh(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Telefone / WhatsApp</label>
                      <input type="text" required value={motTelefone} onChange={handleTelefoneChange} placeholder="(87) 99999-9999" maxLength={15}
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-4 rounded-lg font-bold shadow hover:bg-[#2c4928] transition mt-6 text-lg">
                    <Save size={20} className="mr-2" /> Salvar Motorista
                  </button>
                </form>
              </div>
            )}

            {/* TELA: LISTA DE MOTORISTAS */}
            {subTabMotoristas === 'lista' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-[#0B2341]">Motoristas Cadastrados</h2>
                  <div className="relative w-72">
                    <input type="text" placeholder="Buscar motorista..." value={buscaMotorista} onChange={(e) => setBuscaMotorista(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#0B2341] focus:border-[#0B2341] outline-none" />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">CPF / CNH</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contato</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {motoristasFiltrados.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-sm text-[#0B2341]">{m.nome}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <div>CPF: {m.cpf}</div>
                            <div className="text-xs text-gray-500">CNH: {m.cnh}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{m.telefone}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <button onClick={() => handleExcluirMotorista(m.id)} className="text-[#890013] hover:text-red-800 bg-red-50 p-2 rounded-full hover:bg-red-100 transition">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TELA: ROTAS E PARADAS */}
            {subTabMotoristas === 'rotas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Form Cadastro de Rota com Link WhatsApp */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border h-fit">
                  <div className="border-b pb-3 mb-4">
                    <h2 className="text-lg font-bold text-[#0B2341]">Nova Rota de Ônibus</h2>
                  </div>
                  <form onSubmit={handleSalvarRota} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome da Rota</label>
                      <input type="text" required value={rotaNome} onChange={e => setRotaNome(e.target.value)} placeholder="Ex: Rota Recife (UFPE/UFRPE)"
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Link do Grupo do WhatsApp</label>
                      <input type="url" value={whatsappRota} onChange={e => setWhatsappRota(e.target.value)} placeholder="https://chat.whatsapp.com/..."
                        className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-3 rounded-lg font-bold shadow hover:bg-[#2c4928] transition mt-6">
                      <Save size={18} className="mr-2" /> Salvar Rota
                    </button>
                  </form>
                </div>

                {/* Lista de Rotas com Ação para Paradas */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Rotas Cadastradas e Paradas</h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rota</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">WhatsApp / Paradas</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rotas.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-sm text-[#0B2341]">{r.nome_rota}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                {r.whatsapp_link && (
                                  <a href={r.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center">
                                    <MessageCircle size={14} className="mr-1" /> Grupo
                                  </a>
                                )}
                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold">
                                  {r.paradas?.length || 0} parada(s)
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => abrirGerenciadorParadas(r)} className="text-[#395D34] bg-green-50 hover:bg-green-100 p-2 rounded-full transition" title="Gerenciar Paradas (+)">
                                  <MapPin size={18} />
                                </button>
                                <button onClick={() => handleExcluirRota(r.id)} className="text-[#890013] hover:text-red-800 bg-red-50 p-2 rounded-full hover:bg-red-100 transition" title="Excluir Rota">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
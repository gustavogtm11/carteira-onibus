// src/pages/Cadastro/CadastroEstudante.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import QRCode from 'react-qr-code';
import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp, addDoc, updateDoc, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAlert } from '../../contexts/AlertContext';
import { Camera, Save, Printer, User, Search, Edit, ImagePlus, X, List, UserPlus, LogOut, Trash2, Users, Truck, MapPin, Clock, FileText, MessageCircle, Eye, Plus, Building } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

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
  uid_vinculado?: string; 
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

export default function CadastroEstudante() {
  const { showAlert, showConfirm } = useAlert();

  const [mainTab, setMainTab] = useState<'estudantes' | 'motoristas'>('estudantes');
  const [subTabEstudantes, setSubTabEstudantes] = useState<'cadastro' | 'lista'>('cadastro');
  const [subTabMotoristas, setSubTabMotoristas] = useState<'cadastro' | 'lista' | 'rotas' | 'instituicoes'>('cadastro');

  const hoje = new Date();
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
  
  const [instituicoesDisponiveis, setInstituicoesDisponiveis] = useState<InstituicaoDB[]>([]);
  const [estudantes, setEstudantes] = useState<Estudante[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const [motEditId, setMotEditId] = useState<string | null>(null);
  const [motNome, setMotNome] = useState('');
  const [motCpf, setMotCpf] = useState('');
  const [motCnh, setMotCnh] = useState('');
  const [motTelefone, setMotTelefone] = useState('');
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

  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [alunoHistorico, setAlunoHistorico] = useState<Estudante | null>(null);
  const [historicoViagens, setHistoricoViagens] = useState<ViagemHistorico[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  
  const [modalDocsAlunoAberto, setModalDocsAlunoAberto] = useState(false);
  const [alunoDocs, setAlunoDocs] = useState<Estudante | null>(null);

  const [showWebcam, setShowWebcam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditando, setIsEditando] = useState(false);
  const [modoImpressaoLote, setModoImpressaoLote] = useState(false);
  
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

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

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [mainTab, subTabEstudantes, subTabMotoristas]);

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

  const handleDocumentoMultiploUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const novosDocs: DocumentoAnexo[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = Date.now().toString() + i;
        let finalBase64 = '';

        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
          const compressedBlob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
          
          if (compressedBlob.size > 1024 * 1024 * 1.5) {
             showAlert(`O arquivo ${file.name} é muito grande.`, 'error');
             continue;
          }
          finalBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(compressedBlob);
            reader.onload = () => resolve(reader.result as string);
          });
        } else if (file.type.startsWith('image/')) {
          finalBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleSize = 800 / img.width;
                canvas.width = 800;
                canvas.height = img.height * (scaleSize < 1 ? scaleSize : 1);
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
              };
            };
          });
        } else {
           showAlert(`Formato não suportado: ${file.name}`, 'error');
           continue;
        }

        novosDocs.push({
          id,
          titulo: `Documento ${documentosForm.length + novosDocs.length + 1}`,
          base64: finalBase64,
          nome_arquivo: file.name
        });
      }

      setDocumentosForm(prev => [...prev, ...novosDocs]);
      showAlert('Documento(s) anexado(s) com sucesso! Dê um título a eles.', 'success');
    } catch (error) {
      console.error(error);
      showAlert('Erro ao processar arquivo(s).', 'error');
    } finally {
      setLoading(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const atualizarTituloDocumento = (id: string, novoTitulo: string) => {
    setDocumentosForm(prev => prev.map(doc => doc.id === id ? { ...doc, titulo: novoTitulo } : doc));
  };

  const removerDocumentoForm = (id: string) => {
    setDocumentosForm(prev => prev.filter(doc => doc.id !== id));
  };

  const handleInstituicaoSelecionada = (nomeInstituicao: string) => {
    setInstituicao(nomeInstituicao);
    const rotaEncontrada = rotas.find(r => r.paradas && r.paradas.includes(nomeInstituicao));
    if (rotaEncontrada) {
      setRotaAtrelada(rotaEncontrada.nome_rota);
      showAlert(`Rota "${rotaEncontrada.nome_rota}" selecionada automaticamente!`, 'success');
    } else {
      setRotaAtrelada('');
    }
  };

  const handleNovoCadastro = () => {
    setNome(''); setCpf(''); setMatricula(''); setDataNascimento(''); 
    setDataVencimento(fimDoAno); setInstituicao(''); setCurso(''); 
    setTurno('Matutino'); setRotaAtrelada(''); setFoto(null);
    setDocumentosForm([]);
    setIsEditando(false);
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
        documentos: documentosForm, 
        atualizadoEm: serverTimestamp(),
        qr_code_hash: cpfLimpo 
      });

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
    
    let docsIniciais = aluno.documentos ? [...aluno.documentos] : [];
    if (aluno.documento_base64 && docsIniciais.length === 0) {
      docsIniciais.push({
        id: 'legacy_doc',
        titulo: 'Documento Antigo',
        base64: aluno.documento_base64,
        nome_arquivo: aluno.documento_nome || 'documento.pdf'
      });
    }
    setDocumentosForm(docsIniciais);
    
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

  const abrirModalDocumentos = (aluno: Estudante) => {
    setAlunoDocs(aluno);
    setModalDocsAlunoAberto(true);
  };

  const abrirPdfNovaGuia = async (base64: string) => {
    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000); 
    } catch (error) {
       showAlert('Não foi possível abrir o documento.', 'error');
    }
  };

  const abrirHistorico = async (aluno: Estudante) => {
    setAlunoHistorico(aluno);
    setModalHistoricoAberto(true);
    setCarregandoHistorico(true);
    try {
      const q = query(collection(db, 'historico_viagens'), where('id_estudante', '==', aluno.id_estudante), orderBy('data_hora', 'desc'));
      const querySnapshot = await getDocs(q);
      setHistoricoViagens(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ViagemHistorico[]);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      showAlert('Não foi possível carregar o histórico deste aluno.', 'error');
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const limparFormMotorista = () => {
    setMotEditId(null); setMotNome(''); setMotCpf(''); setMotCnh(''); setMotTelefone('');
  };

  const handleSalvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motCpf || motCpf.length < 14) return showAlert('O CPF é obrigatório e deve ser válido.', 'error');

    setLoading(true);
    try {
      const cpfLimpo = motCpf.replace(/\D/g, '');
      const dataMotorista = { id: cpfLimpo, nome: motNome, cpf: cpfLimpo, cnh: motCnh, telefone: motTelefone };
      
      if (motEditId) {
        await updateDoc(doc(db, 'motoristas', motEditId), dataMotorista);
        showAlert('Motorista atualizado com sucesso!', 'success');
      } else {
        await setDoc(doc(db, 'motoristas', cpfLimpo), { ...dataMotorista, data_cadastro: serverTimestamp() });
        showAlert('Motorista cadastrado com sucesso!', 'success');
      }
      limparFormMotorista();
      carregarDados();
    } catch (error) {
      showAlert('Erro ao salvar motorista.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditarMotorista = (m: Motorista) => {
    setMotEditId(m.id);
    setMotNome(m.nome); setMotCpf(m.cpf); setMotCnh(m.cnh); setMotTelefone(m.telefone);
    setSubTabMotoristas('cadastro');
  };

  const handleExcluirMotorista = (id: string) => {
    showConfirm('Deseja excluir este motorista?', async () => {
      await deleteDoc(doc(db, 'motoristas', id));
      showAlert('Motorista excluído.', 'success');
      carregarDados();
    });
  };

  const limparFormRota = () => {
    setRotaEditId(null); setRotaNome(''); setWhatsappRota(''); setRotaMotoristaCpf('');
  };

  const handleSalvarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rotaMotoristaCpf) return showAlert('Você precisa selecionar um motorista para a rota.', 'error');
    
    setLoading(true);
    try {
      const motSelecionado = motoristas.find(m => m.cpf === rotaMotoristaCpf);
      if (!motSelecionado) throw new Error('Motorista não encontrado');

      const dataRota = {
        nome_rota: rotaNome,
        whatsapp_link: whatsappRota,
        motorista_cpf: motSelecionado.cpf, 
        motorista_nome: motSelecionado.nome
      };

      if (rotaEditId) {
        await updateDoc(doc(db, 'rotas', rotaEditId), dataRota);
        showAlert('Rota atualizada com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'rotas'), { ...dataRota, paradas: [] });
        showAlert('Rota cadastrada com sucesso!', 'success');
      }
      limparFormRota();
      carregarDados();
    } catch (error) {
      showAlert('Erro ao salvar rota.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRota = (r: Rota) => {
    setRotaEditId(r.id);
    setRotaNome(r.nome_rota); setWhatsappRota(r.whatsapp_link || ''); setRotaMotoristaCpf(r.motorista_cpf || '');
  };

  const handleExcluirRota = (id: string) => {
    showConfirm('Deseja excluir esta rota?', async () => {
      await deleteDoc(doc(db, 'rotas', id));
      showAlert('Rota excluída.', 'success');
      carregarDados();
    });
  };

  const handleSalvarInstituicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaInstNome.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'instituicoes'), { nome: novaInstNome.trim() });
      showAlert('Instituição cadastrada com sucesso!', 'success');
      setNovaInstNome('');
      carregarDados();
    } catch (error) {
      showAlert('Erro ao cadastrar instituição.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirInstituicao = (id: string) => {
    showConfirm('Atenção: Deseja excluir esta Instituição? (Não excluirá os alunos, mas removerá da lista)', async () => {
      try {
        await deleteDoc(doc(db, 'instituicoes', id));
        showAlert('Instituição excluída.', 'success');
        carregarDados();
      } catch (err) {
        showAlert('Erro ao excluir.', 'error');
      }
    });
  };

  const abrirGerenciadorParadas = (rota: Rota) => {
    setRotaSelecionadaParaParadas(rota);
    setModalParadasAberto(true);
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
    } catch (err) {
      showAlert('Erro ao atualizar parada.', 'error');
    }
  };

  const handleImprimirLote = () => {
    if (selecionados.length === 0) return showAlert('Selecione pelo menos um estudante.', 'info');
    setModoImpressaoLote(true);
    setTimeout(() => { window.print(); setModoImpressaoLote(false); }, 500);
  };

  const estudantesFiltrados = estudantes.filter(e => e.nome.toLowerCase().includes(busca.toLowerCase()) || e.cpf.includes(busca) || e.matricula?.includes(busca));
  const motoristasFiltrados = motoristas.filter(m => m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) || m.cpf.includes(buscaMotorista));

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
        <div className="flex flex-col justify-around w-[50%] pr-2">
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
      
      {modoImpressaoLote && (
        <div className="hidden print:flex flex-col gap-4 w-full items-center">
          {estudantes.filter(e => selecionados.includes(e.id_estudante)).map((aluno) => (
            <CarteirinhaTemplate key={aluno.id_estudante} aluno={aluno} />
          ))}
        </div>
      )}

      {modalDocsAlunoAberto && alunoDocs && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
             <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-white" />
                <h3 className="font-bold text-lg">Documentos Anexos</h3>
              </div>
              <button onClick={() => setModalDocsAlunoAberto(false)} className="text-white/80 hover:text-white transition-colors p-1">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 bg-gray-50 flex-1 overflow-y-auto">
               <div className="mb-4 text-center">
                  <p className="text-sm font-bold text-gray-800">{alunoDocs.nome}</p>
                  <p className="text-xs text-gray-500">Clique em um documento abaixo para visualizar</p>
               </div>
               <div className="space-y-3">
                 {alunoDocs.documentos && alunoDocs.documentos.length > 0 ? (
                   alunoDocs.documentos.map(doc => (
                     <button key={doc.id} onClick={() => abrirPdfNovaGuia(doc.base64)} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:border-blue-400 hover:shadow-md transition group">
                       <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                             <FileText size={20} />
                          </div>
                          <span className="font-bold text-gray-700 text-left">{doc.titulo || 'Documento sem título'}</span>
                       </div>
                       <Eye size={18} className="text-gray-400 group-hover:text-blue-600" />
                     </button>
                   ))
                 ) : null}
                 
                 {alunoDocs.documento_base64 && (!alunoDocs.documentos || alunoDocs.documentos.length === 0) && (
                   <button onClick={() => abrirPdfNovaGuia(alunoDocs.documento_base64!)} className="w-full flex items-center justify-between bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:border-purple-400 hover:shadow-md transition group">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
                           <FileText size={20} />
                        </div>
                        <span className="font-bold text-gray-700 text-left">Documento Antigo Original</span>
                     </div>
                     <Eye size={18} className="text-gray-400 group-hover:text-purple-600" />
                   </button>
                 )}

                 {(!alunoDocs.documentos || alunoDocs.documentos.length === 0) && !alunoDocs.documento_base64 && (
                   <p className="text-center text-sm text-gray-400 py-4">Nenhum documento anexado para este estudante.</p>
                 )}
               </div>
            </div>
          </div>
        </div>
      )}

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

      {modalParadasAberto && rotaSelecionadaParaParadas && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 flex items-center justify-between bg-[#0B2341] text-white">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-[#395D34]" />
                <h3 className="font-bold text-lg">Instituições da Rota</h3>
              </div>
              <button onClick={() => setModalParadasAberto(false)} className="text-white/80 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-4">
              <p className="text-sm font-bold text-gray-500 mb-2">Marque as instituições de ensino que pertencem à rota <strong>{rotaSelecionadaParaParadas.nome_rota}</strong>:</p>
              
              <div className="bg-white rounded-xl border border-gray-200 p-2 space-y-1 max-h-[50vh] overflow-y-auto">
                {instituicoesDisponiveis.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhuma instituição cadastrada no sistema.</p>
                ) : (
                  instituicoesDisponiveis.map((inst) => {
                    const includes = rotaSelecionadaParaParadas.paradas?.includes(inst.nome) || false;
                    return (
                      <label key={inst.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-100 cursor-pointer transition-colors">
                        <span className="text-sm font-bold text-gray-800">{inst.nome}</span>
                        <input 
                          type="checkbox" 
                          checked={includes} 
                          onChange={() => toggleParadaInstituicao(inst.nome, includes)} 
                          className="w-5 h-5 rounded border-gray-300 text-[#395D34] focus:ring-[#395D34]"
                        />
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-7xl mx-auto ${modoImpressaoLote ? 'print:hidden' : ''}`}>
        
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

          <div className="flex space-x-2 border-b-2 border-gray-300 pb-0 flex-wrap">
            <button onClick={() => setMainTab('estudantes')} className={`flex items-center px-6 py-3 rounded-t-lg font-bold transition text-lg ${mainTab === 'estudantes' ? 'bg-[#0B2341] text-white border-b-4 border-[#071629]' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              <Users size={20} className="mr-2" /> Estudantes
            </button>
            <button onClick={() => setMainTab('motoristas')} className={`flex items-center px-6 py-3 rounded-t-lg font-bold transition text-lg ${mainTab === 'motoristas' ? 'bg-[#0B2341] text-white border-b-4 border-[#071629]' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              <Truck size={20} className="mr-2" /> Cadastros Gerais (Rotas e Escolas)
            </button>
          </div>
        </div>

        {mainTab === 'estudantes' && (
          <div className="print:block">
            <div className="flex space-x-2 mb-6 print:hidden">
              <button onClick={() => setSubTabEstudantes('cadastro')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabEstudantes === 'cadastro' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <UserPlus size={18} className="mr-2" /> Cadastrar Novo
              </button>
              <button onClick={() => setSubTabEstudantes('lista')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabEstudantes === 'lista' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                <List size={18} className="mr-2" /> Lista dos Cadastrados
              </button>
            </div>

            <div className={subTabEstudantes === 'cadastro' ? 'block' : 'hidden print:block'}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border print:hidden h-fit">
                  <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-lg font-bold text-[#0B2341]">{isEditando ? 'Editando Estudante' : 'Dados do Estudante'}</h2>
                    <button type="button" onClick={handleNovoCadastro} className="text-sm text-[#890013] hover:underline font-bold">Limpar / Novo</button>
                  </div>
                  <form onSubmit={handleSalvar} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome Completo</label>
                        <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF</label>
                        <input type="text" required value={cpf} onChange={handleCPFChange} disabled={isEditando} placeholder="000.000.000-00" maxLength={14} className={`block w-full rounded-md shadow-sm p-2.5 border focus:border-[#395D34] outline-none ${isEditando ? 'bg-gray-200 cursor-not-allowed border-gray-200 text-gray-500' : 'bg-gray-50 border-gray-300'}`} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Matrícula</label>
                        <input type="text" required value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="000000" className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Data de Nascimento</label>
                        <input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Validade da Carteira</label>
                        <input type="date" required value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Instituição de Ensino</label>
                        <select required value={instituicao} onChange={e => handleInstituicaoSelecionada(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none">
                           <option value="">Selecione uma escola...</option>
                           {instituicoesDisponiveis.map(inst => (
                             <option key={inst.id} value={inst.nome}>{inst.nome}</option>
                           ))}
                        </select>
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Rota / Ônibus</label>
                        <select required value={rotaAtrelada} onChange={e => setRotaAtrelada(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none">
                          <option value="">Selecione uma rota...</option>
                          {rotas.map(r => <option key={r.id} value={r.nome_rota}>{r.nome_rota}</option>)}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1">Preenchido automaticamente pela instituição.</p>
                      </div>

                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Curso</label>
                        <input type="text" required value={curso} onChange={e => setCurso(e.target.value)} placeholder="Ex: Direito" className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" />
                      </div>
                      
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-sm font-semibold text-[#0B2341] mb-1">Turno</label>
                        <div className="flex gap-4 pt-2">
                          {['Matutino', 'Vespertino', 'Noturno'].map(t => (
                            <label key={t} className="flex items-center cursor-pointer">
                              <input type="radio" name="turno" value={t} checked={turno === t} onChange={e => setTurno(e.target.value)} className="mr-2 text-[#395D34] focus:ring-[#395D34]" />
                              <span className="text-sm text-[#0B2341] font-medium">{t}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border border-gray-200 p-4 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-bold text-[#0B2341]">Documentos Anexos (PDF ou Imagem)</label>
                        <input type="file" multiple accept=".pdf,image/*" ref={docInputRef} onChange={handleDocumentoMultiploUpload} className="hidden" />
                        <button type="button" onClick={() => docInputRef.current?.click()} className="bg-[#0B2341] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#071629] flex items-center text-xs shadow-sm transition">
                          <Plus size={14} className="mr-1" /> Adicionar Documentos
                        </button>
                      </div>
                      
                      {documentosForm.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-2">Nenhum documento anexado ainda.</p>
                      ) : (
                        <div className="space-y-3 mt-2">
                          {documentosForm.map((docAnexo) => (
                            <div key={docAnexo.id} className="flex items-center gap-3 bg-white p-2 border border-gray-200 rounded-lg shadow-sm">
                              <div className="p-2 bg-gray-100 rounded text-gray-500"><FileText size={18}/></div>
                              <div className="flex-1 flex flex-col">
                                <input 
                                  type="text" 
                                  placeholder="Digite o título. Ex: Comprovante de Residência" 
                                  value={docAnexo.titulo} 
                                  onChange={(e) => atualizarTituloDocumento(docAnexo.id, e.target.value)}
                                  className="text-sm font-bold text-[#0B2341] border-b border-gray-300 focus:border-[#395D34] outline-none pb-1 bg-transparent w-full"
                                />
                                <span className="text-[10px] text-gray-400 truncate mt-1">Arquivo: {docAnexo.nome_arquivo}</span>
                              </div>
                              <button type="button" onClick={() => removerDocumentoForm(docAnexo.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="Remover Documento">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 border border-gray-200 p-4 rounded-lg bg-gray-50">
                      <label className="block text-sm font-bold text-[#0B2341] mb-3">Foto do Estudante</label>
                      <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                        <div className="bg-white rounded-lg overflow-hidden w-40 h-48 flex items-center justify-center border-2 border-dashed border-gray-300 relative shadow-sm shrink-0">
                          {showWebcam ? <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ width: 400, height: 400, facingMode: "user" }} className="w-full h-full object-cover" /> : foto ? <img src={foto} alt="Estudante" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-300" />}
                          {showWebcam && <button type="button" onClick={() => setShowWebcam(false)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"><X size={16} /></button>}
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                          {showWebcam ? (
                            <button type="button" onClick={capturarFoto} className="flex justify-center items-center bg-[#395D34] text-white px-4 py-3 rounded-md hover:bg-[#2c4928] font-bold shadow"><Camera size={18} className="mr-2"/> Bater Foto</button>
                          ) : (
                            <><button type="button" onClick={() => setShowWebcam(true)} className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2.5 rounded-md hover:bg-[#071629] font-semibold"><Camera size={18} className="mr-2"/> Abrir Webcam</button>
                              <div className="relative w-full"><input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><button type="button" className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-md hover:bg-gray-50 font-semibold w-full"><ImagePlus size={18} className="mr-2"/> Arquivo Celular / PC</button></div>
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
                  <CarteirinhaTemplate aluno={{ nome, cpf, matricula, data_nascimento: dataNascimento, data_vencimento: dataVencimento, instituicao_destino: instituicao, curso, turno, rota: rotaAtrelada, foto_url: foto || '' }} />
                </div>
              </div>
            </div>

            <div className={`${subTabEstudantes === 'lista' ? 'block' : 'hidden'} bg-white p-6 rounded-xl shadow-sm border print:hidden`}>
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-lg font-bold text-[#0B2341]">Alunos Cadastrados</h2>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#0B2341] focus:border-[#0B2341] outline-none" />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                  <button onClick={handleImprimirLote} disabled={selecionados.length === 0} className="flex items-center justify-center bg-[#0B2341] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#071629] disabled:opacity-50 transition whitespace-nowrap"><Printer size={18} className="mr-2" /> Imprimir ({selecionados.length})</button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3"><input type="checkbox" checked={selecionados.length > 0 && selecionados.length === estudantesFiltrados.length} onChange={() => setSelecionados(selecionados.length === estudantesFiltrados.length ? [] : estudantesFiltrados.map(e => e.id_estudante))} className="rounded border-gray-300 text-[#395D34]" /></th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Estudante</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Instituição / Rota</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {estudantesFiltrados.map((aluno) => (
                      <tr key={aluno.id_estudante} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-4"><input type="checkbox" checked={selecionados.includes(aluno.id_estudante)} onChange={() => setSelecionados(prev => prev.includes(aluno.id_estudante) ? prev.filter(i => i !== aluno.id_estudante) : [...prev, aluno.id_estudante])} className="rounded border-gray-300 text-[#395D34]" /></td>
                        <td className="px-6 py-4 flex items-center gap-3">
                          <img src={aluno.foto_url} alt="" className="w-10 h-10 rounded-full object-cover border" />
                          <div><div className="text-sm font-bold text-[#0B2341]">{aluno.nome}</div><div className="text-xs text-gray-500">{aluno.cpf}</div></div>
                        </td>
                        <td className="px-6 py-4"><div className="text-sm text-[#0B2341] font-semibold">{aluno.instituicao_destino}</div><div className="text-xs text-gray-500">Rota: {aluno.rota}</div></td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            {((aluno.documentos && aluno.documentos.length > 0) || aluno.documento_base64) && (
                              <button onClick={() => abrirModalDocumentos(aluno)} className="text-purple-600 bg-purple-50 hover:bg-purple-100 p-2 rounded-full transition" title="Ver Documentos"><FileText size={18} /></button>
                            )}
                            <button onClick={() => abrirHistorico(aluno)} className="text-[#395D34] bg-green-50 hover:bg-green-100 p-2 rounded-full transition" title="Ver Histórico"><Clock size={18} /></button>
                            <button onClick={() => handleEditar(aluno)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition" title="Editar Estudante"><Edit size={18} /></button>
                            <button onClick={() => handleExcluir(aluno.id_estudante)} className="text-[#890013] bg-red-50 hover:bg-red-100 p-2 rounded-full transition" title="Excluir"><Trash2 size={18} /></button>
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

        {mainTab === 'motoristas' && (
          <div>
            <div className="flex space-x-2 mb-6 flex-wrap gap-y-2">
              <button onClick={() => setSubTabMotoristas('cadastro')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'cadastro' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><UserPlus size={18} className="mr-2" /> Motorista (Cad/Edit)</button>
              <button onClick={() => setSubTabMotoristas('lista')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'lista' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><List size={18} className="mr-2" /> Listar Motoristas</button>
              <button onClick={() => setSubTabMotoristas('instituicoes')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'instituicoes' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Building size={18} className="mr-2" /> Gestão de Instituições</button>
              <button onClick={() => setSubTabMotoristas('rotas')} className={`flex items-center px-4 py-2 rounded-lg font-bold transition shadow-sm ${subTabMotoristas === 'rotas' ? 'bg-[#395D34] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><MapPin size={18} className="mr-2" /> Gestão de Rotas & Paradas</button>
            </div>

            {subTabMotoristas === 'cadastro' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border max-w-3xl">
                <div className="flex justify-between border-b pb-3 mb-4">
                  <h2 className="text-lg font-bold text-[#0B2341]">{motEditId ? 'Editar Motorista' : 'Novo Motorista'}</h2>
                  {motEditId && <button onClick={limparFormMotorista} className="text-sm text-[#890013] font-bold">Cancelar Edição</button>}
                </div>
                <form onSubmit={handleSalvarMotorista} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome Completo</label>
                      <input type="text" required value={motNome} onChange={e => setMotNome(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF (Necessário para o Login)</label>
                      <input type="text" required value={motCpf} onChange={handleCpfMotoristaChange} placeholder="000.000.000-00" maxLength={14} className={`block w-full rounded-md shadow-sm p-2.5 border focus:border-[#395D34] outline-none ${motEditId ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-50 border-gray-300'}`} disabled={!!motEditId} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">CNH</label>
                      <input type="text" required value={motCnh} onChange={e => setMotCnh(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Telefone / WhatsApp</label>
                      <input type="text" required value={motTelefone} onChange={handleTelefoneChange} placeholder="(87) 99999-9999" maxLength={15} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-4 rounded-lg font-bold shadow hover:bg-[#2c4928] mt-6 text-lg">
                    <Save size={20} className="mr-2" /> {motEditId ? 'Atualizar Motorista' : 'Salvar Motorista'}
                  </button>
                </form>
              </div>
            )}

            {subTabMotoristas === 'lista' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-[#0B2341]">Motoristas Cadastrados</h2>
                  <div className="relative w-72">
                    <input type="text" placeholder="Buscar motorista..." value={buscaMotorista} onChange={(e) => setBuscaMotorista(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#0B2341] focus:border-[#0B2341] outline-none" />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nome</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">CPF / Contato</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {motoristasFiltrados.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-sm text-[#0B2341]">{m.nome}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"><div>CPF: {m.cpf}</div><div className="text-xs text-gray-500">{m.telefone}</div></td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleEditarMotorista(m)} className="text-blue-600 hover:bg-blue-100 bg-blue-50 p-2 rounded-full transition"><Edit size={18} /></button>
                              <button onClick={() => handleExcluirMotorista(m.id)} className="text-[#890013] hover:bg-red-100 bg-red-50 p-2 rounded-full transition"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {subTabMotoristas === 'instituicoes' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
                  <h2 className="text-lg font-bold text-[#0B2341] border-b pb-3 mb-4">Nova Instituição</h2>
                  <form onSubmit={handleSalvarInstituicao} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome da Instituição</label>
                      <input type="text" required value={novaInstNome} onChange={e => setNovaInstNome(e.target.value)} placeholder="Ex: UFPE, UFRPE, AESGA..." className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                      <p className="text-[10px] text-gray-500 mt-1">Essa instituição aparecerá na lista para o aluno e nas paradas das rotas.</p>
                    </div>
                    <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-3 rounded-lg font-bold shadow hover:bg-[#2c4928] mt-4">
                      <Save size={18} className="mr-2" /> Salvar Instituição
                    </button>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Instituições Cadastradas</h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Instituição de Ensino</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase w-20">Excluir</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {instituicoesDisponiveis.length === 0 ? (
                          <tr><td colSpan={2} className="px-6 py-4 text-center text-gray-400 text-sm">Nenhuma instituição cadastrada.</td></tr>
                        ) : (
                          instituicoesDisponiveis.map(inst => (
                            <tr key={inst.id} className="hover:bg-gray-50 transition">
                              <td className="px-6 py-4 font-bold text-sm text-[#0B2341]">{inst.nome}</td>
                              <td className="px-6 py-4 text-center">
                                <button onClick={() => handleExcluirInstituicao(inst.id)} className="text-[#890013] bg-red-50 hover:bg-red-100 p-2 rounded-full transition"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {subTabMotoristas === 'rotas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border h-fit">
                  <div className="flex justify-between border-b pb-3 mb-4">
                    <h2 className="text-lg font-bold text-[#0B2341]">{rotaEditId ? 'Editar Rota' : 'Nova Rota'}</h2>
                    {rotaEditId && <button onClick={limparFormRota} className="text-sm text-[#890013] font-bold">Cancelar</button>}
                  </div>
                  <form onSubmit={handleSalvarRota} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome da Rota</label>
                      <input type="text" required value={rotaNome} onChange={e => setRotaNome(e.target.value)} placeholder="Ex: Rota Recife" className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Vincular Motorista (via CPF)</label>
                      <select required value={rotaMotoristaCpf} onChange={e => setRotaMotoristaCpf(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none">
                        <option value="">Selecione um motorista...</option>
                        {motoristas.map(m => <option key={m.id} value={m.cpf}>{m.nome} (CPF: {m.cpf})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#0B2341] mb-1">Link Grupo WhatsApp</label>
                      <input type="url" value={whatsappRota} onChange={e => setWhatsappRota(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="block w-full rounded-md border-gray-300 shadow-sm p-2.5 border focus:border-[#395D34] bg-gray-50 outline-none" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full flex justify-center items-center bg-[#395D34] text-white px-4 py-3 rounded-lg font-bold shadow hover:bg-[#2c4928] mt-6">
                      <Save size={18} className="mr-2" /> {rotaEditId ? 'Atualizar Rota' : 'Salvar Rota'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
                  <h2 className="text-lg font-bold text-[#0B2341] mb-4">Rotas Cadastradas e Paradas</h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Rota / Motorista</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Paradas</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rotas.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-bold text-sm text-[#0B2341]">{r.nome_rota}</div>
                              <div className="text-xs text-gray-500 flex items-center mt-1"><User size={12} className="mr-1"/> {r.motorista_nome || 'Sem motorista'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                {r.whatsapp_link && <a href={r.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs font-bold flex items-center"><MessageCircle size={14} className="mr-1" /> Grupo</a>}
                                <button onClick={() => abrirGerenciadorParadas(r)} className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center">
                                  <MapPin size={14} className="mr-1" /> {r.paradas?.length || 0} Instituição(ões)
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center gap-2">
                                <button onClick={() => handleEditarRota(r)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-full transition"><Edit size={18} /></button>
                                <button onClick={() => handleExcluirRota(r.id)} className="text-[#890013] bg-red-50 hover:bg-red-100 p-2 rounded-full transition"><Trash2 size={18} /></button>
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
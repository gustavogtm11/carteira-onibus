// src/pages/Motorista/ScannerMotorista.tsx
import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, collection, addDoc, getDocs, query, where, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { BusFront, CheckCircle, XCircle, LogOut, ScanLine, AlertTriangle, MapPin, Users, X, Clock, Map, MessageCircle } from 'lucide-react';

interface EstudanteScan {
  id_estudante: string;
  nome: string;
  foto_url: string;
  instituicao: string;
  curso: string;
  turno: string;
  rota_aluno: string;
  vencimento?: string;
  telefone?: string;
}

export default function ScannerMotorista() {
  const { user } = useAuth();
  
  const userAny = user as any;
  const roleStr = String(userAny?.role || '');
  const isFiscal = roleStr === 'fiscal' || roleStr === 'admin';

  const [rotasDisponiveis, setRotasDisponiveis] = useState<{ id: string, nome: string }[]>([]);
  const [rotaAtualId, setRotaAtualId] = useState('');
  const [rotaAtualNome, setRotaAtualNome] = useState('');
  const [tipoViagem, setTipoViagem] = useState<'ida' | 'volta'>('ida');
  
  const [estudante, setEstudante] = useState<EstudanteScan | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error' | 'loading' | 'confirmacao'>('idle');
  const [mensagem, setMensagem] = useState('');
  const [estudantePendente, setEstudantePendente] = useState<{ dados: any, sentido: 'ida' | 'volta' } | null>(null);
  
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  
  const [idsIdaHoje, setIdsIdaHoje] = useState<string[]>([]);
  const [idsVoltaHoje, setIdsVoltaHoje] = useState<string[]>([]);
  const [alunosNaRota, setAlunosNaRota] = useState<any[]>([]);
  const [embarcadosHistorico, setEmbarcadosHistorico] = useState<any[]>([]);
  
  const [showFaltantes, setShowFaltantes] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  const isProcessingRef = useRef(false);
  const coordsRef = useRef(coords);
  const rotaAtualIdRef = useRef(rotaAtualId);
  const rotaAtualNomeRef = useRef(rotaAtualNome);
  const tipoViagemRef = useRef(tipoViagem);
  const rotasDisponiveisRef = useRef(rotasDisponiveis);
  const idsIdaHojeRef = useRef(idsIdaHoje);
  const idsVoltaHojeRef = useRef(idsVoltaHoje);

  useEffect(() => { coordsRef.current = coords; }, [coords]);
  useEffect(() => { rotaAtualIdRef.current = rotaAtualId; }, [rotaAtualId]);
  useEffect(() => { rotaAtualNomeRef.current = rotaAtualNome; }, [rotaAtualNome]);
  useEffect(() => { tipoViagemRef.current = tipoViagem; }, [tipoViagem]);
  useEffect(() => { rotasDisponiveisRef.current = rotasDisponiveis; }, [rotasDisponiveis]);
  useEffect(() => { idsIdaHojeRef.current = idsIdaHoje; }, [idsIdaHoje]);
  useEffect(() => { idsVoltaHojeRef.current = idsVoltaHoje; }, [idsVoltaHoje]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn("Aviso de GPS:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const buscarRotas = async () => {
      if (!user) return;
      try {
        let listaRotasMap: { id: string, nome: string }[] = [];

        if (isFiscal) {
          const snap = await getDocs(collection(db, 'rotas'));
          snap.docs.forEach(d => {
            const data = d.data();
            const nome = data.nome_rota || data.nome;
            if (nome) listaRotasMap.push({ id: d.id, nome: String(nome).trim() });
          });
        } else {
          let cpfsPossiveis = new Set<string>();
          let emailsPossiveis = new Set<string>();

          if (userAny?.cpf) cpfsPossiveis.add(String(userAny.cpf).replace(/\D/g, ''));
          if (user?.email) emailsPossiveis.add(String(user.email).trim().toLowerCase());

          if (user?.uid) {
            try {
              const userDocRef = await getDoc(doc(db, 'users', user.uid));
              if (userDocRef.exists()) {
                const uData = userDocRef.data();
                if (uData.cpf) cpfsPossiveis.add(String(uData.cpf).replace(/\D/g, ''));
                if (uData.email) emailsPossiveis.add(String(uData.email).trim().toLowerCase());
              }
            } catch (e) { /* ignora */ }

            try {
              const authDocRef = await getDoc(doc(db, 'usuarios_autorizados', user.uid));
              if (authDocRef.exists()) {
                const aData = authDocRef.data();
                if (aData.cpf) cpfsPossiveis.add(String(aData.cpf).replace(/\D/g, ''));
                if (aData.email) emailsPossiveis.add(String(aData.email).trim().toLowerCase());
              }
            } catch (e) { /* ignora */ }
          }

          const snapRotas = await getDocs(collection(db, 'rotas'));
          snapRotas.docs.forEach(d => {
            const data = d.data();
            const motCpfBanco = String(data.motorista_cpf || '').replace(/\D/g, '');
            const motEmailBanco = String(data.motorista_email || '').trim().toLowerCase();
            const nomeRota = data.nome_rota || data.nome;

            if (nomeRota) {
              let atrelado = false;
              cpfsPossiveis.forEach(cpf => {
                if (cpf && motCpfBanco === cpf) atrelado = true;
              });
              emailsPossiveis.forEach(email => {
                if (email && motEmailBanco === email) atrelado = true;
              });

              if (atrelado) {
                listaRotasMap.push({ id: d.id, nome: String(nomeRota).trim() });
              }
            }
          });
        }

        setRotasDisponiveis(listaRotasMap);
        if (listaRotasMap.length > 0) {
          setRotaAtualId(listaRotasMap[0].id);
          setRotaAtualNome(listaRotasMap[0].nome);
        }
      } catch (error) {
        console.error("Erro ao buscar rotas", error);
      }
    };
    buscarRotas();
  }, [user, isFiscal, userAny]);

  // CARREGAR DADOS E OUVINTE EM TEMPO REAL (ONSNAPSHOT)
  useEffect(() => {
    let unsubscribeDiario: () => void;

    const carregarControleDiario = async () => {
      if (!rotaAtualId || !rotaAtualNome) return;
      try {
        // Carrega alunos da Rota apenas uma vez
        const snapEstudantes = await getDocs(collection(db, 'estudantes'));
        const rotaLimpa = rotaAtualNome.trim().toLowerCase();
        const alunosFiltrados = snapEstudantes.docs.map(d => {
          const data = d.data() as any;
          return {
            ...data,
            id_estudante: String(data.id_estudante || d.id).trim()
          };
        }).filter((a: any) => String(a.rota || '').trim().toLowerCase() === rotaLimpa);
        
        setAlunosNaRota(alunosFiltrados);

        // Define a Referência do Documento Diário
        const hojeStr = new Date().toISOString().split('T')[0];
        const docIdDiario = `${hojeStr}_${rotaAtualNome.replace(/\s+/g, '_')}`;
        const diarioRef = doc(db, 'embarques_diarios', docIdDiario);

        // OUVINTE EM TEMPO REAL
        unsubscribeDiario = onSnapshot(diarioRef, async (diarioSnap) => {
          if (diarioSnap.exists()) {
            const dados = diarioSnap.data();
            const ultimaAtualizacao = dados.ultima_atualizacao?.toDate ? dados.ultima_atualizacao.toDate() : null;

            const agora = new Date();
            let expirado = true;
            if (ultimaAtualizacao) {
              const diffHoras = Math.abs(agora.getTime() - ultimaAtualizacao.getTime()) / 36e5;
              const mesmoDia = agora.toDateString() === ultimaAtualizacao.toDateString();
              if (diffHoras < 12 && mesmoDia) {
                expirado = false;
              }
            }

            if (expirado) {
              setIdsIdaHoje([]);
              setIdsVoltaHoje([]);
              await deleteDoc(diarioRef);
            } else {
              setIdsIdaHoje((dados.ids_ida || []).map((id: any) => String(id).trim()));
              setIdsVoltaHoje((dados.ids_volta || []).map((id: any) => String(id).trim()));
            }
          } else {
            setIdsIdaHoje([]);
            setIdsVoltaHoje([]);
          }
        });

        // Carrega Histórico Base
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const qHist = query(
          collection(db, 'historico_viagens'),
          where('id_rota_onibus', '==', rotaAtualNome),
          where('data_hora', '>=', inicioDia)
        );
        const snapHist = await getDocs(qHist);
        setEmbarcadosHistorico(snapHist.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (e) {
        console.error("Erro ao carregar controle diário:", e);
      }
    };
    
    carregarControleDiario();

    // Limpa o ouvinte ao desmontar
    return () => {
      if (unsubscribeDiario) unsubscribeDiario();
    };
  }, [rotaAtualId, rotaAtualNome]);

  const registrarViagem = async (dadosEstudante: any, sentido: 'ida' | 'volta', isExata: boolean) => {
    let linkMaps = '';
    if (coordsRef.current) {
      linkMaps = `https://www.google.com/maps?q=${coordsRef.current.lat},${coordsRef.current.lng}`;
    }

    const idEstudanteLimpo = String(dadosEstudante.id_estudante || '').trim();

    const novoEmbarqueHistorico = {
      id_estudante: idEstudanteLimpo,
      nome_estudante: dadosEstudante.nome,
      id_motorista: user?.uid || '',
      nome_motorista: userAny?.nome || user?.email || '',
      id_rota_onibus: rotaAtualNomeRef.current, 
      rota_original_aluno: dadosEstudante.rota, 
      tipo_viagem: sentido,
      data_hora: new Date(),
      acesso_universal: !isExata,
      autorizado_por_fiscal: isFiscal,
      link_maps: linkMaps
    };

    try {
      const docRef = await addDoc(collection(db, 'historico_viagens'), novoEmbarqueHistorico);
      setEmbarcadosHistorico(prev => [{ id: docRef.id, ...novoEmbarqueHistorico }, ...prev]);
    } catch (e) {
      console.error("Erro ao salvar histórico oficial", e);
    }

    // A matriz local é atualizada pela função para garantir resiliência, 
    // mas o onSnapshot garantirá a sincronização com a UI em seguida
    let novasIdas = [...idsIdaHoje];
    let novasVoltas = [...idsVoltaHoje];

    if (sentido === 'ida') {
      if (!novasIdas.includes(idEstudanteLimpo)) novasIdas.push(idEstudanteLimpo);
    } else {
      if (!novasVoltas.includes(idEstudanteLimpo)) novasVoltas.push(idEstudanteLimpo);
    }

    try {
      const hojeStr = new Date().toISOString().split('T')[0];
      const docIdDiario = `${hojeStr}_${rotaAtualNomeRef.current.replace(/\s+/g, '_')}`;
      const diarioRef = doc(db, 'embarques_diarios', docIdDiario);

      await setDoc(diarioRef, {
        rota: rotaAtualNomeRef.current,
        ids_ida: novasIdas,
        ids_volta: novasVoltas,
        ultima_atualizacao: new Date()
      }, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar na coleção embarques_diarios:", e);
    }

    setEstudante({
      id_estudante: idEstudanteLimpo,
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
    
    // Força a caixa ser quadrada
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const qrCodeSuccessCallback = async (decodedText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setStatus('loading');

      try {
        const estudanteSnap = await getDoc(doc(db, 'estudantes', decodedText));

        if (estudanteSnap.exists()) {
          const dadosBrutos = estudanteSnap.data() as any;
          const idEstudante = String(dadosBrutos.id_estudante || decodedText).trim();
          const dadosEstudante: any = { ...dadosBrutos, id_estudante: idEstudante };
          const sentidoAtual = tipoViagemRef.current;

          const jaEmbarcouNesteSentido = sentidoAtual === 'ida' 
            ? idsIdaHojeRef.current.includes(idEstudante) 
            : idsVoltaHojeRef.current.includes(idEstudante);

          if (jaEmbarcouNesteSentido) {
            setEstudante({
              id_estudante: idEstudante,
              nome: dadosEstudante.nome,
              foto_url: dadosEstudante.foto_url,
              instituicao: dadosEstudante.instituicao_destino || '-',
              curso: dadosEstudante.curso || '-',
              turno: dadosEstudante.turno || '-',
              rota_aluno: dadosEstudante.rota || '-',
              vencimento: dadosEstudante.data_vencimento
            });
            setStatus('error');
            setMensagem(`ATENÇÃO: Aluno já embarcou na ${sentidoAtual.toUpperCase()} hoje!`);
            setTimeout(() => {
              setStatus('idle');
              setEstudante(null);
              setMensagem('');
              isProcessingRef.current = false;
            }, 3000);
            return;
          }

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

          const rotaAlunoLimpa = String(dadosEstudante.rota || '').trim().toLowerCase();
          const rotaAtualLimpa = String(rotaAtualNomeRef.current || '').trim().toLowerCase();
          const listaRotasMotorista = rotasDisponiveisRef.current.map(r => r.nome.trim().toLowerCase());
          
          const isRotaExata = isFiscal || rotaAlunoLimpa === rotaAtualLimpa || listaRotasMotorista.includes(rotaAlunoLimpa);

          if (isRotaExata) {
            await registrarViagem(dadosEstudante, sentidoAtual, true);
          } else {
            setEstudantePendente({ dados: dadosEstudante, sentido: sentidoAtual });
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
      undefined
    ).catch((err) => {
      console.warn("Câmera traseira falhou, usando a padrão...", err);
      html5QrCode.start(
        { facingMode: "user" },
        config,
        qrCodeSuccessCallback,
        undefined
      ).catch(e => console.error("Erro crítico ao abrir câmera:", e));
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => html5QrCode.clear());
      } else {
        html5QrCode.clear();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // CÁLCULO DE FALTANTES (Apenas para a Volta, baseado em quem foi na Ida)
  let alunosFaltantes: any[] = [];
  if (tipoViagem === 'volta') {
    const idsQueForamNaIda = new Set(idsIdaHoje.map(id => String(id).trim()));
    const idsJaLidosVolta = new Set(idsVoltaHoje.map(id => String(id).trim()));
    
    // Pega os alunos da rota que FORAM na ida, mas que AINDA NÃO retornaram
    const alunosParaVoltar = alunosNaRota.filter(a => idsQueForamNaIda.has(String(a.id_estudante).trim()));
    alunosFaltantes = alunosParaVoltar.filter(a => !idsJaLidosVolta.has(String(a.id_estudante).trim()));
  }

  const embarcadosSentidoAtual = embarcadosHistorico.filter((h: any) => h.tipo_viagem === tipoViagem);

  return (
    <div className="h-[100dvh] w-full bg-gray-50 text-gray-800 flex flex-col font-sans overflow-hidden">
      
      {/* Estilos Globais forçados para a câmera quadrada do Html5Qrcode */}
      <style>{`
        #qr-reader-container video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
      `}</style>

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
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistorico(true)} className="text-white/80 p-2 hover:bg-[#395D34] hover:text-white rounded-full transition-colors" title="Histórico da Rota">
            <Clock size={20} />
          </button>
          <button onClick={() => signOut(auth)} className="text-white/80 p-2 hover:bg-[#890013] hover:text-white rounded-full transition-colors" title="Sair">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col w-full relative">
        <div className="shrink-0 bg-white px-4 pt-3 pb-2 shadow-sm z-10 border-b border-gray-200 flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <select 
                value={rotaAtualId} 
                onChange={e => {
                  const rId = e.target.value;
                  const encontrada = rotasDisponiveis.find(r => r.id === rId);
                  setRotaAtualId(rId);
                  if (encontrada) setRotaAtualNome(encontrada.nome);
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2 text-sm font-bold text-[#0B2341] outline-none"
              >
                {rotasDisponiveis.length === 0 ? <option value="">Sem rotas atreladas</option> : rotasDisponiveis.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            
            {/* O botão "Faltam" só aparece se for Volta */}
            {tipoViagem === 'volta' && (
              <button 
                onClick={() => setShowFaltantes(true)}
                className="bg-orange-50 border border-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 shadow-sm active:bg-orange-100"
              >
                <Users size={14} className="mr-1.5" />
                Faltam: {alunosFaltantes.length}
              </button>
            )}
          </div>

          <div className="flex gap-2 items-center h-9">
            <div className="flex gap-1 flex-1 h-full">
              <button onClick={() => setTipoViagem('ida')} className={`flex-1 rounded-lg font-bold transition-all text-xs border ${tipoViagem === 'ida' ? 'bg-[#395D34] border-[#395D34] text-white shadow-inner' : 'bg-white border-gray-300 text-gray-500'}`}>IDA</button>
              <button onClick={() => setTipoViagem('volta')} className={`flex-1 rounded-lg font-bold transition-all text-xs border ${tipoViagem === 'volta' ? 'bg-[#0B2341] border-[#0B2341] text-white shadow-inner' : 'bg-white border-gray-300 text-gray-500'}`}>VOLTA</button>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden w-full h-full p-4">
          
          {/* Container Quadrado Perfeito (Aspect-Square) */}
          <div className="w-full max-w-[280px] aspect-square bg-gray-900 rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl relative flex items-center justify-center">
             <div id="qr-reader-container" className="absolute inset-0 w-full h-full"></div>
          </div>

          {status === 'loading' && (
            <div className="absolute inset-0 bg-[#0B2341]/90 z-20 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="font-bold text-white tracking-widest uppercase text-xs">Aguarde...</p>
            </div>
          )}

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

      {showFaltantes && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowFaltantes(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-orange-50 p-4 flex items-center justify-between border-b border-orange-200 shrink-0">
              <div className="flex items-center text-orange-800">
                <Users size={20} className="mr-2" />
                <h3 className="font-bold text-sm">Faltam Voltar ({alunosFaltantes.length})</h3>
              </div>
              <button onClick={() => setShowFaltantes(false)} className="text-orange-800/60 hover:text-orange-900 p-1"><X size={20} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
              {alunosFaltantes.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CheckCircle size={40} className="mx-auto mb-2 opacity-30 text-green-500" />
                  <p className="text-sm font-medium">Todos os alunos desta rota já embarcaram!</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {alunosFaltantes.map(aluno => {
                    // Prepara o link do Whatsapp caso o aluno tenha telefone
                    const phoneClean = aluno.telefone ? aluno.telefone.replace(/\D/g, '') : '';
                    const linkWhats = phoneClean ? `https://wa.me/55${phoneClean}?text=Olá ${aluno.nome.split(' ')[0]}, o ônibus da volta está te aguardando!` : null;

                    return (
                      <li key={aluno.id_estudante || Math.random().toString()} className="p-3 flex items-center justify-between bg-white hover:bg-gray-50 transition">
                        <div className="flex items-center flex-1 overflow-hidden mr-2">
                          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 shrink-0">
                            {aluno.foto_url ? <img src={aluno.foto_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Users size={16}/></div>}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold text-[#0B2341] truncate leading-tight">{aluno.nome}</p>
                            <p className="text-[10px] text-gray-500 font-medium truncate flex items-center mt-0.5">
                              <MapPin size={10} className="mr-1 text-gray-400"/> {aluno.instituicao_destino || 'Sem Instituição'}
                            </p>
                          </div>
                        </div>
                        
                        {linkWhats && (
                          <a 
                            href={linkWhats}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#25D366] bg-[#25D366]/10 p-2.5 rounded-full hover:bg-[#25D366]/20 transition shrink-0"
                            title="Avisar no WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {showHistorico && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowHistorico(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0B2341] p-4 flex items-center justify-between border-b shrink-0">
              <div className="flex items-center text-white">
                <Clock size={20} className="mr-2" />
                <h3 className="font-bold text-sm">Últimos Embarques ({embarcadosSentidoAtual.length})</h3>
              </div>
              <button onClick={() => setShowHistorico(false)} className="text-white/60 hover:text-white p-1"><X size={20} /></button>
            </div>
            <div className="p-0 overflow-y-auto flex-1 bg-gray-50">
              {embarcadosSentidoAtual.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm font-medium">Nenhum aluno embarcou ainda nesta categoria.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {embarcadosSentidoAtual.map((registro: any) => (
                    <li key={registro.id || Math.random().toString()} className="p-3 flex flex-col bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-sm font-bold text-[#0B2341] truncate leading-tight flex-1 mr-2">{registro.nome_estudante}</p>
                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded shrink-0">
                          {registro.data_hora?.toDate ? registro.data_hora.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-gray-500 uppercase">{registro.tipo_viagem}</span>
                        {registro.link_maps && (
                          <a href={registro.link_maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors">
                            <Map size={12} className="mr-1" /> Ver Local
                          </a>
                        )}
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
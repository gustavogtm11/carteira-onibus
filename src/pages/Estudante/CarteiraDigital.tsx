// src/pages/Estudante/CarteiraDigital.tsx
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { LogOut, Bus, Repeat, MapPin, Calendar, Download, AlertOctagon, MessageCircle, Map } from 'lucide-react';

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

export default function CarteiraDigital() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  
  const [estudante, setEstudante] = useState<EstudanteDados | null>(null);
  const [historico, setHistorico] = useState<Viagem[]>([]);
  const [whatsappRota, setWhatsappRota] = useState<string>('');
  
  const [cpfVinculo, setCpfVinculo] = useState('');
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const buscarDados = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        let cpfEstudante = '';

        if (userSnap.exists()) {
          const userData = userSnap.data();
          cpfEstudante = userData.id_estudante || userData.cpf;
        }

        if (cpfEstudante) {
          const cpfLimpo = cpfEstudante.replace(/\D/g, '');
          const estudanteRef = doc(db, 'estudantes', cpfLimpo);
          const estudanteSnap = await getDoc(estudanteRef);
          
          if (estudanteSnap.exists()) {
            const dadosAluno = estudanteSnap.data() as EstudanteDados;
            setEstudante(dadosAluno);

            await setDoc(userRef, {
              uid: user.uid,
              email: user.email,
              nome: dadosAluno.nome,
              role: 'estudante',
              cpf: dadosAluno.cpf,
              id_estudante: cpfLimpo,
              atualizadoEm: new Date()
            }, { merge: true });

            buscarHistorico(cpfLimpo);
            buscarWhatsappDaRota(dadosAluno.rota);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    buscarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      
      const viagens = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
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

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    setCpfVinculo(value);
  };

  const formatarCPF = (cpf: string) => {
    if (!cpf) return '';
    const cleanCPF = cpf.replace(/\D/g, '');
    return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleVincularConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    
    try {
      const cpfLimpo = cpfVinculo.replace(/\D/g, '');
      const estudanteRef = doc(db, 'estudantes', cpfLimpo);
      const estudanteSnap = await getDoc(estudanteRef);
      
      if (estudanteSnap.exists()) {
        const dadosAluno = estudanteSnap.data() as EstudanteDados;
        
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          nome: dadosAluno.nome,
          role: 'estudante',
          cpf: dadosAluno.cpf,
          id_estudante: cpfLimpo,
          atualizadoEm: new Date()
        }, { merge: true });

        setEstudante(dadosAluno);
        buscarHistorico(cpfLimpo);
        buscarWhatsappDaRota(dadosAluno.rota);
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

  const handleSalvarCarteira = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Minha Carteirinha Digital',
          text: 'Passe Livre Estudantil - Prefeitura Municipal',
          url: window.location.href,
        });
      } catch (error) {
        console.error('Erro ao compartilhar', error);
      }
    } else {
      showAlert("Para salvar, utilize a opção 'Adicionar à Tela de Início' no menu do seu navegador.", 'info');
    }
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

  if (loading) return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col items-center justify-center font-bold text-[#0B2341]">
      <div className="w-10 h-10 border-4 border-[#395D34] border-t-transparent rounded-full animate-spin mb-4"></div>
      Carregando carteira...
    </div>
  );

  return (
    <div className="h-[100dvh] bg-gray-100 flex flex-col font-sans overflow-hidden">
      
      <nav className="shrink-0 bg-[#0B2341] text-white p-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center">
          <Bus size={22} className="mr-2 text-[#395D34]" />
          <span className="font-bold text-lg">Transporte Escolar</span>
        </div>
        <button onClick={() => signOut(auth)} className="hover:text-red-300 transition-colors p-1">
          <LogOut size={20} />
        </button>
      </nav>

      <div className="flex-1 overflow-y-auto p-4 w-full max-w-md mx-auto flex flex-col gap-6">
        
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
                  type="text" 
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
              
              {/* CARTÃO COM FLIP 3D CORRIGIDO PARA MOBILE/SAFARI */}
              <div 
                className="w-full aspect-[1.58] bg-transparent cursor-pointer group"
                style={{ perspective: '1000px' }}
                onClick={() => setFlipped(!flipped)}
              >
                <div 
                  className="relative w-full h-full transition-transform duration-700 shadow-2xl rounded-2xl"
                  style={{ 
                    transformStyle: 'preserve-3d', 
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
                  }}
                >
                  
                  {/* FRENTE */}
                  <div 
                    className={`absolute inset-0 w-full h-full bg-gradient-to-br from-white via-gray-50 to-blue-50/50 rounded-2xl p-5 flex flex-col justify-between text-gray-800 overflow-hidden border-2 shadow-xl ${estaVencido ? 'border-[#890013]' : 'border-[#0B2341]/30'}`}
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
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

                  {/* VERSO */}
                  <div 
                    className="absolute inset-0 w-full h-full bg-white rounded-2xl p-5 flex flex-col justify-between border-2 border-gray-200 shadow-xl text-gray-800"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
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

              {whatsappRota && (
                <a 
                  href={whatsappRota} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3.5 rounded-xl font-bold hover:bg-[#20ba5a] transition-colors shadow-md text-sm"
                >
                  <MessageCircle size={18} /> Grupo do WhatsApp da Rota
                </a>
              )}

              <button 
                onClick={handleSalvarCarteira}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-[#0B2341] text-white py-3.5 rounded-xl font-bold hover:bg-[#071629] transition-colors shadow-lg text-sm"
              >
                <Download size={18} /> Salvar na Carteira Digital
              </button>
            </div>

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
                      
                      {/* BOTÃO PARA ABRIR O LOCAL NO GOOGLE MAPS */}
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
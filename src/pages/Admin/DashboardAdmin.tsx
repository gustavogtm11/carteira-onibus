// src/pages/Admin/DashboardAdmin.tsx
import { useState, useEffect } from 'react';
import { doc, setDoc, getDocs, collection, deleteDoc, addDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { useAlert } from '../../contexts/AlertContext';
import { LogOut, UserPlus, Trash2, ShieldCheck, Map, Users, MapPin, PlusCircle, BusFront, Edit, X } from 'lucide-react';

interface UsuarioAutorizado {
  email: string;
  role: string;
  cpf?: string;
}

interface Rota {
  id: string;
  nome: string;
  motorista_email: string;
}

export default function DashboardAdmin() {
  const { showAlert, showConfirm } = useAlert();
  const [activeTab, setActiveTab] = useState<'funcionarios' | 'rotas'>('funcionarios');

  // Estados de Funcionários
  const [emailNovo, setEmailNovo] = useState('');
  const [cpfNovo, setCpfNovo] = useState('');
  const [roleNovo, setRoleNovo] = useState('cadastrante');
  const [usuarios, setUsuarios] = useState<UsuarioAutorizado[]>([]);
  
  // Estado para Edição de Funcionário
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<string | null>(null);

  // Estados de Rotas
  const [motoristaSelecionado, setMotoristaSelecionado] = useState('');
  const [nomeRotaNova, setNomeRotaNova] = useState('');
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtra apenas os motoristas/fiscais para o select de rotas
  const motoristas = usuarios.filter(u => u.role === 'motorista');

  // Carregamentos
  const carregarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'usuarios_autorizados'));
      const lista: UsuarioAutorizado[] = [];
      querySnapshot.forEach((docSnap) => {
        lista.push({ email: docSnap.id, role: docSnap.data().role, cpf: docSnap.data().cpf });
      });
      setUsuarios(lista);
    } catch (err) {
      console.error("Erro ao carregar usuários", err);
    }
  };

  const carregarRotas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'rotas'));
      const lista: Rota[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        lista.push({ 
          id: docSnap.id, 
          nome: data.nome || data.nome_rota, 
          motorista_email: data.motorista_email 
        });
      });
      setRotas(lista);
    } catch (err) {
      console.error("Erro ao carregar rotas", err);
    }
  };

  useEffect(() => {
    carregarUsuarios();
    carregarRotas();
  }, []);

  // Handlers de Funcionários
  const handleSalvarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailNovo || !cpfNovo) return;
    setLoading(true);
    
    try {
      // AJUSTE CRÍTICO DE LOGIN: Limpeza total de formatação de CPF e E-mail
      const cpfLimpo = cpfNovo.replace(/\D/g, ''); // Garante que só vai número para o banco
      const emailLimpo = emailNovo.trim().toLowerCase(); // Evita erros de espaço ou letras maiúsculas no login
      
      if (cpfLimpo.length !== 11) {
        showAlert('Por favor, informe um CPF válido com 11 dígitos.', 'error');
        setLoading(false);
        return;
      }

      await setDoc(doc(db, 'usuarios_autorizados', emailLimpo), {
        role: roleNovo,
        cpf: cpfLimpo,
        atualizadoEm: new Date()
      }, { merge: true });
      
      showAlert(usuarioEmEdicao ? 'Funcionário atualizado com sucesso!' : 'Funcionário autorizado com sucesso!', 'success');
      cancelarEdicao();
      carregarUsuarios();
    } catch (err) {
      console.error(err);
      showAlert('Erro ao salvar usuário.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const iniciarEdicaoFuncionario = (u: UsuarioAutorizado) => {
    setUsuarioEmEdicao(u.email);
    setEmailNovo(u.email);
    setCpfNovo(u.cpf || '');
    setRoleNovo(u.role);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicao = () => {
    setUsuarioEmEdicao(null);
    setEmailNovo('');
    setCpfNovo('');
    setRoleNovo('cadastrante');
  };

  const handleRemoverFuncionario = (email: string) => {
    showConfirm(`Remover acesso de ${email}? As rotas atreladas a ele não serão apagadas.`, async () => {
      try {
        await deleteDoc(doc(db, 'usuarios_autorizados', email));
        showAlert('Acesso removido com sucesso.', 'success');
        carregarUsuarios();
      } catch (err) {
        console.error(err);
        showAlert('Erro ao remover usuário.', 'error');
      }
    });
  };

  // Handlers de Rotas
  const handleCadastrarRota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeRotaNova || !motoristaSelecionado) {
      return showAlert('Por favor, selecione um motorista/fiscal e digite o nome da rota.', 'info');
    }
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'rotas'), {
        nome: nomeRotaNova,
        nome_rota: nomeRotaNova,
        motorista_email: motoristaSelecionado,
        criadaEm: new Date()
      });
      setNomeRotaNova('');
      carregarRotas();
      showAlert('Rota atribuída ao motorista/fiscal com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao cadastrar rota.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverRota = (id: string, nome: string) => {
    showConfirm(`Tem certeza que deseja apagar a rota "${nome}"?`, async () => {
      try {
        await deleteDoc(doc(db, 'rotas', id));
        showAlert('Rota excluída.', 'success');
        carregarRotas();
      } catch (err) {
        console.error(err);
        showAlert('Erro ao excluir rota.', 'error');
      }
    });
  };

  const handleLogout = () => signOut(auth);

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      
      {/* Navbar */}
      <nav className="bg-[#0B2341] text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center">
          <ShieldCheck size={24} className="mr-2 text-[#395D34]" />
          <h1 className="font-bold text-xl">Prefeitura de Angelim <span className="font-light opacity-80">| Admin</span></h1>
        </div>
        <button onClick={handleLogout} className="flex items-center hover:text-red-300 transition-colors font-semibold">
          <LogOut size={20} className="mr-2" /> Sair
        </button>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        
        {/* Controle de Abas */}
        <div className="flex space-x-2 border-b border-gray-300 mb-6">
          <button 
            onClick={() => setActiveTab('funcionarios')}
            className={`flex items-center px-5 py-3 rounded-t-lg font-bold transition text-sm ${activeTab === 'funcionarios' ? 'bg-white border-t border-l border-r border-gray-300 text-[#0B2341]' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Users size={18} className="mr-2" /> Gestão de Funcionários
          </button>
          <button 
            onClick={() => setActiveTab('rotas')}
            className={`flex items-center px-5 py-3 rounded-t-lg font-bold transition text-sm ${activeTab === 'rotas' ? 'bg-white border-t border-l border-r border-gray-300 text-[#0B2341]' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Map size={18} className="mr-2" /> Rotas por Motorista/Fiscal
          </button>
        </div>

        {/* ================= ABA DE FUNCIONÁRIOS ================= */}
        {activeTab === 'funcionarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulário de Funcionários */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-1 h-fit">
              <div className="flex justify-between items-center border-b pb-3 mb-6">
                <h2 className="text-lg font-bold text-[#0B2341] flex items-center">
                  <UserPlus size={20} className="mr-2 text-[#395D34]" /> 
                  {usuarioEmEdicao ? 'Editar Funcionário' : 'Novo Funcionário'}
                </h2>
                {usuarioEmEdicao && (
                  <button onClick={cancelarEdicao} className="text-sm text-gray-500 hover:text-[#890013] flex items-center font-medium">
                    <X size={16} className="mr-1"/> Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={handleSalvarFuncionario} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#0B2341] mb-1">E-mail (Google)</label>
                  <input 
                    type="email" 
                    required 
                    disabled={!!usuarioEmEdicao} 
                    placeholder="email@gmail.com" 
                    value={emailNovo} 
                    onChange={e => setEmailNovo(e.target.value)} 
                    className="block w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 disabled:bg-gray-200 disabled:text-gray-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0B2341] mb-1">CPF do Funcionário</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Apenas números" 
                    value={cpfNovo} 
                    onChange={e => {
                      // Máscara visual simples no input (apenas números)
                      const onlyNums = e.target.value.replace(/\D/g, '');
                      setCpfNovo(onlyNums);
                    }} 
                    maxLength={11}
                    className="block w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" 
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Digite apenas os números do CPF.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#0B2341] mb-1">Cargo / Função</label>
                  <select 
                    value={roleNovo} 
                    onChange={e => setRoleNovo(e.target.value)} 
                    className="block w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none"
                  >
                    <option value="cadastrante">Cadastrante (Emite Carteiras)</option>
                    <option value="motorista">Motorista / Fiscal</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold hover:bg-[#2c4928] transition shadow-md disabled:opacity-50 mt-4 text-lg">
                  {loading ? 'Salvando...' : usuarioEmEdicao ? 'Salvar Alterações' : 'Autorizar Acesso'}
                </button>
              </form>
            </div>

            {/* Tabela de Funcionários */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2 overflow-hidden flex flex-col">
              <h2 className="text-lg font-bold text-[#0B2341] mb-4 border-b pb-3">Funcionários Ativos</h2>
              <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 rounded-t-lg">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">E-mail</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">CPF</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Cargo</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {usuarios.map((u) => (
                      <tr key={u.email} className={`hover:bg-gray-50 transition ${usuarioEmEdicao === u.email ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                          {u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm 
                            ${u.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 
                              u.role === 'motorista' ? 'bg-orange-100 text-orange-800 border border-orange-200' : 
                              'bg-green-100 text-green-800 border border-green-200'}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm flex justify-center gap-2">
                          <button onClick={() => iniciarEdicaoFuncionario(u)} className="text-[#0B2341] hover:text-[#071629] bg-blue-50 p-2 rounded-full transition" title="Editar">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleRemoverFuncionario(u.email)} className="text-gray-400 hover:text-[#890013] bg-gray-100 p-2 rounded-full transition" title="Remover">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA DE ROTAS POR MOTORISTA ================= */}
        {activeTab === 'rotas' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
              <h2 className="text-lg font-bold text-[#0B2341] mb-6 flex items-center border-b pb-3">
                <PlusCircle size={20} className="mr-2 text-[#395D34]" /> Atribuir Rota
              </h2>
              
              {motoristas.length === 0 ? (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm font-medium">
                  Você precisa cadastrar um <strong>Motorista/Fiscal</strong> na aba de Funcionários antes de criar rotas.
                </div>
              ) : (
                <form onSubmit={handleCadastrarRota} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#0B2341] mb-1">Selecione o Motorista/Fiscal</label>
                    <select 
                      required 
                      value={motoristaSelecionado} 
                      onChange={e => setMotoristaSelecionado(e.target.value)} 
                      className="block w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none"
                    >
                      <option value="">Escolha um responsável...</option>
                      {motoristas.map(m => (
                        <option key={m.email} value={m.email}>{m.email}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#0B2341] mb-1">Nome da Rota / Destino</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ex: Rota Recife (Uninassau/UFPE)" 
                      value={nomeRotaNova} 
                      onChange={e => setNomeRotaNova(e.target.value)} 
                      className="block w-full rounded-lg border-gray-300 p-2.5 border focus:border-[#395D34] focus:ring-[#395D34] bg-gray-50 outline-none" 
                    />
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-[#395D34] text-white py-3 rounded-lg font-bold hover:bg-[#2c4928] shadow-md disabled:opacity-50 mt-4 text-lg">
                    {loading ? 'Salvando...' : 'Adicionar Rota'}
                  </button>
                </form>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-[#0B2341] mb-4 border-b pb-3">Rotas Atribuídas</h2>
              <div className="space-y-6">
                {motoristas.map(motorista => {
                  const rotasDoMotorista = rotas.filter(r => r.motorista_email === motorista.email);
                  if (rotasDoMotorista.length === 0) return null;

                  return (
                    <div key={motorista.email} className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-center mb-3 text-[#0B2341] font-bold text-sm">
                        <BusFront size={18} className="mr-2 text-[#395D34]" /> 
                        {motorista.email}
                      </div>
                      <div className="space-y-2">
                        {rotasDoMotorista.map(rota => (
                          <div key={rota.id} className="flex items-center justify-between bg-white border border-gray-200 p-2.5 rounded-lg shadow-sm">
                            <div className="flex items-center text-sm text-gray-800 font-bold">
                              <MapPin size={16} className="text-[#395D34] mr-2" />
                              {rota.nome}
                            </div>
                            <button onClick={() => handleRemoverRota(rota.id, rota.nome)} className="text-gray-400 hover:text-[#890013] p-1 transition">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {rotas.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6 font-medium">Nenhuma rota atribuída ainda.</p>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
// src/routes/index.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Importação das páginas
import Login from '../pages/Login';
import DashboardAdmin from '../pages/Admin/DashboardAdmin';
import CadastroEstudante from '../pages/Cadastro/CadastroEstudante';
import ScannerMotorista from '../pages/Motorista/ScannerMotorista';
import CarteiraDigital from '../pages/Estudante/CarteiraDigital';
import type { JSX } from 'react/jsx-runtime';

// Componente para proteger rotas por nível de acesso
const PrivateRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles: string[] }) => {
  const { user, loading } = useAuth();

  // Se estivermos offline ou com cache de estudante, libera o acesso imediato à carteira sem travar no loading do Firebase
  const temCacheEstudante = Object.keys(localStorage).some(k => k.startsWith('cache_estudante_'));
  if (allowedRoles.includes('estudante') && temCacheEstudante) {
    return children;
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-[#0B2341]">Carregando...</div>;
  if (!user) return <Navigate to="/" />;
  if (!allowedRoles.includes(user.role || '')) return <Navigate to="/unauthorized" />;

  return children;
};

export default function AppRoutes() {
  // Verifica se existe cache de estudante no aparelho logo na abertura
  const temCacheEstudante = Object.keys(localStorage).some(k => k.startsWith('cache_estudante_'));

  return (
    <BrowserRouter>
      <Routes>
        {/* Se já tiver cache de estudante no celular, a rota raiz '/' joga direto para a carteirinha instantaneamente */}
        <Route path="/" element={temCacheEstudante ? <Navigate to="/minha-carteira" replace /> : <Login />} />

        {/* Rotas de Admin */}
        <Route path="/admin" element={
          <PrivateRoute allowedRoles={['admin']}>
            <DashboardAdmin />
          </PrivateRoute>
        } />

        {/* Rotas de Cadastrante (Prefeitura) */}
        <Route path="/cadastro" element={
          <PrivateRoute allowedRoles={['admin', 'cadastrante']}>
            <CadastroEstudante />
          </PrivateRoute>
        } />

        {/* Rotas do Motorista / Fiscal */}
        <Route path="/fiscal" element={
          <PrivateRoute allowedRoles={['admin', 'motorista']}>
            <ScannerMotorista />
          </PrivateRoute>
        } />

        {/* Rotas do Estudante */}
        <Route path="/minha-carteira" element={
          <PrivateRoute allowedRoles={['estudante']}>
            <CarteiraDigital />
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
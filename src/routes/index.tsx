// src/routes/index.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Importação das páginas (Vamos criá-las em seguida)
import Login from '../pages/Login';
import DashboardAdmin from '../pages/Admin/DashboardAdmin';
import CadastroEstudante from '../pages/Cadastro/CadastroEstudante';
import ScannerMotorista from '../pages/Motorista/ScannerMotorista';
import CarteiraDigital from '../pages/Estudante/CarteiraDigital';
import type { JSX } from 'react/jsx-runtime';

// Componente para proteger rotas por nível de acesso
const PrivateRoute = ({ children, allowedRoles }: { children: JSX.Element, allowedRoles: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/" />;
  if (!allowedRoles.includes(user.role || '')) return <Navigate to="/unauthorized" />;

  return children;
};

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

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
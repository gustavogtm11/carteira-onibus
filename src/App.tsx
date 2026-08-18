// src/App.tsx
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import AppRoutes from './routes';
import { Download, X } from 'lucide-react';
import './index.css';

// Componente para o Popup do PWA
function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Intercepta o evento de instalação do PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Verifica se já mostramos hoje para não ser chato
      const lastPrompt = localStorage.getItem('pwaPromptLastShown');
      const today = new Date().toDateString();
      
      if (lastPrompt !== today) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('Usuário aceitou a instalação do PWA');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
    localStorage.setItem('pwaPromptLastShown', new Date().toDateString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-[9998] bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-2 border-[#0B2341] p-4 flex flex-col animate-in slide-in-from-bottom-10 duration-300">
      <button onClick={handleClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">
        <X size={20} />
      </button>
      <div className="flex items-start gap-4 pr-6">
        <div className="bg-[#0B2341] p-3 rounded-xl text-white shrink-0">
          <Download size={24} />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">Instale o App</h3>
          <p className="text-sm text-gray-600 mb-3">Adicione o Passe Livre Estudantil à sua tela inicial para acesso mais rápido e fácil!</p>
          <button 
            onClick={handleInstallClick}
            className="bg-[#395D34] text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-[#2c4928] transition-colors text-sm w-full sm:w-auto"
          >
            Instalar Agora
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <AppRoutes />
        <PwaInstallPrompt />
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
// src/contexts/AlertContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

type AlertType = 'success' | 'error' | 'info';

interface AlertContextData {
  showAlert: (message: string, type?: AlertType) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}

const AlertContext = createContext<AlertContextData>({} as AlertContextData);

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<AlertType>('info');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [onConfirmCallback, setOnConfirmCallback] = useState<() => void>(() => {});

  const showAlert = (message: string, type: AlertType = 'info') => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertOpen(true);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmMessage(message);
    setOnConfirmCallback(() => onConfirm);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    onConfirmCallback();
    setConfirmOpen(false);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      {/* Modal de Alerta Padrão */}
      {alertOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform scale-100 animate-in zoom-in-95 duration-200">
            <div className={`p-4 flex items-center gap-3 text-white ${
              alertType === 'error' ? 'bg-[#890013]' : 
              alertType === 'success' ? 'bg-[#395D34]' : 'bg-[#0B2341]'
            }`}>
              {alertType === 'error' && <AlertCircle size={24} />}
              {alertType === 'success' && <CheckCircle size={24} />}
              {alertType === 'info' && <Info size={24} />}
              <h3 className="font-bold text-lg">Aviso</h3>
              <button onClick={() => setAlertOpen(false)} className="ml-auto text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-gray-700 font-medium text-center">
              {alertMessage}
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-center">
              <button 
                onClick={() => setAlertOpen(false)} 
                className="w-full py-2.5 rounded-xl font-bold text-white transition-colors"
                style={{ backgroundColor: alertType === 'error' ? '#890013' : alertType === 'success' ? '#395D34' : '#0B2341' }}
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 flex items-center gap-3 bg-[#0B2341] text-white">
              <AlertCircle size={24} />
              <h3 className="font-bold text-lg">Confirmação</h3>
            </div>
            <div className="p-6 text-gray-700 font-medium text-center">
              {confirmMessage}
            </div>
            <div className="p-4 bg-gray-50 border-t flex gap-3">
              <button 
                onClick={() => setConfirmOpen(false)} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirm} 
                className="flex-1 py-2.5 rounded-xl font-bold bg-[#890013] text-white hover:bg-[#6b000f] transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
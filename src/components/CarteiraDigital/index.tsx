import { useRef } from 'react';
import { Printer, Smartphone } from 'lucide-react';

// Tipagem com os novos campos (matrícula e instituição dinâmica)
interface Estudante {
  nome: string;
  cpf: string;
  matricula: string;
  instituicao: string;
  curso: string;
  turno: string;
  fotoUrl?: string;
  validade: string;
}

interface CarteiraDigitalProps {
  estudante: Estudante;
}

export default function CarteiraDigital({ estudante }: CarteiraDigitalProps) {
  const carteiraRef = useRef<HTMLDivElement>(null);

  // Função nativa do navegador para imprimir
  // O CSS do Tailwind com 'print:hidden' cuida de esconder o resto da tela
  const handlePrint = () => {
    window.print();
  };

  // Função preparada para futura integração com backend (Google Wallet / Apple Wallet)
  // Por enquanto, podemos implementar a geração de uma imagem usando html2canvas
  const handleDownloadWallet = (tipo: 'google' | 'apple') => {
    alert(`Preparando integração com ${tipo === 'google' ? 'Google Wallet' : 'Apple Wallet'}.\n\nNo futuro, isso fará o download do arquivo .pkpass ou gerará o JWT de adicionar à carteira!`);
    // Aqui entrará a lógica de chamar a API Node.js ou gerar a imagem da carteira
  };

  return (
    <div className="flex flex-col items-center">
      
      {/* Área da Carteirinha - O que será impresso */}
      {/* A classe 'print:m-0 print:shadow-none' remove sombras e margens na impressão */}
      <div 
        ref={carteiraRef}
        className="w-[85.6mm] h-[54mm] bg-white rounded-xl shadow-2xl relative overflow-hidden print:shadow-none print:rounded-none print:w-[85.6mm] print:h-[54mm]"
        style={{ 
          // Proporção padrão de cartão de crédito (ID-1)
          backgroundImage: 'url("/fundo-carteirinha.png")', // Imagem de fundo opcional
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        {/* Faixa superior com as cores da prefeitura */}
        <div className="w-full h-12 bg-gradient-to-r from-[#C00004] to-[#E83F19] flex items-center px-4 justify-between">
          <img src="/logo-branca.png" alt="Prefeitura" className="h-8 object-contain" />
          <span className="text-white font-black text-xs uppercase tracking-wider">Passe Estudantil</span>
        </div>

        <div className="p-3 flex gap-3 h-[calc(100%-3rem)]">
          {/* Foto do Estudante */}
          <div className="w-[25mm] h-[32mm] bg-gray-200 border-2 border-[#E83F19] rounded-md overflow-hidden flex-shrink-0">
            {estudante.fotoUrl ? (
              <img src={estudante.fotoUrl} alt={estudante.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs text-center p-1">
                Sem Foto
              </div>
            )}
          </div>

          {/* Dados do Estudante */}
          <div className="flex flex-col flex-1 justify-between py-1">
            <div>
              <h2 className="text-[10px] font-bold text-gray-800 uppercase leading-tight line-clamp-2">
                {estudante.nome}
              </h2>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
                <div>
                  <span className="text-[6px] text-gray-500 uppercase block">Matrícula</span>
                  <span className="text-[8px] font-bold text-gray-700 block">{estudante.matricula || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[6px] text-gray-500 uppercase block">CPF</span>
                  <span className="text-[8px] font-bold text-gray-700 block">{estudante.cpf}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[6px] text-gray-500 uppercase block">Instituição de Ensino</span>
                  <span className="text-[8px] font-bold text-[#C00004] block leading-tight">{estudante.instituicao}</span>
                </div>
                <div>
                  <span className="text-[6px] text-gray-500 uppercase block">Curso</span>
                  <span className="text-[8px] font-bold text-gray-700 block">{estudante.curso}</span>
                </div>
                <div>
                  <span className="text-[6px] text-gray-500 uppercase block">Validade</span>
                  <span className="text-[8px] font-bold text-gray-700 block">{estudante.validade}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa inferior */}
        <div className="absolute bottom-0 w-full h-2 bg-[#F37021]"></div>
      </div>

      {/* Botões de Ação - A classe 'print:hidden' oculta todos na hora da impressão */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4 print:hidden w-full max-w-md">
        
        {/* Botão de Imprimir */}
        <button 
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-lg shadow transition-colors font-medium text-sm"
        >
          <Printer size={18} className="mr-2" />
          Imprimir / PDF
        </button>

        {/* Botões das Carteiras Digitais */}
        <div className="flex gap-2 flex-1">
          <button 
            onClick={() => handleDownloadWallet('google')}
            className="flex-1 flex items-center justify-center py-2.5 px-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg shadow-sm transition-colors font-medium text-xs group"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/c8/Google_Wallet_Icon_%282022%29.svg" alt="Google Wallet" className="w-5 h-5 mr-1 group-hover:scale-110 transition-transform" />
            Google
          </button>
          
          <button 
            onClick={() => handleDownloadWallet('apple')}
            className="flex-1 flex items-center justify-center py-2.5 px-2 bg-black hover:bg-gray-800 text-white rounded-lg shadow-sm transition-colors font-medium text-xs group"
          >
            <Smartphone size={16} className="mr-1 group-hover:scale-110 transition-transform" />
            Apple
          </button>
        </div>
      </div>

    </div>
  );
}
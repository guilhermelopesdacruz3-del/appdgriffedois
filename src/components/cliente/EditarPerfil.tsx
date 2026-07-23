import { useState } from "react";

interface Props {
  cliente: {
    id?: number;
    nome?: string | null;
    telefone?: string | null;
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
  };
  onVoltar: () => void;
  onSalvar: (dados: {
    nome?: string;
    telefone?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  }) => Promise<void>;
}

export default function EditarPerfil({ cliente, onVoltar, onSalvar }: Props) {
  const [nome, setNome] = useState(cliente.nome || "");
  const [telefone, setTelefone] = useState(cliente.telefone || "");
  const [rua, setRua] = useState(cliente.rua || "");
  const [numero, setNumero] = useState(cliente.numero || "");
  const [bairro, setBairro] = useState(cliente.bairro || "");
  const [cidade, setCidade] = useState(cliente.cidade || "");
  const [estado, setEstado] = useState(cliente.estado || "");
  const [cep, setCep] = useState(cliente.cep || "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    setSalvando(true);
    setSalvo(false);
    setErro(null);
    try {
      await onSalvar({
        nome: nome.trim() ? nome.trim() : undefined,
        telefone: telefone.trim() ? telefone.trim() : undefined,
        rua: rua.trim() ? rua.trim() : undefined,
        numero: numero.trim() ? numero.trim() : undefined,
        bairro: bairro.trim() ? bairro.trim() : undefined,
        cidade: cidade.trim() ? cidade.trim() : undefined,
        estado: estado.trim() ? estado.trim() : undefined,
        cep: cep.trim() ? cep.trim() : undefined,
      });
      setSalvo(true);
      setTimeout(() => onVoltar(), 800);
    } catch (e) {
      setErro((e as Error).message || "Falha ao salvar.");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  const campo = (label: string, value: string, set: (v: string) => void, tipo = "text") => (
    <div>
      <label className="text-[11px] font-semibold text-luxury-black mb-1 block">{label}</label>
      <input
        value={value}
        type={tipo}
        onChange={(e) => set(e.target.value)}
        className="w-full h-11 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
      />
    </div>
  );

  return (
    <div className="px-5 pt-6 pb-4">
      <button
        onClick={onVoltar}
        className="flex items-center gap-1 text-xs font-bold text-luxury-black mb-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>
      <h3 className="text-base font-bold text-luxury-black mb-4">Editar dados</h3>
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        {campo("Nome", nome, setNome)}
        {campo("Telefone", telefone, setTelefone, "tel")}
        <div className="border-t border-gray-100 my-1 pt-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Endereço</p>
        </div>
        {campo("Logradouro (rua)", rua, setRua)}
        {campo("Número", numero, setNumero)}
        {campo("Bairro", bairro, setBairro)}
        {campo("Cidade", cidade, setCidade)}
        {campo("Estado (UF)", estado, setEstado)}
        {campo("CEP", cep, setCep)}
        {erro && <p className="text-[11px] text-red-500">{erro}</p>}
        <button
          onClick={salvar}
          disabled={salvando || (!nome.trim() && !telefone.trim() && !rua.trim())}
          className="w-full h-11 bg-black text-white text-xs font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-all"
        >
          {salvando ? "Salvando..." : salvo ? "Salvo!" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

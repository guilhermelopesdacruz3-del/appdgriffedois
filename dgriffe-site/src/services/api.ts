import type { Product } from '../data/types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://appdgriffedois.onrender.com';

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function listarProdutos(opts: { limit?: number; offset?: number; categoriaId?: number; marcaId?: number; busca?: string } = {}): Promise<{ produtos: Product[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.categoriaId) params.set('categorias', String(opts.categoriaId));
  if (opts.marcaId) params.set('marca', String(opts.marcaId));
  if (opts.busca) params.set('nome__icontains', opts.busca);
  const qs = params.toString();
  const res = await request<{ objects: any[]; meta: { total_count: number } }>(`/api/loja-integrada/produto/${qs ? `?${qs}` : ''}`, { method: 'GET' });

  // Carregar categorias e marcas para resolver nomes (a LI retorna URIs, não nomes)
  const [catsRes, marcasRes] = await Promise.all([
    request<{ objects: any[] }>('/api/loja-integrada/categoria/'),
    request<{ objects: any[] }>('/api/loja-integrada/marca/'),
  ]);
  const categoriasMap = new Map<number, string>();
  for (const c of (catsRes.objects || [])) {
    categoriasMap.set(c.id, c.nome || '');
  }
  const marcasMap = new Map<number, string>();
  for (const m of (marcasRes.objects || [])) {
    marcasMap.set(m.id, m.nome || '');
  }

  const produtos: Product[] = (res.objects || []).map((p: any) => {
    // Formato da LI: imagens é array de objetos { grande, media, icone, pequena, caminho }
    const imagem = p.imagem_principal?.grande || p.imagem_principal?.media || p.imagens?.[0]?.grande || p.imagens?.[0]?.media || '';
    const imagens = (p.imagens || []).map((i: any) => i.grande || i.media || '').filter(Boolean);

    // Resolver nome da categoria a partir do ID (LI retorna URIs)
    const catId = p.categorias?.[0] ? Number(String(p.categorias[0]).split('/').filter(Boolean).pop()) : null;
    const catNome = catId && categoriasMap.has(catId) ? categoriasMap.get(catId)! : (p.categoria_nome || '');

    // Resolver nome da marca a partir do ID (LI retorna URIs)
    const marcaId = p.marca ? Number(String(p.marca).split('/').filter(Boolean).pop()) : null;
    const marcaNome = marcaId && marcasMap.has(marcaId) ? marcasMap.get(marcaId)! : (p.marca_nome || '');

    const ncm = p.ncm || '';
    const isEyewear = ncm.startsWith('9004') || catNome.toLowerCase().includes('sol') || catNome.toLowerCase().includes('grau');

    let nomeLimpo = p.nome || p.apelido || '';
    nomeLimpo = nomeLimpo.replace(/^\/API\/VMARCA\/\d+/i, '').replace(/^\/[A-Z]+-/i, '').replace(/^\/+/, '').trim();
    nomeLimpo = nomeLimpo.replace(/^[A-Z0-9]+-[A-Z0-9]+/i, '').trim();

    return {
      id: p.id,
      name: nomeLimpo,
      brand: marcaNome,
      code: p.sku || String(p.id),
      price: Number(p.preco_cheio || p.preco || 0),
      originalPrice: p.preco_promocional ? Number(p.preco_promocional) : undefined,
      pixPrice: Number(p.preco_pix || p.preco_cheio || 0),
      description: p.descricao_completa || '',
      category: isEyewear ? (catNome || 'Óculos') : (catNome || 'Acessórios'),
      colors: [],
      colorNames: [],
      image: imagem,
      imagens,
      badge: p.badge || '',
      rating: 0,
      reviews: 0,
      installmentCount: 5,
      installmentValue: Number(p.preco_cheio || 0) / 5,
      variacoes: p.variacoes || [],
      tamanhos: p.tamanhos || [],
    };
  });
  return { produtos, total: res.meta?.total_count || produtos.length };
}

export async function buscarProduto(id: number | string): Promise<Product> {
  const p = await request<any>(`/api/loja-integrada/produto/${id}/`);
  const imagem = p.imagem_principal?.grande || p.imagem_principal?.media || p.imagens?.[0]?.grande || p.imagens?.[0]?.media || '';
  const imagens = (p.imagens || []).map((i: any) => i.grande || i.media || '').filter(Boolean);
  const ncm = p.ncm || '';
  const catNome = p.categorias?.[0]?.nome || p.categoria_nome || '';
  const isEyewear = ncm.startsWith('9004') || catNome.toLowerCase().includes('sol') || catNome.toLowerCase().includes('grau');
  let nomeLimpo = p.nome || p.apelido || '';
  nomeLimpo = nomeLimpo.replace(/^\/API\/VMARCA\/\d+/i, '').replace(/^\/[A-Z]+-/i, '').replace(/^\/+/, '').trim();
  nomeLimpo = nomeLimpo.replace(/^[A-Z0-9]+-[A-Z0-9]+/i, '').trim();
  return {
    id: p.id,
    name: nomeLimpo,
    brand: p.marca || p.brand || '',
    code: p.sku || String(p.id),
    price: Number(p.preco_cheio || p.preco || 0),
    originalPrice: p.preco_promocional ? Number(p.preco_promocional) : undefined,
    pixPrice: Number(p.preco_pix || p.preco_cheio || 0),
    description: p.descricao_completa || '',
    category: isEyewear ? (catNome || 'Óculos') : (catNome || 'Acessórios'),
    colors: [],
    colorNames: [],
    image: imagem,
    imagens,
    badge: p.badge || '',
    rating: 0,
    reviews: 0,
    installmentCount: 5,
    installmentValue: Number(p.preco_cheio || 0) / 5,
    variacoes: p.variacoes || [],
    tamanhos: p.tamanhos || [],
  };
}

export async function listarCategorias(): Promise<Array<{ id: number; nome: string; paiId: number | null }>> {
  const res = await request<{ objects: any[] }>('/api/loja-integrada/categoria/');
  return (res.objects || []).map((c: any) => ({
    id: c.id,
    nome: c.nome || '',
    paiId: c.categoria_pai ? Number(String(c.categoria_pai).split('/').filter(Boolean).pop()) : null,
  }));
}

export async function listarMarcas(): Promise<Array<{ id: number; nome: string }>> {
  const res = await request<{ objects: any[] }>('/api/loja-integrada/marca/');
  return (res.objects || []).map((m: any) => ({ id: m.id, nome: m.nome || '' }));
}

// --- Afiliado ---
export async function registrarAfiliado(data: { email: string; nome: string; telefone: string }): Promise<{ ok: boolean; afiliado?: any }> {
  return request('/api/afiliado/registrar', { method: 'POST', body: JSON.stringify(data) });
}

export async function registrarVendaAfiliado(data: { afiliadoEmail: string; produtoNome: string; valor: number }): Promise<{ ok: boolean }> {
  return request('/api/afiliado/venda', { method: 'POST', body: JSON.stringify(data) });
}

// --- Admin ---
export async function listarAfiliados(token: string): Promise<{ afiliados: any[]; stats: any }> {
  return request('/api/admin/afiliados', { headers: { Authorization: `Bearer ${token}` } });
}

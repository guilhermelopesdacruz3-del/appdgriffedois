import type { Product } from '../data/types';
import { getCategoriaNome } from '../data/categoriasMap';
import { API_BASE } from '../config';

// A LI devolve nomes sujos (prefixos de VMARCA, códigos, barras). Este helper
// é a ÚNICA fonte dessa limpeza — usado por listarProdutos e buscarProduto.
function limparNome(nome: string | null | undefined): string {
  return (nome || '')
    .replace(/^\/API\/VMARCA\/\d+/i, '')
    .replace(/^\/[A-Z]+-/i, '')
    .replace(/^\/+/, '')
    .replace(/^[A-Z0-9]+-[A-Z0-9]+/i, '')
    .trim();
}

// A LI devolve as variações de um produto como URIs cruas
// (ex.: /api/v1/grade/32769/variacao/139499). O nome legível ("Masculino")
// vive dentro do objeto da grade. Este helper busca cada grade única e monta
// um mapa URI -> nome da variação. Cache em memória evita rebuscar a mesma grade.
const gradesCache = new Map<number, Map<string, string>>();
async function resolverNomesVariacoes(uris: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!Array.isArray(uris) || uris.length === 0) return out;
  // Extrai os gradeId únicos das URIs
  const gradeIds = [...new Set(
    uris
      .map((u) => {
        const m = String(u).match(/\/grade\/(\d+)\/variacao\//i);
        return m ? Number(m[1]) : null;
      })
      .filter((n): n is number => n !== null)
  )];
  for (const gradeId of gradeIds) {
    let variacoesMap = gradesCache.get(gradeId);
    if (!variacoesMap) {
      try {
        const grade = await request<any>(`/api/loja-integrada/grades/${gradeId}`);
        variacoesMap = new Map<string, string>();
        for (const v of (grade.variacoes || [])) {
          if (v?.resource_uri && v?.nome) variacoesMap.set(v.resource_uri, v.nome);
        }
        gradesCache.set(gradeId, variacoesMap);
      } catch {
        variacoesMap = new Map<string, string>(); // não repete busca em caso de erro
      }
    }
    for (const [uri, nome] of variacoesMap) out.set(uri, nome);
  }
  return out;
}

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

export async function listarProdutos(opts: { limit?: number; offset?: number; categorias?: string; marca?: string; nome__icontains?: string; preco_min?: string; preco_max?: string; ordenacao?: string } = {}): Promise<{ produtos: Product[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  if (opts.categorias) params.set('categorias', String(opts.categorias));
  if (opts.marca) params.set('marca', String(opts.marca));
  if (opts.nome__icontains) params.set('nome__icontains', String(opts.nome__icontains));
  if (opts.preco_min) params.set('preco_min', String(opts.preco_min));
  if (opts.preco_max) params.set('preco_max', String(opts.preco_max));
  if (opts.ordenacao) params.set('ordenacao', String(opts.ordenacao));
  const qs = params.toString();
  const res = await request<{ objects: any[]; meta: { total_count: number } }>(`/api/loja-integrada/produto/${qs ? `?${qs}` : ''}`, { method: 'GET' });

  // Carregar marcas para resolver nomes (a LI retorna URIs, não nomes)
  const marcasRes = await request<{ objects: any[] }>('/api/loja-integrada/marca/');
  const marcasMap = new Map<number, string>();
  for (const m of (marcasRes.objects || [])) {
    marcasMap.set(m.id, m.nome || '');
  }

  // Resolve de uma vez os nomes de TODAS as variações dos produtos da página
  // (cache por grade evita rebuscar a mesma grade entre produtos).
  const todasUris = (res.objects || []).flatMap((p: any) => Array.isArray(p.variacoes) ? p.variacoes : []);
  const nomesVarGlobal = await resolverNomesVariacoes(todasUris);

  const produtos: Product[] = await Promise.all((res.objects || []).map(async (p: any) => {
    // Formato da LI: imagens é array de objetos { grande, media, icone, pequena, caminho }
    const imagem = p.imagem_principal?.grande || p.imagem_principal?.media || p.imagens?.[0]?.grande || p.imagens?.[0]?.media || '';
    const imagens = (p.imagens || []).map((i: any) => i.grande || i.media || '').filter(Boolean);

    // Resolver nome da categoria a partir do ID (LI retorna URIs)
    const catIds = Array.isArray(p.categorias)
      ? p.categorias.map((u: any) => Number(String(u).split('/').filter(Boolean).pop())).filter(Boolean)
      : [];
    const catNomes = catIds.map((id: number) => getCategoriaNome(id)).filter(Boolean);
    const catNome = catNomes.length > 0 ? catNomes.join(', ') : (p.categoria_nome || '');

    // Resolver nome da marca a partir do ID (LI retorna URIs)
    const marcaId = p.marca ? Number(String(p.marca).split('/').filter(Boolean).pop()) : null;
    const marcaNome = marcaId && marcasMap.has(marcaId) ? marcasMap.get(marcaId)! : (p.marca_nome || '');

    const ncm = p.ncm || '';
    const isEyewear = ncm.startsWith('9004') || catNome.toLowerCase().includes('sol') || catNome.toLowerCase().includes('grau');

    let nomeLimpo = limparNome(p.nome || p.apelido);

    // Variações: URIs -> nomes legíveis (ex.: "Masculino")
    const variacoesUris: string[] = Array.isArray(p.variacoes) ? p.variacoes : [];
    const variacoesNomes = variacoesUris.map((u: string) => nomesVarGlobal.get(u) || u);

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
      catIds,
      colors: [],
      colorNames: [],
      image: imagem,
      imagens,
      badge: p.badge || '',
      rating: 0,
      reviews: 0,
      installmentCount: 5,
      installmentValue: Number(p.preco_cheio || 0) / 5,
      variacoes: variacoesNomes.length > 0 ? variacoesNomes : (p.variacoes || []),
      tamanhos: p.tamanhos || [],
    };
  }));
  return { produtos, total: res.meta?.total_count || produtos.length };
}

export async function buscarProduto(id: number | string): Promise<Product> {
  const p = await request<any>(`/api/loja-integrada/produto/${id}/`);
  const imagem = p.imagem_principal?.grande || p.imagem_principal?.media || p.imagens?.[0]?.grande || p.imagens?.[0]?.media || '';
  const imagens = (p.imagens || []).map((i: any) => i.grande || i.media || '').filter(Boolean);
  const ncm = p.ncm || '';
  const catNome = p.categorias?.[0]?.nome || p.categoria_nome || '';
  const isEyewear = ncm.startsWith('9004') || catNome.toLowerCase().includes('sol') || catNome.toLowerCase().includes('grau');
  let nomeLimpo = limparNome(p.nome || p.apelido);
  // Resolve URIs de variação -> nomes legíveis (ex.: "Masculino")
  const variacoesUris: string[] = Array.isArray(p.variacoes) ? p.variacoes : [];
  const nomesVar = await resolverNomesVariacoes(variacoesUris);
  const variacoesNomes = variacoesUris.map((u: string) => nomesVar.get(u) || u);
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
    variacoes: variacoesNomes.length > 0 ? variacoesNomes : (p.variacoes || []),
    tamanhos: p.tamanhos || [],
  };
}

export async function listarCategorias(): Promise<Array<{ id: number; nome: string; paiId: number | null }>> {
  const res = await request<{ objects: any[] }>('/api/loja-integrada/categoria/');
  return (res.objects || []).map((c: any) => ({
    id: c.id,
    nome: getCategoriaNome(c.id),
    paiId: c.categoria_pai ? Number(String(c.categoria_pai).split('/').filter(Boolean).pop()) : null,
  }));
}

export async function listarMarcas(): Promise<Array<{ id: number; nome: string }>> {
  const res = await request<{ objects: any[] }>('/api/loja-integrada/marca/');
  return (res.objects || []).map((m: any) => ({ id: m.id, nome: m.nome || '' }));
}

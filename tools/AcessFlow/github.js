import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * Busca na API do GitHub por Issues ou PRs relacionados a uma determinada regra ou descrição de erro.
 */
export async function buscarGitHub(repo, ruleId, description, token = null) {
  const githubRepo = repo || process.env.GITHUB_REPO;
  const githubToken = token || process.env.GITHUB_TOKEN;

  if (!githubRepo || !githubRepo.includes('/')) return [];

  const query = `${ruleId} OR "${description.slice(0, 30)}"`;
  const url = `https://api.github.com/search/issues?q=repo:${githubRepo}+${encodeURIComponent(query)}`;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AcessFlow-WCAG-Checker',
  };
  if (githubToken) headers['Authorization'] = `token ${githubToken}`;

  try {
    const res = await fetch(url, { headers });
    if (res.status === 403) {
      console.warn(
        `[GitHub Warning] Rate limit excedido ou acesso negado (Status 403) ao buscar por "${ruleId}".`,
      );
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.items) return [];

    return data.items.slice(0, 3).map((item) => ({
      numero: item.number,
      titulo: item.title,
      link: item.html_url,
      estado: item.state === 'open' ? 'Aberto' : 'Fechado',
      tipo: item.pull_request ? 'Pull Request' : 'Issue',
      atualizadoEm: new Date(item.updated_at).toLocaleDateString('pt-BR'),
    }));
  } catch (error) {
    console.error(
      `[GitHub Error] Falha ao conectar ao GitHub: ${error.message}`,
    );
    return [];
  }
}

/**
 * Cria uma Issue no GitHub para uma violação WCAG encontrada.
 */
export async function criarIssueGitHub(repo, erro, token = null) {
  const githubToken = token || process.env.GITHUB_TOKEN;
  if (!githubToken) throw new Error('GITHUB_TOKEN não configurado.');

  const titulo = `[WCAG] ${erro.regra.toUpperCase()} - Linha ${erro.linha}`;

  const corpo = `
## Violação de Acessibilidade WCAG

**Arquivo**
\`${erro.arquivo}\`

**Linha**
${erro.linha}

**Regra**
${erro.regra}

**Severidade**
${erro.severidade}

**Descrição**
${erro.descricao}

**Trecho de Código**
\`\`\`html
${erro.trecho}
\`\`\`

**Como Corrigir**
${erro.sugestao}

**Referência**
${erro.solucaoLink || 'N/A'}
`;

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'AcessFlow-WCAG-Checker',
    },
    body: JSON.stringify({
      title: titulo,
      body: corpo,
      labels: ['wcag', 'acessibilidade'],
    }),
  });

  if (!response.ok) {
    const erroApi = await response.text();
    throw new Error(`Falha ao criar Issue (${response.status}): ${erroApi}`);
  }

  return await response.json();
}

/**
 * Busca todas as issues abertas criadas pelo WCAG checker no repositório.
 * Identifica pelo prefixo [WCAG] no título.
 * @param {string} repo - Repositório no formato "dono/repo"
 * @param {string} token - Token do GitHub
 * @returns {Promise<Array>} Lista de issues abertas com número, título e metadados extraídos
 */
export async function buscarIssuesWcagAbertas(repo, token = null) {
  const githubToken = token || process.env.GITHUB_TOKEN;
  const githubRepo = repo || process.env.GITHUB_REPO;

  if (!githubRepo || !githubToken) return [];

  const issues = [];
  let page = 1;

  // Pagina até buscar todas as issues abertas com label wcag
  while (true) {
    const url = `https://api.github.com/repos/${githubRepo}/issues?state=open&labels=wcag&per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'AcessFlow-WCAG-Checker',
      },
    });

    if (!res.ok) {
      console.error(
        `[GitHub Error] Falha ao buscar issues abertas (${res.status})`,
      );
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    // Filtra apenas issues (não PRs) com prefixo [WCAG]
    for (const item of data) {
      if (!item.pull_request && item.title.startsWith('[WCAG]')) {
        issues.push(item);
      }
    }

    // Se retornou menos de 100, não há mais páginas
    if (data.length < 100) break;
    page++;
  }

  return issues;
}

/**
 * Fecha uma issue no GitHub adicionando um comentário explicativo.
 * @param {string} repo - Repositório no formato "dono/repo"
 * @param {number} issueNumber - Número da issue a fechar
 * @param {string} token - Token do GitHub
 */
export async function fecharIssueGitHub(repo, issueNumber, token = null) {
  const githubToken = token || process.env.GITHUB_TOKEN;
  const githubRepo = repo || process.env.GITHUB_REPO;

  // Adiciona comentário antes de fechar
  await fetch(
    `https://api.github.com/repos/${githubRepo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AcessFlow-WCAG-Checker',
      },
      body: JSON.stringify({
        body: '✅ **Violação resolvida automaticamente.**\n\nA análise estática WCAG não detectou mais este problema no código. Issue fechada pelo AcessFlow WCAG Checker.',
      }),
    },
  );

  // Fecha a issue
  const res = await fetch(
    `https://api.github.com/repos/${githubRepo}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AcessFlow-WCAG-Checker',
      },
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    },
  );

  if (!res.ok) {
    const erroApi = await res.text();
    throw new Error(
      `Falha ao fechar Issue #${issueNumber} (${res.status}): ${erroApi}`,
    );
  }

  return await res.json();
}

/**
 * Normaliza caminhos de forma consistente entre plataformas (Windows, WSL, Linux).
 * Converte barras invertidas para normais, remove barra final e normaliza letras de unidade e prefixos do WSL (/mnt/c/ -> c:/).
 */
export function normalizarCaminhoConsistente(caminho) {
  if (!caminho || typeof caminho !== 'string') return '';

  // 1. Substitui barras invertidas por barras normais
  let norm = caminho.replace(/\\/g, '/');

  // 2. Converte caminhos WSL (/mnt/c/...) para formato de unidade (c:/...)
  const wslMatch = norm.match(/^\/mnt\/([a-zA-Z])(\/|$)/);
  if (wslMatch) {
    const drive = wslMatch[1].toLowerCase();
    norm = norm.replace(/^\/mnt\/[a-zA-Z]/, `${drive}:`);
  }

  // 3. Converte a letra do drive para minúscula de forma consistente (ex: C:/ -> c:/)
  const driveMatch = norm.match(/^([a-zA-Z]):/);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    norm = drive + norm.slice(1);
  }

  // 4. Remove barra no final para consistência
  if (norm.endsWith('/') && norm.length > 3) {
    norm = norm.slice(0, -1);
  }

  return norm;
}

/**
 * Compara os erros atuais com as issues abertas e fecha **apenas as issues
 * que pertencem ao escopo escaneado** e que não aparecem mais como erro.
 *
 * ⚠️ REGRA DE ESCOPO — evita fechar issues de arquivos não escaneados:
 *   - Se `escopoEscaneado` for um arquivo → só fecha issues daquele arquivo
 *   - Se `escopoEscaneado` for um diretório → só fecha issues de arquivos
 *     contidos dentro daquele diretório (recursivamente)
 *   - Se `escopoEscaneado` for omitido → comportamento conservador:
 *     não fecha nenhuma issue (evita falso positivo)
 *
 * @param {string} repo              - Repositório no formato "dono/repo"
 * @param {Array}  errosAtuais       - Lista de erros encontrados na análise atual
 * @param {string} [token]           - Token do GitHub
 * @param {string} [escopoEscaneado] - Caminho absoluto do arquivo ou diretório escaneado
 */
export async function fecharIssuesResolvidas(
  repo,
  errosAtuais,
  token = null,
  escopoEscaneado = null,
) {
  const githubToken = token || process.env.GITHUB_TOKEN;

  // Sem escopo definido → não fecha nada (comportamento seguro)
  if (!escopoEscaneado) {
    console.log(
      '[GitHub] Escopo de escaneamento não informado — nenhuma issue será fechada automaticamente.',
    );
    return;
  }

  console.log('\n[GitHub] Verificando issues resolvidas...');
  console.log(`[GitHub] Escopo: ${escopoEscaneado}`);

  const issuesAbertas = await buscarIssuesWcagAbertas(repo, githubToken);
  if (issuesAbertas.length === 0) {
    console.log('[GitHub] Nenhuma issue WCAG aberta encontrada.');
    return;
  }

  console.log(
    `[GitHub] ${issuesAbertas.length} issue(s) WCAG abertas encontradas.`,
  );

  // Normaliza o escopo para comparação consistente entre OS e WSL
  const escopoNorm = normalizarCaminhoConsistente(escopoEscaneado);
  const escopoEhDiretorio = (() => {
    try {
      return fs.statSync(escopoEscaneado).isDirectory();
    } catch (_) {
      return false;
    }
  })();

  // Monta um Set com as chaves dos erros atuais (normalizados)
  const chavesErrosAtuais = new Set(
    errosAtuais.map(
      (e) =>
        `${e.regra}||${normalizarCaminhoConsistente(e.arquivo)}||${e.linha}`,
    ),
  );

  let ignoradas = 0;
  let fechadas = 0;

  for (const issue of issuesAbertas) {
    // Extrai regra e linha do título: "[WCAG] IMAGE-ALT - Linha 11"
    const matchTitulo = issue.title.match(
      /^\[WCAG\]\s+([A-Z0-9-]+)\s+-\s+Linha\s+(\d+)/i,
    );
    if (!matchTitulo) continue;

    const regra = matchTitulo[1].toLowerCase();
    const linha = matchTitulo[2];

    // Extrai arquivo do corpo da issue
    const matchArquivo =
      issue.body && issue.body.match(/\*\*Arquivo\*\*\s*\n`([^`]+)`/);
    if (!matchArquivo) continue;

    const arquivoIssueNorm = normalizarCaminhoConsistente(matchArquivo[1]);

    // ─── VERIFICAÇÃO DE ESCOPO ───────────────────────────────────────────────
    let dentroDoEscopo;
    if (escopoEhDiretorio) {
      // Escaneou um diretório: o arquivo da issue deve estar contido nele
      dentroDoEscopo =
        arquivoIssueNorm.startsWith(escopoNorm + '/') ||
        arquivoIssueNorm === escopoNorm;
    } else {
      // Escaneou um único arquivo: os caminhos devem ser idênticos
      dentroDoEscopo = arquivoIssueNorm === escopoNorm;
    }

    if (!dentroDoEscopo) {
      ignoradas++;
      continue; // ← Esta issue pertence a outro arquivo/diretório; não tocar nela
    }
    // ─────────────────────────────────────────────────────────────────────────

    const chave = `${regra}||${arquivoIssueNorm}||${linha}`;

    if (!chavesErrosAtuais.has(chave)) {
      // O arquivo foi escaneado e o erro não existe mais → fechar
      try {
        await fecharIssueGitHub(repo, issue.number, githubToken);
        console.log(`[Issue Fechada] #${issue.number} - ${issue.title}`);
        fechadas++;
      } catch (e) {
        console.error(
          `[GitHub Error] Falha ao fechar #${issue.number}: ${e.message}`,
        );
      }
    }
  }

  if (ignoradas > 0) {
    console.log(
      `[GitHub] ${ignoradas} issue(s) ignoradas (fora do escopo escaneado — não foram tocadas).`,
    );
  }

  if (fechadas === 0) {
    console.log(
      '[GitHub] Nenhuma issue para fechar — todos os problemas do escopo ainda existem.',
    );
  } else {
    console.log(
      `[GitHub] ${fechadas} issue(s) fechada(s) por resolução dentro do escopo.`,
    );
  }
}

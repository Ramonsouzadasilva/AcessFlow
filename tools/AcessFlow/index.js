import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { analisarHtmlPhp } from './parser.js';
import { analisarJsJsxTsx } from './js-parser.js';
import {
  buscarGitHub,
  criarIssueGitHub,
  fecharIssuesResolvidas,
  buscarIssuesWcagAbertas,
  normalizarCaminhoConsistente,
} from './github.js';

// Carrega o .env de tools/AcessFlow/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// Listagem Recursiva de Arquivos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Varre um diretório recursivamente buscando arquivos suportados.
 * Ignora pastas como node_modules, .git, dist, build, .gemini, tools.
 * @param {string} dir - Diretório a ser mapeado
 * @param {string[]} [lista] - Lista acumuladora
 * @returns {string[]} Lista de caminhos absolutos dos arquivos
 */
export function obterArquivosRecursivo(dir, lista = []) {
  try {
    const itens = fs.readdirSync(dir);
    for (const item of itens) {
      const caminhoCompleto = path.join(dir, item);
      let stat;
      try {
        stat = fs.statSync(caminhoCompleto);
      } catch (e) {
        continue; // Pula se houver erro de permissão
      }

      if (stat.isDirectory()) {
        const nomeDir = path.basename(caminhoCompleto);
        if (
          ![
            'node_modules',
            '.git',
            'dist',
            'build',
            '.gemini',
            'tools',
          ].includes(nomeDir)
        ) {
          obterArquivosRecursivo(caminhoCompleto, lista);
        }
      } else {
        const ext = path.extname(item).toLowerCase();
        if (['.html', '.php', '.js', '.jsx', '.tsx'].includes(ext)) {
          lista.push(caminhoCompleto);
        }
      }
    }
  } catch (error) {
    console.error(`Erro ao ler diretório ${dir}: ${error.message}`);
  }
  return lista;
}

// ─────────────────────────────────────────────────────────────────────────────
// Análise por Arquivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analisa a acessibilidade de um único arquivo baseado na sua extensão.
 * @param {string} filePath - Caminho absoluto do arquivo
 * @returns {Promise<Array>} Erros de acessibilidade encontrados
 */
export async function analisarArquivo(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.html', '.php'].includes(ext)) return await analisarHtmlPhp(filePath);
  if (['.js', '.jsx', '.tsx'].includes(ext))
    return await analisarJsJsxTsx(filePath);
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Análise de Diretório
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analisa todos os arquivos de um diretório e opcionalmente consulta o GitHub.
 * @param {string} dirPath - Caminho da pasta
 * @param {{ githubRepo?: string, githubToken?: string }} [opcoes]
 * @returns {Promise<Array>} Lista agregada de erros
 */
export async function analisarDiretorio(dirPath, opcoes = {}) {
  const arquivos = obterArquivosRecursivo(dirPath);
  let todosErros = [];

  for (const arq of arquivos) {
    const erros = await analisarArquivo(arq);
    todosErros = todosErros.concat(erros);
  }

  if (opcoes.githubRepo && todosErros.length > 0) {
    console.log(
      `\n[GitHub] Pesquisando Issues/PRs para o repositório ${opcoes.githubRepo}...`,
    );
    const cacheGithub = new Map();
    for (const erro of todosErros) {
      if (!cacheGithub.has(erro.regra)) {
        const itens = await buscarGitHub(
          opcoes.githubRepo,
          erro.regra,
          erro.descricao,
          opcoes.githubToken,
        );
        cacheGithub.set(erro.regra, itens);
      }
      erro.githubRefs = cacheGithub.get(erro.regra);
    }
  }

  return todosErros;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geração de Relatório TXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Salva o relatório de erros em um arquivo de texto formatado.
 * @param {Array} erros - Lista de erros
 * @param {string} outputPath - Caminho do arquivo de saída
 * @returns {string} Conteúdo do relatório gerado
 */
export function salvarRelatorio(erros, outputPath) {
  // Garante que o diretório de saída existe (importante em CI)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let relatorio = `======================================================================
RELATÓRIO DE ACESSIBILIDADE WCAG (ANÁLISE ESTÁTICA)
Gerado em: ${new Date().toLocaleString('pt-BR')}
Total de erros encontrados: ${erros.length}
======================================================================\n\n`;

  if (erros.length === 0) {
    relatorio +=
      'Nenhum erro de acessibilidade WCAG foi detectado no escopo analisado! Parabéns!\n';
  } else {
    const errosPorArquivo = {};
    for (const erro of erros) {
      if (!errosPorArquivo[erro.arquivo]) errosPorArquivo[erro.arquivo] = [];
      errosPorArquivo[erro.arquivo].push(erro);
    }

    for (const [arquivo, lista] of Object.entries(errosPorArquivo)) {
      relatorio += `======================================================================\n`;
      // path.normalize garante separadores corretos para o OS atual
      relatorio += `ARQUIVO: ${path.normalize(arquivo)}\n`;
      relatorio += `======================================================================\n\n`;

      for (const erro of lista) {
        relatorio += `  [LINHA ${erro.linha}] Erro: ${erro.regra.toUpperCase()} (${(erro.severidade || 'indefinida').toUpperCase()})\n`;
        relatorio += `  Descrição: ${erro.descricao}\n`;
        if (erro.trecho)
          relatorio += `  Código do Elemento: ${erro.trecho.trim()}\n`;
        relatorio += `  Como Corrigir: ${erro.sugestao}\n`;
        if (erro.solucaoLink)
          relatorio += `  Mais informações: ${erro.solucaoLink}\n`;
        if (erro.githubRefs && erro.githubRefs.length > 0) {
          relatorio += `  Referências do GitHub encontradas:\n`;
          for (const item of erro.githubRefs) {
            relatorio += `    - [${item.tipo} #${item.numero}] ${item.titulo} (${item.estado}) - ${item.link}\n`;
          }
        }
        relatorio += `  --------------------------------------------------------------------\n\n`;
      }
    }
  }

  fs.writeFileSync(outputPath, relatorio, 'utf-8');
  return relatorio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integração GitHub — Issues Abertas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna um Set com as chaves "regra||arquivo||linha" das issues WCAG abertas.
 * Usado para evitar criar issues duplicadas.
 */
async function obterChavesIssuesAbertas(githubRepo, githubToken) {
  const issuesAbertas = await buscarIssuesWcagAbertas(githubRepo, githubToken);
  const chaves = new Set();

  for (const issue of issuesAbertas) {
    const matchTitulo = issue.title.match(
      /^\[WCAG\]\s+([A-Z0-9-]+)\s+-\s+Linha\s+(\d+)/i,
    );
    const matchArquivo =
      issue.body && issue.body.match(/\*\*Arquivo\*\*\s*\n`([^`]+)`/);
    if (!matchTitulo || !matchArquivo) continue;

    const regra = matchTitulo[1].toLowerCase();
    const linha = matchTitulo[2];
    const arquivo = normalizarCaminhoConsistente(matchArquivo[1]);
    chaves.add(`${regra}||${arquivo}||${linha}`);
  }

  return chaves;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — Execução Direta
// ─────────────────────────────────────────────────────────────────────────────

async function runCLI() {
  const args = process.argv.slice(2);

  const isDirect =
    process.argv[1] &&
    (process.argv[1].endsWith('index.js') ||
      process.argv[1].endsWith('AcessFlow') ||
      process.argv[1].includes('AcessFlow/index.js') ||
      process.argv[1].includes('AcessFlow\\index.js') ||
      process.argv[1].endsWith('acessflow') ||
      process.argv[1].endsWith('acessflow.exe'));

  if (isDirect && args.length > 0) {
    let targetPath = '';
    let githubRepo = process.env.GITHUB_REPO || '';
    let githubToken = process.env.GITHUB_TOKEN || '';
    let outputFile = path.join(process.cwd(), 'erros_acessflow.txt');

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--path' || args[i] === '-p') targetPath = args[++i];
      else if (args[i] === '--github-repo' || args[i] === '-g')
        githubRepo = args[++i];
      else if (args[i] === '--github-token' || args[i] === '-t')
        githubToken = args[++i];
      else if (args[i] === '--output' || args[i] === '-o')
        outputFile = args[++i];
      else if (!targetPath) targetPath = args[i];
    }

    if (!targetPath) {
      console.log(`Uso do AcessFlow CLI:
  node index.js <caminho_da_pasta_ou_arquivo> [opções]

Opções:
  --path, -p          Diretório ou arquivo a ser verificado
  --output, -o        Caminho do arquivo TXT de saída (padrão: erros_acessflow.txt)
  --github-repo, -g   Repositório GitHub (formato "dono/repo") para buscar PRs/Issues
  --github-token, -t  Token do GitHub (opcional) para evitar rate limits`);
      process.exit(0);
    }

    // Normaliza barras invertidas (suporte a caminhos Windows no WSL/Linux)
    const absPath = path.resolve(targetPath.replace(/\\/g, '/'));

    if (!fs.existsSync(absPath)) {
      console.error(`Erro: O caminho especificado não existe: ${absPath}`);
      process.exit(1);
    }

    if (!githubToken) {
      console.log(`[AcessFlow] GITHUB_TOKEN não configurado. A verificação de acessibilidade será executada localmente e o relatório TXT será gerado.`);
    }

    console.log(`[AcessFlow] Analisando acessibilidade WCAG em: ${absPath}...`);

    let erros = [];
    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      erros = await analisarDiretorio(absPath, { githubRepo, githubToken });
    } else {
      erros = await analisarArquivo(absPath);
      if (githubRepo && erros.length > 0) {
        console.log(
          `\n[GitHub] Pesquisando Issues/PRs para o repositório ${githubRepo}...`,
        );
        const cache = new Map();
        for (const erro of erros) {
          if (!cache.has(erro.regra)) {
            cache.set(
              erro.regra,
              await buscarGitHub(
                githubRepo,
                erro.regra,
                erro.descricao,
                githubToken,
              ),
            );
          }
          erro.githubRefs = cache.get(erro.regra);
        }
      }
    }

    salvarRelatorio(erros, outputFile);
    console.log(`\nAnálise Concluída!`);
    console.log(`Erros encontrados: ${erros.length}`);
    console.log(`Relatório salvo em: ${outputFile}`);

    if (githubRepo && githubToken) {
      await fecharIssuesResolvidas(githubRepo, erros, githubToken, absPath);

      if (erros.length > 0) {
        console.log('\n[GitHub] Criando Issues...');
        const chavesExistentes = await obterChavesIssuesAbertas(
          githubRepo,
          githubToken,
        );

        for (const erro of erros) {
          const chave = `${erro.regra}||${normalizarCaminhoConsistente(erro.arquivo)}||${erro.linha}`;
          if (chavesExistentes.has(chave)) {
            console.log(
              `[Issue Ignorada] Já existe issue aberta para ${erro.regra} em linha ${erro.linha}`,
            );
            continue;
          }
          try {
            const issue = await criarIssueGitHub(githubRepo, erro, githubToken);
            console.log(`[Issue Criada] #${issue.number} - ${issue.title}`);
          } catch (e) {
            console.error(`[GitHub Error] ${erro.regra}: ${e.message}`);
          }
        }
      }
    }
  }
}

runCLI().catch((err) => {
  console.error('Erro fatal na execução da CLI do Static Analyzer:', err);
});

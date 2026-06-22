/**
 * ci.js — Script de Integração Contínua do Static Analyzer
 *
 * Diferente do index.js interativo (CLI), este script:
 *  - Carrega variáveis de ambiente do .env (útil para CI local / dev)
 *  - Recebe o caminho via argv ou variável de ambiente CI_SCAN_PATH
 *  - Imprime os erros em formato JSON (para o workflow processar)
 *  - Imprime um resumo legível no stdout (aparece nos logs do GitHub Actions)
 *  - Sai com código 1 se houver erros WCAG de nível crítico ou sério (bloqueia o merge)
 *  - Sai com código 0 se não houver erros ou apenas advertências leves
 */

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import process from 'process';
import dotenv from 'dotenv';

// Carrega o .env de tools/AcessFlow/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { analisarDiretorio, analisarArquivo, salvarRelatorio } from './index.js';

// Severidades que bloqueiam o merge
const SEVERIDADES_BLOQUEANTES = ['critical', 'serious'];

async function runCI() {
  const targetPath = process.argv[2] || process.env.CI_SCAN_PATH || '.';
  const outputJson = process.env.CI_OUTPUT_JSON || path.join(process.cwd(), 'ci_accessibility_report.json');
  const outputTxt  = process.env.CI_OUTPUT_TXT  || path.join(process.cwd(), 'erros_acessflow.txt');

  // Normaliza o caminho de entrada (suporta barras invertidas do Windows)
  const absPath = path.resolve(targetPath.replace(/\\/g, '/'));

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('  ACESSFLOW — Verificação de Acessibilidade (CI)');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Escaneando : ${absPath}`);
  console.log(`  Plataforma : ${process.platform}`);
  console.log(`  Node.js    : ${process.version}`);
  console.log('');

  if (!fs.existsSync(absPath)) {
    console.error(`[ERRO] Caminho não encontrado: ${absPath}`);
    process.exit(1);
  }

  let erros = [];
  const stat = fs.statSync(absPath);

  if (stat.isDirectory()) {
    erros = await analisarDiretorio(absPath);
  } else {
    erros = await analisarArquivo(absPath);
  }

  // Garante que o diretório de saída existe
  fs.mkdirSync(path.dirname(outputTxt),  { recursive: true });
  fs.mkdirSync(path.dirname(outputJson), { recursive: true });

  // Salva relatórios
  salvarRelatorio(erros, outputTxt);
  fs.writeFileSync(outputJson, JSON.stringify(erros, null, 2), 'utf-8');

  // Filtra erros bloqueantes
  const errosBloqueantes = erros.filter(e =>
    SEVERIDADES_BLOQUEANTES.includes((e.severidade || '').toLowerCase())
  );

  if (erros.length === 0) {
    console.log('✅ Nenhum erro de acessibilidade WCAG encontrado!');
    console.log('');
    process.exit(0);
  }

  // Agrupa por arquivo para log organizado
  const porArquivo = {};
  for (const erro of erros) {
    // Exibe o caminho relativo ao diretório escaneado
    const chave = stat.isDirectory()
      ? path.relative(absPath, erro.arquivo || erro.url || 'desconhecido')
      : path.basename(erro.arquivo || erro.url || 'desconhecido');

    if (!porArquivo[chave]) porArquivo[chave] = [];
    porArquivo[chave].push(erro);
  }

  for (const [arquivo, lista] of Object.entries(porArquivo)) {
    console.log(`📄 ${arquivo}`);
    for (const erro of lista) {
      const icon = SEVERIDADES_BLOQUEANTES.includes((erro.severidade || '').toLowerCase()) ? '❌' : '⚠️';
      console.log(`   ${icon} [Linha ${erro.linha}] ${erro.regra.toUpperCase()} (${erro.severidade})`);
      console.log(`      → ${erro.descricao}`);
      console.log(`      💡 ${erro.sugestao}`);
    }
    console.log('');
  }

  console.log('════════════════════════════════════════════════════════');
  console.log(`  Total de erros encontrados : ${erros.length}`);
  console.log(`  Erros bloqueantes (CI/CD)  : ${errosBloqueantes.length}`);
  console.log(`  Relatório TXT              : ${outputTxt}`);
  console.log(`  Relatório JSON             : ${outputJson}`);
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  if (errosBloqueantes.length > 0) {
    console.error(`🚫 Deploy bloqueado: ${errosBloqueantes.length} erro(s) crítico(s)/sério(s) encontrado(s).`);
    console.error('   Corrija os problemas acima antes de fazer merge.');
    process.exit(1);
  } else {
    console.log('⚠️  Apenas erros leves (moderate/minor) encontrados. Deploy não bloqueado.');
    process.exit(0);
  }
}

runCI().catch(err => {
  console.error('[CI FATAL]', err.message);
  process.exit(1);
});

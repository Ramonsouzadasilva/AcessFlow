// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import { JSDOM } from 'jsdom';

// /**
//  * Localiza a biblioteca axe.min.js no ambiente local.
//  * @returns {string} Caminho absoluto para o axe.min.js
//  */
// function obterCaminhoAxe() {
//   const currentDir = path.dirname(fileURLToPath(import.meta.url));
//   const tentativas = [
//     path.join(currentDir, 'node_modules/axe-core/axe.min.js'),
//     path.join(currentDir, '../node_modules/axe-core/axe.min.js'),
//     path.join(process.cwd(), 'node_modules/axe-core/axe.min.js'),
//     path.join(process.cwd(), 'tools/AcessFlow/node_modules/axe-core/axe.min.js')
//   ];

//   for (const p of tentativas) {
//     if (fs.existsSync(p)) {
//       return p;
//     }
//   }
//   throw new Error("Biblioteca axe-core (axe.min.js) não foi localizada. Execute 'npm install'.");
// }

// /**
//  * Remove tags PHP (<?php ... ?> e <?= ... ?>) substituindo por espaços em branco
//  * e preservando novas linhas para manter os números de linha alinhados.
//  * @param {string} content - Conteúdo original do arquivo PHP/HTML
//  * @returns {string} Conteúdo limpo apenas com HTML e placeholders
//  */
// export function limparCodigoPhp(content) {
//   return content.replace(/<\?php([\s\S]*?)\?>/gi, (match) => {
//     return match.split('').map(char => char === '\n' ? '\n' : ' ').join('');
//   }).replace(/<\?=([\s\S]*?)\?>/gi, (match) => {
//     return match.split('').map(char => char === '\n' ? '\n' : ' ').join('');
//   });
// }

// /**
//  * Executa análise de acessibilidade em um arquivo HTML ou PHP.
//  * @param {string} filePath - Caminho do arquivo a ser analisado
//  * @returns {Promise<Array>} Lista de erros encontrados com linha, severidade e sugestões
//  */
// export async function analisarHtmlPhp(filePath) {
//   try {
//     let rawContent = fs.readFileSync(filePath, 'utf-8');
//     const isPhp = filePath.endsWith('.php');

//     // Se for PHP, limpamos as tags para não confundir o parser HTML, mantendo as linhas
//     const htmlContent = isPhp ? limparCodigoPhp(rawContent) : rawContent;

//     const axeScriptPath = obterCaminhoAxe();
//     const axeCode = fs.readFileSync(axeScriptPath, 'utf-8');

//     // Inicializa o JSDOM com suporte a localização de nós e execução de scripts internos
//     const dom = new JSDOM(htmlContent, {
//       includeNodeLocations: true,
//       runScripts: "dangerously"
//     });

//     const { window } = dom;

//     // Injeta o axe-core avaliando o código na sandbox do JSDOM
//     window.eval(axeCode);

//     // Executa a análise WCAG na sandbox do JSDOM
//     const results = await window.axe.run(window.document, {
//       runOnly: {
//         type: 'tag',
//         values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
//       }
//     });

//     const erros = [];

//     // Mapeia os erros encontrados de volta para as linhas do arquivo original
//     for (const violation of results.violations) {
//       for (const nodeResult of violation.nodes) {
//         // Encontra o elemento no DOM para extrair a localização original da tag
//         const selector = nodeResult.target.join(' ');
//         const element = window.document.querySelector(selector);

//         let linha = 1;
//         let trechoHtml = nodeResult.html;

//         if (element) {
//           const location = dom.nodeLocation(element);
//           if (location) {
//             linha = location.startLine;
//           }
//         } else {
//           // Fallback se não achar pelo seletor
//           const index = rawContent.indexOf(trechoHtml);
//           if (index !== -1) {
//             linha = rawContent.substring(0, index).split('\n').length;
//           }
//         }

//         erros.push({
//           arquivo: filePath,
//           linha,
//           regra: violation.id,
//           descricao: violation.description,
//           severidade: violation.impact,
//           trecho: trechoHtml,
//           sugestao: `${violation.help}. Solução sugerida: ${nodeResult.failureSummary || 'Corrigir marcação HTML.'}`,
//           solucaoLink: violation.helpUrl
//         });
//       }
//     }

//     return erros.sort((a, b) => a.linha - b.linha);

//   } catch (error) {
//     console.error(`Erro ao analisar arquivo HTML/PHP (${filePath}):`, error);
//     return [{
//       arquivo: filePath,
//       linha: 1,
//       regra: 'erro-leitura',
//       descricao: `Erro interno ao ler ou analisar o arquivo: ${error.message}`,
//       severidade: 'critical',
//       trecho: '',
//       sugestao: 'Verifique se o arquivo está bem formatado.'
//     }];
//   }
// }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM, VirtualConsole } from 'jsdom';
import {
  traduzirDescricao,
  traduzirHelp,
  traduzirFalhaSummary,
} from './traducoes-axe.js';

function obterCaminhoAxe() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const tentativas = [
    path.join(currentDir, 'node_modules/axe-core/axe.min.js'),
    path.join(currentDir, '../node_modules/axe-core/axe.min.js'),
    path.join(process.cwd(), 'node_modules/axe-core/axe.min.js'),
    path.join(
      process.cwd(),
      'tools/AcessFlow/node_modules/axe-core/axe.min.js',
    ),
  ];
  for (const p of tentativas) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "Biblioteca axe-core (axe.min.js) não foi localizada. Execute 'npm install'.",
  );
}

export function limparCodigoPhp(content) {
  return content
    .replace(/<\?php([\s\S]*?)\?>/gi, (match) => {
      return match
        .split('')
        .map((char) => (char === '\n' ? '\n' : ' '))
        .join('');
    })
    .replace(/<\?=([\s\S]*?)\?>/gi, (match) => {
      return match
        .split('')
        .map((char) => (char === '\n' ? '\n' : ' '))
        .join('');
    });
}

export async function analisarHtmlPhp(filePath) {
  try {
    let rawContent = fs.readFileSync(filePath, 'utf-8');
    const isPhp = filePath.endsWith('.php');
    const htmlContent = isPhp ? limparCodigoPhp(rawContent) : rawContent;

    const axeScriptPath = obterCaminhoAxe();
    const axeCode = fs.readFileSync(axeScriptPath, 'utf-8');

    const virtualConsole = new VirtualConsole();
    // Silencia erros internos do JSDOM para evitar avisos "Not implemented" no console do usuário
    virtualConsole.on('jsdomError', () => {});

    const dom = new JSDOM(htmlContent, {
      includeNodeLocations: true,
      runScripts: 'dangerously',
      virtualConsole,
    });

    const { window } = dom;

    // Mock HTMLCanvasElement.prototype.getContext para evitar erro do jsdom no axe-core
    if (window.HTMLCanvasElement) {
      window.HTMLCanvasElement.prototype.getContext = function () {
        return null;
      };
    }

    // Mock window.getComputedStyle para capturar erros em pseudo-elementos
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, pseudoElt) {
      try {
        return originalGetComputedStyle(elt, pseudoElt);
      } catch (err) {
        return window.document.createElement('div').style;
      }
    };

    window.eval(axeCode);

    const axeOptions = {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    };

    if (isPhp) {
      axeOptions.rules = {
        'document-title': { enabled: false },
        'html-has-lang': { enabled: false },
        'landmark-one-main': { enabled: false },
        'landmark-no-duplicate-main': { enabled: false },
        'bypass': { enabled: false },
        'region': { enabled: false },
      };
    }

    const results = await window.axe.run(window.document, axeOptions);

    const erros = [];

    for (const violation of results.violations) {
      for (const nodeResult of violation.nodes) {
        const selector = nodeResult.target.join(' ');
        const element = window.document.querySelector(selector);

        let linha = 1;
        let trechoHtml = nodeResult.html;

        if (element) {
          const location = dom.nodeLocation(element);
          if (location) linha = location.startLine;
        } else {
          const index = rawContent.indexOf(trechoHtml);
          if (index !== -1) {
            linha = rawContent.substring(0, index).split('\n').length;
          }
        }

        erros.push({
          arquivo: filePath,
          linha,
          regra: violation.id,
          descricao: traduzirDescricao(violation.description),
          severidade: violation.impact,
          trecho: trechoHtml,
          sugestao: `${traduzirHelp(violation.help)}. Solução sugerida: ${traduzirFalhaSummary(nodeResult.failureSummary || 'Corrigir marcação HTML.')}`,
          solucaoLink: violation.helpUrl,
        });
      }
    }

    return erros.sort((a, b) => a.linha - b.linha);
  } catch (error) {
    console.error(`Erro ao analisar arquivo HTML/PHP (${filePath}):`, error);
    return [
      {
        arquivo: filePath,
        linha: 1,
        regra: 'erro-leitura',
        descricao: `Erro interno ao ler ou analisar o arquivo: ${error.message}`,
        severidade: 'critico',
        trecho: '',
        sugestao: 'Verifique se o arquivo está bem formatado.',
      },
    ];
  }
}

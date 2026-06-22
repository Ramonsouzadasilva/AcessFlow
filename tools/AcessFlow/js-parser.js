// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';
// import * as parser from '@babel/parser';
// import _traverse from '@babel/traverse';
// import { JSDOM } from 'jsdom';

// // Hack para contornar problemas de importação do ES Module do babel-traverse
// const traverse = _traverse.default || _traverse;

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
//  * Verifica se um nó JSX possui um atributo específico.
//  * @param {object} node - Nó AST JSXOpeningElement
//  * @param {string} attrName - Nome do atributo (ex: "alt", "title")
//  * @returns {object|null} O atributo se encontrado
//  */
// function obterAtributoJSX(node, attrName) {
//   if (!node.attributes) return null;
//   return node.attributes.find(
//     attr => attr.type === 'JSXAttribute' && attr.name.name === attrName
//   );
// }

// /**
//  * Verifica se o elemento JSX possui algum filho com conteúdo (texto, expressões ou outras tags).
//  * @param {object} jsxElementNode - Nó do elemento JSX completo
//  * @returns {boolean} True se tiver conteúdo, False caso contrário
//  */
// function temConteudoFilhoJSX(jsxElementNode) {
//   if (!jsxElementNode.children || jsxElementNode.children.length === 0) {
//     return false;
//   }
//   return jsxElementNode.children.some(child => {
//     if (child.type === 'JSXText' && child.value.trim() !== '') return true;
//     if (child.type === 'JSXElement') return true;
//     if (child.type === 'JSXExpressionContainer') return true; // conteúdo dinâmico {texto}
//     return false;
//   });
// }

// /**
//  * Analisa arquivos JS, JSX ou TSX para detectar erros de acessibilidade.
//  * @param {string} filePath - Caminho do arquivo
//  * @returns {Promise<Array>} Lista de erros encontrados
//  */
// export async function analisarJsJsxTsx(filePath) {
//   const erros = [];
//   try {
//     const code = fs.readFileSync(filePath, 'utf-8');

//     // Configura o parser do Babel com suporte a JSX e TypeScript
//     const ast = parser.parse(code, {
//       sourceType: 'module',
//       plugins: [
//         'jsx',
//         'typescript',
//         'decorators-legacy',
//         'classProperties',
//         'objectRestSpread'
//       ],
//       errorRecovery: true // Evita falhas críticas se o arquivo tiver erros pequenos
//     });

//     const stringsHtmlEncontradas = [];

//     // Primeiro, varremos a AST procurando por elementos JSX e literais de string que contêm HTML
//     traverse(ast, {
//       // 1. Analisa Elementos JSX (React)
//       JSXElement(path) {
//         const { openingElement } = path.node;
//         const tagName = openingElement.name.name;
//         const startLine = openingElement.loc ? openingElement.loc.start.line : 1;

//         if (tagName === 'img') {
//           const altAttr = obterAtributoJSX(openingElement, 'alt');
//           const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
//           const ariaLabelledby = obterAtributoJSX(openingElement, 'aria-labelledby');

//           if (!altAttr && !ariaLabel && !ariaLabelledby) {
//             erros.push({
//               arquivo: filePath,
//               linha: startLine,
//               regra: 'image-alt',
//               descricao: 'Imagens devem ter atributo "alt" alternativo ou rotulagem ARIA.',
//               severidade: 'critical',
//               trecho: code.slice(openingElement.start, openingElement.end),
//               sugestao: 'Adicione o atributo alt="Descrição da imagem" ou aria-label.'
//             });
//           }
//         }

//         if (tagName === 'a') {
//           const temConteudo = temConteudoFilhoJSX(path.node);
//           const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
//           const ariaLabelledby = obterAtributoJSX(openingElement, 'aria-labelledby');

//           if (!temConteudo && !ariaLabel && !ariaLabelledby) {
//             erros.push({
//               arquivo: filePath,
//               linha: startLine,
//               regra: 'link-name',
//               descricao: 'Links devem conter texto visível ou rotulagem descritiva.',
//               severidade: 'critical',
//               trecho: code.slice(openingElement.start, openingElement.end),
//               sugestao: 'Adicione um texto dentro da tag <a> ou adicione um atributo aria-label.'
//             });
//           }
//         }

//         if (tagName === 'button') {
//           const temConteudo = temConteudoFilhoJSX(path.node);
//           const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
//           const ariaLabelledby = obterAtributoJSX(openingElement, 'aria-labelledby');

//           if (!temConteudo && !ariaLabel && !ariaLabelledby) {
//             erros.push({
//               arquivo: filePath,
//               linha: startLine,
//               regra: 'button-name',
//               descricao: 'Botões devem conter texto descritivo ou rotulagem ARIA.',
//               severidade: 'critical',
//               trecho: code.slice(openingElement.start, openingElement.end),
//               sugestao: 'Adicione um texto descritivo dentro do botão ou configure um atributo aria-label.'
//             });
//           }
//         }

//         if (tagName === 'iframe') {
//           const titleAttr = obterAtributoJSX(openingElement, 'title');
//           if (!titleAttr) {
//             erros.push({
//               arquivo: filePath,
//               linha: startLine,
//               regra: 'frame-title',
//               descricao: 'Iframes devem possuir o atributo "title" para contextualizar o conteúdo.',
//               severidade: 'serious',
//               trecho: code.slice(openingElement.start, openingElement.end),
//               sugestao: 'Adicione o atributo title="Título do frame informativo".'
//             });
//           }
//         }

//         // Verifica tabindex > 0
//         const tabIndexAttr = obterAtributoJSX(openingElement, 'tabIndex') || obterAtributoJSX(openingElement, 'tabindex');
//         if (tabIndexAttr && tabIndexAttr.value && tabIndexAttr.value.type === 'JSXExpressionContainer') {
//           const val = tabIndexAttr.value.expression.value;
//           if (typeof val === 'number' && val > 0) {
//             erros.push({
//               arquivo: filePath,
//               linha: startLine,
//               regra: 'tabindex-no-positive',
//               descricao: 'Evite valores positivos de tabindex para não corromper o fluxo de navegação natural.',
//               severidade: 'serious',
//               trecho: code.slice(openingElement.start, openingElement.end),
//               sugestao: 'Altere o tabindex para 0 ou remova-o para manter a ordem de foco sequencial padrão.'
//             });
//           }
//         }
//       },

//       // 2. Extração de Strings HTML em JavaScript
//       StringLiteral(path) {
//         const val = path.node.value;
//         if (val && /<[a-zA-Z]+[^>]*>/.test(val)) {
//           stringsHtmlEncontradas.push({
//             html: val,
//             linhaStart: path.node.loc ? path.node.loc.start.line : 1
//           });
//         }
//       },

//       TemplateLiteral(path) {
//         let html = '';
//         const { quasis, expressions } = path.node;

//         for (let i = 0; i < quasis.length; i++) {
//           html += quasis[i].value.cooked || '';
//           if (i < expressions.length) {
//             html += `__DYNAMIC_EXPR_${i}__`;
//           }
//         }

//         if (html && /<[a-zA-Z]+[^>]*>/.test(html)) {
//           stringsHtmlEncontradas.push({
//             html: html,
//             linhaStart: path.node.loc ? path.node.loc.start.line : 1
//           });
//         }
//       }
//     });

//     if (stringsHtmlEncontradas.length > 0) {
//       const axeScriptPath = obterCaminhoAxe();
//       const axeCode = fs.readFileSync(axeScriptPath, 'utf-8');

//       for (const item of stringsHtmlEncontradas) {
//         const dom = new JSDOM(item.html, {
//           includeNodeLocations: true,
//           runScripts: "dangerously"
//         });
//         const { window } = dom;

//         // Injeta o axe-core na sandbox do JSDOM
//         window.eval(axeCode);

//         // Executa o axe-core dentro do JSDOM
//         const results = await window.axe.run(window.document, {
//           runOnly: {
//             type: 'tag',
//             values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
//           }
//         });

//         for (const violation of results.violations) {
//           for (const nodeResult of violation.nodes) {
//             const selector = nodeResult.target.join(' ');
//             const element = window.document.querySelector(selector);

//             let offsetLinha = 0;
//             if (element) {
//               const location = dom.nodeLocation(element);
//               if (location) {
//                 offsetLinha = location.startLine - 1;
//               }
//             }

//             erros.push({
//               arquivo: filePath,
//               linha: item.linhaStart + offsetLinha,
//               regra: violation.id,
//               descricao: `[HTML no JS] ${violation.description}`,
//               severidade: violation.impact,
//               trecho: nodeResult.html,
//               sugestao: `${violation.help}. Solução sugerida: ${nodeResult.failureSummary}`
//             });
//           }
//         }
//       }
//     }

//     return erros.sort((a, b) => a.linha - b.linha);

//   } catch (error) {
//     console.error(`Erro ao processar arquivo JS/JSX/TSX (${filePath}):`, error);
//     return [{
//       arquivo: filePath,
//       linha: 1,
//       regra: 'erro-parser-js',
//       descricao: `Erro ao analisar arquivo JS/JSX/TSX: ${error.message}`,
//       severidade: 'critical',
//       trecho: '',
//       sugestao: 'Verifique se a sintaxe do arquivo de código está correta.'
//     }];
//   }
// }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import { JSDOM, VirtualConsole } from 'jsdom';
import {
  traduzirDescricao,
  traduzirHelp,
  traduzirFalhaSummary,
} from './traducoes-axe.js';

const traverse = _traverse.default || _traverse;

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

function obterAtributoJSX(node, attrName) {
  if (!node.attributes) return null;
  return node.attributes.find(
    (attr) => attr.type === 'JSXAttribute' && attr.name.name === attrName,
  );
}

function temConteudoFilhoJSX(jsxElementNode) {
  if (!jsxElementNode.children || jsxElementNode.children.length === 0)
    return false;
  return jsxElementNode.children.some((child) => {
    if (child.type === 'JSXText' && child.value.trim() !== '') return true;
    if (child.type === 'JSXElement') return true;
    if (child.type === 'JSXExpressionContainer') return true;
    return false;
  });
}

export async function analisarJsJsxTsx(filePath) {
  const erros = [];
  try {
    const code = fs.readFileSync(filePath, 'utf-8');

    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
      ],
      errorRecovery: true,
    });

    const stringsHtmlEncontradas = [];

    traverse(ast, {
      JSXElement(path) {
        const { openingElement } = path.node;
        const tagName = openingElement.name.name;
        const startLine = openingElement.loc
          ? openingElement.loc.start.line
          : 1;

        if (tagName === 'img') {
          const altAttr = obterAtributoJSX(openingElement, 'alt');
          const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
          const ariaLabelledby = obterAtributoJSX(
            openingElement,
            'aria-labelledby',
          );
          if (!altAttr && !ariaLabel && !ariaLabelledby) {
            erros.push({
              arquivo: filePath,
              linha: startLine,
              regra: 'image-alt',
              descricao:
                'Imagens devem ter atributo "alt" alternativo ou rotulagem ARIA.',
              severidade: 'critico',
              trecho: code.slice(openingElement.start, openingElement.end),
              sugestao:
                'Adicione o atributo alt="Descrição da imagem" ou aria-label.',
            });
          }
        }

        if (tagName === 'a') {
          const temConteudo = temConteudoFilhoJSX(path.node);
          const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
          const ariaLabelledby = obterAtributoJSX(
            openingElement,
            'aria-labelledby',
          );
          if (!temConteudo && !ariaLabel && !ariaLabelledby) {
            erros.push({
              arquivo: filePath,
              linha: startLine,
              regra: 'link-name',
              descricao:
                'Links devem conter texto visível ou rotulagem descritiva.',
              severidade: 'critico',
              trecho: code.slice(openingElement.start, openingElement.end),
              sugestao:
                'Adicione um texto dentro da tag <a> ou adicione um atributo aria-label.',
            });
          }
        }

        if (tagName === 'button') {
          const temConteudo = temConteudoFilhoJSX(path.node);
          const ariaLabel = obterAtributoJSX(openingElement, 'aria-label');
          const ariaLabelledby = obterAtributoJSX(
            openingElement,
            'aria-labelledby',
          );
          if (!temConteudo && !ariaLabel && !ariaLabelledby) {
            erros.push({
              arquivo: filePath,
              linha: startLine,
              regra: 'button-name',
              descricao:
                'Botões devem conter texto descritivo ou rotulagem ARIA.',
              severidade: 'critico',
              trecho: code.slice(openingElement.start, openingElement.end),
              sugestao:
                'Adicione um texto descritivo dentro do botão ou configure um atributo aria-label.',
            });
          }
        }

        if (tagName === 'iframe') {
          const titleAttr = obterAtributoJSX(openingElement, 'title');
          if (!titleAttr) {
            erros.push({
              arquivo: filePath,
              linha: startLine,
              regra: 'frame-title',
              descricao:
                'Iframes devem possuir o atributo "title" para contextualizar o conteúdo.',
              severidade: 'sério',
              trecho: code.slice(openingElement.start, openingElement.end),
              sugestao:
                'Adicione o atributo title="Título do frame informativo".',
            });
          }
        }

        const tabIndexAttr =
          obterAtributoJSX(openingElement, 'tabIndex') ||
          obterAtributoJSX(openingElement, 'tabindex');
        if (
          tabIndexAttr &&
          tabIndexAttr.value &&
          tabIndexAttr.value.type === 'JSXExpressionContainer'
        ) {
          const val = tabIndexAttr.value.expression.value;
          if (typeof val === 'number' && val > 0) {
            erros.push({
              arquivo: filePath,
              linha: startLine,
              regra: 'tabindex-no-positive',
              descricao:
                'Evite valores positivos de tabindex para não corromper o fluxo de navegação natural.',
              severidade: 'sério',
              trecho: code.slice(openingElement.start, openingElement.end),
              sugestao:
                'Altere o tabindex para 0 ou remova-o para manter a ordem de foco sequencial padrão.',
            });
          }
        }
      },

      StringLiteral(path) {
        const val = path.node.value;
        if (val && /<[a-zA-Z]+[^>]*>/.test(val)) {
          stringsHtmlEncontradas.push({
            html: val,
            linhaStart: path.node.loc ? path.node.loc.start.line : 1,
          });
        }
      },

      TemplateLiteral(path) {
        let html = '';
        const { quasis, expressions } = path.node;
        for (let i = 0; i < quasis.length; i++) {
          html += quasis[i].value.cooked || '';
          if (i < expressions.length) html += `__DYNAMIC_EXPR_${i}__`;
        }
        if (html && /<[a-zA-Z]+[^>]*>/.test(html)) {
          stringsHtmlEncontradas.push({
            html,
            linhaStart: path.node.loc ? path.node.loc.start.line : 1,
          });
        }
      },
    });

    if (stringsHtmlEncontradas.length > 0) {
      const axeScriptPath = obterCaminhoAxe();
      const axeCode = fs.readFileSync(axeScriptPath, 'utf-8');

      for (const item of stringsHtmlEncontradas) {
        const virtualConsole = new VirtualConsole();
        virtualConsole.on('jsdomError', () => {});

        const dom = new JSDOM(item.html, {
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

        const results = await window.axe.run(window.document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
          },
          rules: {
            'document-title': { enabled: false },
            'html-has-lang': { enabled: false },
            'landmark-one-main': { enabled: false },
            'landmark-no-duplicate-main': { enabled: false },
            'bypass': { enabled: false },
            'region': { enabled: false },
          },
        });

        for (const violation of results.violations) {
          for (const nodeResult of violation.nodes) {
            const selector = nodeResult.target.join(' ');
            const element = window.document.querySelector(selector);

            let offsetLinha = 0;
            if (element) {
              const location = dom.nodeLocation(element);
              if (location) offsetLinha = location.startLine - 1;
            }

            erros.push({
              arquivo: filePath,
              linha: item.linhaStart + offsetLinha,
              regra: violation.id,
              descricao: `[HTML no JS] ${traduzirDescricao(violation.description)}`,
              severidade: violation.impact,
              trecho: nodeResult.html,
              sugestao: `${traduzirHelp(violation.help)}. Solução sugerida: ${traduzirFalhaSummary(nodeResult.failureSummary)}`,
            });
          }
        }
      }
    }

    return erros.sort((a, b) => a.linha - b.linha);
  } catch (error) {
    console.error(`Erro ao processar arquivo JS/JSX/TSX (${filePath}):`, error);
    return [
      {
        arquivo: filePath,
        linha: 1,
        regra: 'erro-parser-js',
        descricao: `Erro ao analisar arquivo JS/JSX/TSX: ${error.message}`,
        severidade: 'critico',
        trecho: '',
        sugestao: 'Verifique se a sintaxe do arquivo de código está correta.',
      },
    ];
  }
}

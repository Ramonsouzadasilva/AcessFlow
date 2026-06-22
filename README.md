# AcessFlow — Analisador Estático de Acessibilidade WCAG

O **AcessFlow** é um framework modular de verificação estática de acessibilidade em conformidade com as diretrizes da **WCAG 2.1 (níveis A e AA)**. Ele analisa arquivos de código-fonte locais para identificar e detalhar problemas de acessibilidade de forma estática, mapeando o erro diretamente no número da linha do editor.

## 🚀 Funcionalidades Principais

- **Suporte a Múltiplos Formatos**: Analisa arquivos HTML (`.html`), PHP (`.php`), JavaScript (`.js`), React JSX (`.jsx`) e TypeScript TSX (`.tsx`).
- **Mapeamento de Linhas de Código**:
  - Em arquivos HTML e PHP, extrai as localizações de nós reais via JSDOM para apontar o erro na linha exata do editor.
  - Em arquivos PHP, aplica um algoritmo que mascara o código PHP dinâmico substituindo os blocos por espaços em branco, mantendo o exato offset de linhas para que o motor de análise funcione perfeitamente.
  - Em arquivos JS/JSX/TSX, constrói uma Árvore de Sintaxe Abstrata (AST) via Babel Parser para encontrar elementos com marcação de acessibilidade irregular.
- **Sincronização com o GitHub Issues**: Cria e fecha issues automaticamente no repositório de acordo com o status atual das falhas de acessibilidade.

---

## 📸 Diagramas do Sistema

### Fluxograma de Funcionamento

Como o AcessFlow processa arquivos, aplica mascaramentos, percorre a AST do código e roda o motor Axe-Core:
![Fluxograma de Funcionamento](./docs/images/fluxograma.png)

### Diagrama de Casos de Uso

Interações de desenvolvedores e automações CI/CD com o AcessFlow:
![Casos de Uso do AcessFlow](./docs/images/casos_de_uso.png)

---

## 🛠️ Instalação e Configuração

### Pré-requisitos

- **Node.js**: Versão 18.0.0 ou superior instalada.

### Passo 1: Clonar o Repositório

Abra o seu terminal (Prompt de Comando, PowerShell, Terminal do Linux ou WSL) e execute:

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
```

_(Substitua a URL acima pela URL real do seu repositório Git)._

### Passo 2: Instalar Dependências

Você pode instalar todas as dependências automaticamente através dos scripts automatizados na raiz ou fazê-lo manualmente.

**Instalação**:
Caso prefira instalar diretamente via `npm`, entre no diretório da ferramenta AcessFlow e rode a instalação:

```bash
cd tools/AcessFlow
npm install
```

### Passo 3: Configurar Variáveis de Ambiente

O arquivo de configuração `.env` deve ficar localizado dentro da pasta `tools/AcessFlow/`.

1. Vá até o diretório `tools/AcessFlow/` do projeto.
2. Copie o arquivo `.env.example` para `.env`:
   - **No Windows**: `copy tools\AcessFlow\.env.example tools\AcessFlow\.env`
   - **No Linux/WSL**: `cp tools/AcessFlow/.env.example tools/AcessFlow/.env`
3. Abra o arquivo `tools/AcessFlow/.env` no seu editor de código e configure os valores:

   ```env
   # Repositório do GitHub no formato "dono/nome-do-repositorio"
   GITHUB_REPO=dono/repositorio

   # Token de Acesso Pessoal (PAT) para evitar limites de rate limit da API do GitHub
   GITHUB_TOKEN=ghp_SeuTokenAqui
   ```

---

## 🖥️ Como Usar (Passagem de Caminhos, Pastas e Arquivos)

O AcessFlow permite escanear **um arquivo individual** ou **uma pasta inteira** recursivamente. Ele foi projetado para funcionar no **Windows, Linux e WSL**, tratando automaticamente as diferenças de barras (`\` e `/`) e caminhos relativos ou absolutos.

### Modo 2: Executando Diretamente com Node dentro da pasta `AcessFlow`

Se você quiser rodar a ferramenta diretamente da pasta de origem:

1. Acesse o diretório:
   ```bash
   cd tools/AcessFlow
   ```
2. Execute o comando passando o caminho do arquivo ou diretório:
   ```bash
   node index.js ../../test-files
   ```
   Ou especificando o arquivo diretamente:
   ```bash
   node index.js ../../test-files/test.html
   ```

---

### Modo 3: Usando Scripts NPM (`npm run`)

Se você estiver dentro do diretório `tools/AcessFlow`, você também pode rodar através do gerenciador de pacotes `npm`:

1. Acesse o diretório:
   ```bash
   cd tools/AcessFlow
   ```
2. Execute utilizando `--` para repassar os argumentos ao script:
   ```bash
   npm run analyze ../../test-files
   ```
   Para rodar no modo de integração contínua (CI):
   ```bash
   npm run ci ../../test-files
   ```

---

## 📊 Relatórios Gerados

Ao finalizar a análise, a ferramenta criará na raiz do projeto (ou no diretório especificado na saída) os seguintes arquivos:

1. **`erros_acessflow.txt`**: Relatório legível por humanos contendo a linha exata, o impacto do erro, a descrição e a solução de acessibilidade recomendada para cada falha encontrada.
2. **`ci_accessibility_report.json`**: Relatório estruturado em JSON ideal para consumo por ferramentas automatizadas ou scripts customizados.

---

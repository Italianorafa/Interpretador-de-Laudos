# ⚕️ Interpretador de Laudos — Health Tech CDSS

Sistema SaaS de **Suporte à Decisão Clínica (CDSS - Clinical Decision Support System)** multi-tenant para clínicas e consultórios médicos, com triagem inteligente, prontuário eletrônico (PEP), leitura de exames em PDF no navegador e análise clínica assistida por Inteligência Artificial (**Google Gemini 1.5 Pro** + fallback automático para **Groq**).

---

## ✨ Principais Funcionalidades

1. **Autenticação Multi-Tenant e Controle de Acesso (RBAC)**
   - Isolamento de dados por clínica através do identificador `crm` (Tenant ID).
   - Quatro níveis de permissão gerenciáveis na tela de equipe:
     - **`Total` (Médico / Titular)**: Acesso completo à fila de espera, nova consulta com IA, prontuário eletrônico e configurações.
     - **`Administrativo`**: Gestão de equipe/acessos, painel de recepção e visualização da fila.
     - **`Agendamento` (Recepção)**: Acesso dedicado à ficha de admissão e triagem de pacientes.
     - **`Leitura`**: Visualização de fila e histórico de prontuários em modo somente leitura.

2. **Admissão, Triagem e Fila Inteligente**
   - Busca rápida de pacientes cadastrados por **CPF / Documento** com preenchimento automático de dados demográficos.
   - Direcionamento opcional para um médico específico da equipe ou para a **Fila Geral**.
   - Painel de fila de espera com filtro inteligente por médico logado.

3. **Extração de PDFs e Interpretação Clínica com IA**
   - Leitura client-side de arquivos PDF (histórico clínico prévio e laudos laboratoriais/imagem) via **Mozilla PDF.js**.
   - Geração automática de parecer estruturado em 4 tópicos:
     1. **Resumo do Quadro**
     2. **Hipóteses Diagnósticas**
     3. **Conduta Terapêutica**
     4. **Exames Recomendados**
   - Arquitetura resiliente Dual-LLM: tentativa primária no **Google Gemini 1.5 Pro** com fallback transparente para **Groq (`openai/gpt-oss-120b`)**.

4. **Prontuário Eletrônico do Paciente (PEP)**
   - Agrupamento automático de atendimentos por paciente, cruzando dados demográficos e cálculo dinâmico de idade.
   - Linha do tempo (*timeline*) cronológica com queixa/anamnese limpa, médico responsável e conduta gerada pela IA.

---

## 🗂️ Estrutura do Projeto

```text
Interpretador-de-Laudos/
├── css/
│   └── style.css       # Design System Health Tech responsivo (Desktop/Tablet/Mobile)
├── js/
│   ├── config.js       # Inicialização do Supabase, guardas de rota RBAC e perfil
│   ├── login.js        # Lógica de autenticação no Supabase Auth
│   ├── recepcao.js     # Busca por CPF, upsert de paciente e envio para a fila
│   ├── fila.js         # Listagem e filtro inteligente de pacientes aguardando
│   ├── consulta.js     # Extração de PDF (PDF.js), chamada às IAs e salvamento
│   ├── pacientes.js    # Agrupamento de pacientes e histórico de consultas
│   └── configuracoes.js# Criação e remoção de membros da clínica
├── index.html          # Ponto de entrada (redireciona para login.html)
├── login.html          # Tela de login, registo de clínica e contas de teste
├── recepcao.html       # Tela de admissão e triagem de pacientes
├── fila.html           # Painel de fila de espera médica
├── consulta.html       # Tela de atendimento clínico e upload de laudos
├── pacientes.html      # Prontuário Eletrônico e linha do tempo clínica
├── configuracoes.html  # Gestão de equipe e permissões (RBAC)
├── README.md           # Documentação do projeto
└── LICENSE             # Licença MIT
```

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 (Design System próprio e responsivo), JavaScript Vanilla (ES6+)
- **Backend-as-a-Service (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL + Authentication)
- **Inteligência Artificial**: Google Gemini API & Groq Cloud API
- **Processamento de Documentos**: [PDF.js](https://mozilla.github.io/pdf.js/) (`v2.16.105`)

---

## 🚀 Como Executar

1. Clone este repositório:
   ```bash
   git clone https://github.com/Italianorafa/Interpretador-de-Laudos
   cd Interpretador-de-Laudos
   ```
2. Sirva os arquivos com qualquer servidor HTTP estático (por exemplo, a extensão **Live Server** do VS Code, `npx serve .` ou `python -m http.server 8000`) ou abra o `index.html` no navegador.
3. Utilize uma das contas de teste exibidas na tela de login para avaliar cada perfil de acesso:
   - **Médico / Admin**: `medico@teste.com` / `123456`
   - **Recepção**: `recepcao@teste.com` / `123456`
   - **Administração**: `adm@teste.com` / `123456`

---

## 📄 Licença

Distribuído sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais informações.

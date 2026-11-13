document.addEventListener("DOMContentLoaded", async () => {
    // ==========================================
    // 1. IDENTIDADE DO MÉDICO LOGADO
    // ==========================================
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoCrm = authData.crm; // ID da Clínica
    
    // Descobrir o nome do médico para a Assinatura Eletrônica no banco de dados
    const metadata = authData.session.user.user_metadata;
    const nomeUsuarioLogado = metadata.nome_completo;
    const nomeFormatadoLogado = nomeUsuarioLogado ? `Dr(a). ${nomeUsuarioLogado}` : "Médico Titular";

    // Mapeamento de elementos da interface
    const inputNome = document.getElementById('nomePaciente');
    const inputDocumento = document.getElementById('documentoPaciente');
    const inputNascimento = document.getElementById('nascimentoPaciente');
    const inputIdade = document.getElementById('idadePaciente');
    const selectSexo = document.getElementById('sexoPaciente');
    const inputAnamnese = document.getElementById('anamnesePaciente');
    
    const btnSalvarAnamnese = document.getElementById('btnSalvarAnamnese');
    const btnAnalisar = document.getElementById('btnAnalisar'); 
    const loading = document.getElementById('loading');
    const resultadoBox = document.getElementById('resultadoBox');
    const divResultadoTexto = document.getElementById('resultadoTexto');
    const historicoInput = document.getElementById('historicoInput');
    const laudoInput = document.getElementById('laudoInput');

    // ==========================================
    // 2. CÁLCULO DE IDADE DINÂMICO
    // ==========================================
    function calcularIdade(dataNascimentoStr) {
        if (!dataNascimentoStr) return '';
        const hoje = new Date();
        const nascimento = new Date(dataNascimentoStr + 'T12:00:00'); 
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
        return idade >= 0 ? idade + " anos" : "Data inválida";
    }

    if (inputNascimento && inputIdade) {
        inputNascimento.addEventListener('change', () => {
            inputIdade.value = calcularIdade(inputNascimento.value);
        });
    }

    // ==========================================
    // 3. IMPORTAR DADOS DA FILA DE ESPERA
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const atendimentoId = urlParams.get('atendimento_id');

    if (atendimentoId) {
        try {
            const { data: pacienteFila, error: erroFila } = await window.clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('id', atendimentoId)
                .single();

            if (pacienteFila && !erroFila) {
                if (inputNome) inputNome.value = pacienteFila.nome_paciente;
                
                let textoProntuario = pacienteFila.anamnese || '';
                
                // Extrai Nascimento, Documento e Sexo do texto da triagem
                const matchNascimento = textoProntuario.match(/Nascimento:\s*([^\n]+)/);
                const matchDocumento = textoProntuario.match(/Documento:\s*([^\n]+)/);
                const matchSexo = textoProntuario.match(/Sexo:\s*([^\n]+)/); 

                if (matchNascimento) {
                    const dataNasc = matchNascimento[1].trim(); 
                    if (inputNascimento) {
                        inputNascimento.value = dataNasc;
                        if (inputIdade) inputIdade.value = calcularIdade(dataNasc);
                    }
                }
                if (matchDocumento && inputDocumento) inputDocumento.value = matchDocumento[1].trim();
                if (matchSexo && selectSexo) selectSexo.value = matchSexo[1].trim(); 

                // Limpa as tags estruturais para a leitura médica ficar mais limpa
                textoProntuario = textoProntuario.replace(/\[MÉDICO ALOCADO:.*?\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/\[TRIAGEM\/RECEPÇÃO\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/Documento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Nascimento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Sexo:[^\n]*\n?/g, ''); 
                textoProntuario = textoProntuario.replace(/Contato:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Motivo:\s*/g, '');
                textoProntuario = textoProntuario.replace(/\n{3,}/g, '\n\n').trim();

                if (inputAnamnese) inputAnamnese.value = textoProntuario;
            }
        } catch (error) {
            console.error("Erro ao puxar dados da fila:", error);
        }
    }

    // ==========================================
    // 4. SISTEMA DE ABAS E LEITURA DE PDF
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetContent = document.getElementById(btn.getAttribute('data-target'));
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // Função universal para extrair texto do PDF
    async function extrairTextoPDF(file) {
        if (typeof window.pdfjsLib === 'undefined') {
            throw new Error("Biblioteca PDF.js não carregou corretamente no HTML.");
        }
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function() {
                try {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let text = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const content = await page.getTextContent();
                        const strings = content.items.map(item => item.str);
                        text += strings.join(" ") + "\n";
                    }
                    resolve(text);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // A) PDF DO HISTÓRICO CLÍNICO
    const btnExtrairHistorico = document.getElementById('btnExtrairHistorico');
    const historicoPdfInput = document.getElementById('historicoPdfInput');
    
    if (btnExtrairHistorico && historicoPdfInput) {
        btnExtrairHistorico.addEventListener('click', () => historicoPdfInput.click());
        
        historicoPdfInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const originalText = btnExtrairHistorico.innerText;
                btnExtrairHistorico.innerText = "⏳ A extrair...";
                try {
                    const texto = await extrairTextoPDF(e.target.files[0]);
                    // Limita o texto para não travar a caixa se for um documento muito grande
                    if (historicoInput) historicoInput.value = texto.substring(0, 3000); 
                    alert("Histórico extraído com sucesso! Pode editar o texto se quiser.");
                } catch (err) {
                    console.error(err);
                    alert("Erro ao ler PDF. Tente copiar e colar o texto manualmente.");
                }
                btnExtrairHistorico.innerText = originalText;
                historicoPdfInput.value = ''; // Limpa o input
            }
        });
    }

    // B) PDF DE EXAMES COMPLEMENTARES (LAUDO)
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) {
        pdfInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const hint = document.querySelector('.file-hint');
                const originalHTML = hint.innerHTML;
                hint.innerHTML = `⏳ A extrair texto do exame...`;
                
                try {
                    const texto = await extrairTextoPDF(e.target.files[0]);
                    if (laudoInput) laudoInput.value = texto.substring(0, 4000); 
                    
                    hint.innerHTML = `✅ Laudo Anexado e Lido: <strong style="color: #0ea5e9;">${e.target.files[0].name}</strong>`;
                    
                    // Muda automaticamente para a aba "Digitar Resultados" para o médico ver
                    const abaTexto = document.querySelector('[data-target="tab-texto"]');
                    if (abaTexto) abaTexto.click();
                    
                } catch (err) {
                    console.error(err);
                    hint.innerHTML = originalHTML;
                    alert("Erro ao ler PDF do Laudo. O ficheiro pode estar protegido.");
                }
                pdfInput.value = ''; 
            }
        });
    }

    // Função auxiliar para garantir que CPF, Nascimento e Sexo fiquem salvos na tabela 'pacientes'
    async function sincronizarCadastroPaciente() {
        const nome = inputNome ? inputNome.value.trim() : '';
        const documento = inputDocumento ? inputDocumento.value.trim() : '';
        const nascimento = inputNascimento && inputNascimento.value ? inputNascimento.value : null;
        const sexo = selectSexo && selectSexo.value ? selectSexo.value : null;

        if (nome && documento) {
            const { error: erroUpsert } = await window.clienteSupabase
                .from('pacientes')
                .upsert([{
                    documento: documento,
                    nome_completo: nome,
                    data_nascimento: nascimento,
                    sexo: sexo
                }], { onConflict: 'documento' });

            if (erroUpsert) {
                console.warn("Aviso ao sincronizar paciente:", erroUpsert.message);
            }
        }
    }

    // ==========================================
    // 5. ANÁLISE COM IA (GEMINI + GROQ) E SALVAMENTO NO SUPABASE
    // ==========================================
    if (btnAnalisar) {
        btnAnalisar.addEventListener('click', async () => {
            const anamneseText = inputAnamnese ? inputAnamnese.value.trim() : '';
            if (!anamneseText) {
                alert("A Anamnese / Queixa Principal é obrigatória para a análise.");
                return;
            }

            const nomePaciente = inputNome ? inputNome.value.trim() : 'Paciente não identificado';
            const idadeText = inputIdade ? inputIdade.value : 'Não informada';
            const sexoText = selectSexo ? selectSexo.value : 'Não informado';
            const historicoText = historicoInput ? historicoInput.value.trim() : 'Nenhum histórico prévio informado.';
            const laudoText = laudoInput ? laudoInput.value.trim() : 'Nenhum laudo anexado.';

            const instrucaoSistema = "Você é um assistente médico especialista operando um CDSS. Responda em Português.";
            const conteudoPaciente = `DADOS DO PACIENTE:\n- Idade: ${idadeText}\n- Sexo: ${sexoText}\n\nHISTÓRICO CLÍNICO E COMORBIDADES:\n${historicoText}\n\nANAMNESE / QUEIXA PRINCIPAL:\n${anamneseText}\n\nEXAMES COMPLEMENTARES ANEXADOS:\n${laudoText}\n\nCom base nestas informações, forneça a sua análise estruturada exatamente nestes 4 tópicos:\n1. **Resumo do Quadro**\n2. **Hipóteses Diagnósticas**\n3. **Conduta Terapêutica**\n4. **Exames Recomendados**`;

            btnAnalisar.disabled = true;
            btnAnalisar.innerText = "A processar...";
            if (loading) loading.classList.remove('hidden');
            if (resultadoBox) resultadoBox.classList.add('hidden');

            try {
                let respostaDaIA = "";
                let sucesso = false;
            
                // Tentativa 1: GEMINI (apenas se a chave tiver o formato válido 'AIza...')
                try {
                    if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIza')) {
                        throw new Error("Chave Gemini ausente ou em formato inválido.");
                    }
                    const responseGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: instrucaoSistema + "\n\n" + conteudoPaciente }] }] })
                    });
                    if (!responseGemini.ok) throw new Error();
                    const dataGemini = await responseGemini.json();
                    respostaDaIA = dataGemini.candidates[0].content.parts[0].text;
                    sucesso = true;
                } catch (e) {
                    console.warn(`Gemini indisponível (${e.message || 'erro na requisição'}). Iniciando fallback para Groq...`);
                    // Tentativa 2: GROQ
                    if (typeof GROQ_API_KEY !== 'undefined' && GROQ_API_KEY) {
                        const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
                            body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "system", content: instrucaoSistema }, { role: "user", content: conteudoPaciente }], temperature: 0.3 })
                        });
                        if (responseGroq.ok) {
                            const dataGroq = await responseGroq.json();
                            respostaDaIA = dataGroq.choices[0].message.content;
                            sucesso = true;
                        }
                    }
                }

                if (!sucesso) throw new Error("A IA falhou na análise. Verifique a sua ligação ou chaves de API.");

                // 1. Formatar e exibir na interface
                let respostaFormatada = respostaDaIA.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                if (divResultadoTexto) divResultadoTexto.innerHTML = respostaFormatada;
                if (resultadoBox) resultadoBox.classList.remove('hidden');

                // 2. Sincronizar dados cadastrais do paciente e salvar atendimento no Supabase
                await sincronizarCadastroPaciente();

                let dbError;
                if (atendimentoId) {
                    const res = await window.clienteSupabase.from('atendimentos').update({ 
                        nome_paciente: nomePaciente, 
                        anamnese: anamneseText, 
                        diagnostico_ia: respostaDaIA,
                        nome_medico: nomeFormatadoLogado // <-- GRAVA O NOME DO MÉDICO
                    }).eq('id', atendimentoId);
                    dbError = res.error;
                } else {
                    const res = await window.clienteSupabase.from('atendimentos').insert([{ 
                        medico_crm: medicoCrm, 
                        nome_paciente: nomePaciente, 
                        anamnese: anamneseText, 
                        diagnostico_ia: respostaDaIA,
                        nome_medico: nomeFormatadoLogado // <-- GRAVA O NOME DO MÉDICO
                    }]);
                    dbError = res.error;
                }

                if (dbError) throw dbError;

                // 3. Confirmação
                setTimeout(() => {
                    if (confirm("✅ Análise salva! Deseja ir para a página 'Meus Pacientes' agora?")) {
                        window.location.href = 'pacientes.html';
                    }
                }, 500);

            } catch (error) {
                alert(error.message);
            } finally {
                btnAnalisar.disabled = false;
                btnAnalisar.innerText = "Analisar com IA e Salvar";
                if (loading) loading.classList.add('hidden');
            }
        });
    }

    // ==========================================
    // 6. SALVAR A CONSULTA (MANUALMENTE)
    // ==========================================
    if (btnSalvarAnamnese) {
        btnSalvarAnamnese.addEventListener('click', async () => {
            const nomePaciente = inputNome ? inputNome.value.trim() : '';
            const textoAnamnese = inputAnamnese ? inputAnamnese.value.trim() : '';
            if (!nomePaciente || !textoAnamnese) return alert("O nome e a anamnese são obrigatórios.");

            btnSalvarAnamnese.innerText = "A Salvar...";
            btnSalvarAnamnese.disabled = true;

            try {
                await sincronizarCadastroPaciente();

                let diagnosticoFinal = 'Atendimento finalizado manualmente.';
                if (divResultadoTexto && divResultadoTexto.innerText.trim() !== '') {
                    diagnosticoFinal = divResultadoTexto.innerText.trim();
                }

                const payload = { 
                    nome_paciente: nomePaciente, 
                    anamnese: textoAnamnese, 
                    diagnostico_ia: diagnosticoFinal,
                    nome_medico: nomeFormatadoLogado // <-- GRAVA O NOME DO MÉDICO
                };

                let dbError;
                if (atendimentoId) {
                    const res = await window.clienteSupabase.from('atendimentos').update(payload).eq('id', atendimentoId);
                    dbError = res.error;
                } else {
                    payload.medico_crm = medicoCrm;
                    const res = await window.clienteSupabase.from('atendimentos').insert([payload]);
                    dbError = res.error;
                }

                if (dbError) throw dbError;
                alert('Consulta salva com sucesso!');
                window.location.href = 'pacientes.html';
            } catch (error) {
                alert("Erro ao salvar: " + error.message);
            } finally {
                btnSalvarAnamnese.innerText = "Salvar Apenas Anamnese";
                btnSalvarAnamnese.disabled = false;
            }
        });
    }
});

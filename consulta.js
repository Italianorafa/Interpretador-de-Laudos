document.addEventListener("DOMContentLoaded", async () => {

    // 1. AUTENTICAÇÃO E DOM

    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoCrm = authData.crm;

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


    // 2. CÁLCULO DE IDADE DINÂMICO

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


    // 3. IMPORTAR DADOS DA FILA DE ESPERA

    const urlParams = new URLSearchParams(window.location.search);
    const atendimentoId = urlParams.get('atendimento_id');

    if (atendimentoId) {
        try {
            const { data: pacienteFila, error: erroFila } = await clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('id', atendimentoId)
                .single();

            if (pacienteFila && !erroFila) {
                if (inputNome) inputNome.value = pacienteFila.nome_paciente;
                
                let textoProntuario = pacienteFila.anamnese || '';

                // Extrai Nascimento e Documento do texto da receção
                // Extrai Nascimento, Documento e Sexo do texto da receção
                const matchNascimento = textoProntuario.match(/Nascimento:\s*([^\n]+)/);
                const matchDocumento = textoProntuario.match(/Documento:\s*([^\n]+)/);
                const matchSexo = textoProntuario.match(/Sexo:\s*([^\n]+)/); // <-- EXTRAI O SEXO

                if (matchNascimento) {
                    const dataNasc = matchNascimento[1].trim(); 
                    if (inputNascimento) {
                        inputNascimento.value = dataNasc;
                        if (inputIdade) inputIdade.value = calcularIdade(dataNasc);
                    }
                }

                if (matchDocumento && inputDocumento) {
                    inputDocumento.value = matchDocumento[1].trim();
                }

                // <-- PREENCHE A CAIXA DE SEXO AUTOMATICAMENTE
                if (matchSexo && selectSexo) {
                    selectSexo.value = matchSexo[1].trim(); 
                }

                // Limpa as tags estruturais para deixar apenas o texto clínico limpo para o médico
                textoProntuario = textoProntuario.replace(/\[MÉDICO ALOCADO:.*?\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/\[TRIAGEM\/RECEPÇÃO\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/\[AVALIAÇÃO MÉDICA\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/Nascimento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Documento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Sexo:[^\n]*\n?/g, ''); // <-- APAGA O SEXO DO TEXTO BRUTO
                textoProntuario = textoProntuario.replace(/Motivo:\s*/g, '');
                textoProntuario = textoProntuario.replace(/\n{3,}/g, '\n\n').trim();

                if (inputAnamnese) inputAnamnese.value = textoProntuario;
            }
        } catch (error) {
            console.error("Erro ao puxar dados da fila:", error);
        }
    }


    // 4. SISTEMA DE ABAS E FEEDBACK DE PDF

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    const btnExtrairHistorico = document.getElementById('btnExtrairHistorico');
    const historicoPdfInput = document.getElementById('historicoPdfInput');
    if (btnExtrairHistorico && historicoPdfInput) {
        btnExtrairHistorico.addEventListener('click', () => historicoPdfInput.click());
    }

    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) {
        pdfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const hint = document.querySelector('.file-hint');
                if (hint) hint.innerHTML = `✅ Laudo Anexado: <strong style="color: #0ea5e9;">${e.target.files[0].name}</strong> (Clique para trocar)`;
            }
        });
    }


    // 5. ANÁLISE COM IA (GEMINI + GROQ) E SALVAMENTO NO SUPABASE

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

            const instrucaoSistema = "Você é um assistente médico especialista operando um Sistema de Suporte à Decisão Clínica (CDSS). Responda sempre em Português.";
            
            const conteudoPaciente = `DADOS DO PACIENTE:
- Idade: ${idadeText}
- Sexo: ${sexoText}

HISTÓRICO CLÍNICO E COMORBIDADES:
${historicoText}

ANAMNESE / QUEIXA PRINCIPAL:
${anamneseText}

EXAMES COMPLEMENTARES ANEXADOS:
${laudoText}

Com base nestas informações, forneça a sua análise estruturada exatamente nestes 4 tópicos:
1. **Resumo do Quadro:** Destaque os principais pontos clínicos e sinais de alerta (red flags), se houver.
2. **Hipóteses Diagnósticas:** Liste as principais suspeitas em ordem de probabilidade.
3. **Conduta Terapêutica:** Sugestões de manejo inicial ou tratamento.
4. **Exames Recomendados:** Liste os exames laboratoriais ou de imagem que o paciente deve realizar para confirmar as hipóteses, com uma breve justificativa para cada um.`;

            // Ativa o loading visual
            btnAnalisar.disabled = true;
            btnAnalisar.innerText = "A processar...";
            if (loading) loading.classList.remove('hidden');
            if (resultadoBox) resultadoBox.classList.add('hidden');

            try {
                let respostaDaIA = "";
                let sucesso = false;

            
                // TENTATIVA 1: GOOGLE GEMINI
            
                try {
                    if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) throw new Error("Sem GEMINI_API_KEY");
                    const responseGemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: [{ parts: [{ text: instrucaoSistema + "\n\n" + conteudoPaciente }] }] })
                    });
                    if (!responseGemini.ok) throw new Error(`Status: ${responseGemini.status}`);
                    const dataGemini = await responseGemini.json();
                    respostaDaIA = dataGemini.candidates[0].content.parts[0].text;
                    sucesso = true;
                } catch (erroGemini) {
                    console.warn(`Gemini falhou. Iniciando fallback para Groq...`);
                }

            
                // TENTATIVA 2: GROQ CLOUD (FALLBACK)
            
                if (!sucesso) {
                    try {
                        if (typeof GROQ_API_KEY === 'undefined' || !GROQ_API_KEY) throw new Error("Sem GROQ_API_KEY");
                        const responseGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
                            body: JSON.stringify({
                                model: "openai/gpt-oss-120b", 
                                messages: [
                                    { role: "system", content: instrucaoSistema },
                                    { role: "user", content: conteudoPaciente }
                                ],
                                temperature: 0.3
                            })
                        });
                        if (!responseGroq.ok) throw new Error(`Status: ${responseGroq.status}`);
                        const dataGroq = await responseGroq.json();
                        respostaDaIA = dataGroq.choices[0].message.content;
                        sucesso = true;
                    } catch (erroGroq) {
                        throw new Error("Falha geral: As inteligências artificiais (Gemini e Groq) estão indisponíveis.");
                    }
                }

            
                // EXIBIÇÃO E SALVAMENTO NA BASE DE DADOS SUPABASE
            
                if (sucesso) {
                    // 1. Formata e exibe na interface
                    let respostaFormatada = respostaDaIA.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                    if (divResultadoTexto) divResultadoTexto.innerHTML = respostaFormatada;
                    if (resultadoBox) resultadoBox.classList.remove('hidden');

                    // 2. Registra o atendimento no Supabase
                    let dbError;
                    if (atendimentoId) {
                        // Atualiza um paciente que veio da Fila de Espera
                        const res = await clienteSupabase.from('atendimentos').update({ 
                            nome_paciente: nomePaciente, 
                            anamnese: anamneseText, 
                            diagnostico_ia: respostaDaIA // Salvamos o texto puro para manter integridade dos dados
                        }).eq('id', atendimentoId);
                        dbError = res.error;
                    } else {
                        // Cria um novo paciente avulso no sistema
                        const res = await clienteSupabase.from('atendimentos').insert([{ 
                            medico_crm: medicoCrm, 
                            nome_paciente: nomePaciente, 
                            anamnese: anamneseText, 
                            diagnostico_ia: respostaDaIA 
                        }]);
                        dbError = res.error;
                    }

                    if (dbError) {
                        console.error("Erro no Supabase:", dbError);
                        alert("A IA gerou a análise, mas houve um erro ao salvar o registo na base de dados.");
                    } else {
                        // 3. Confirmação inteligente de navegação
                        // O setTimeout dá 500ms para o navegador desenhar a caixa da IA na tela antes de bloquear com o pop-up
                        setTimeout(() => {
                            const irParaPacientes = confirm("✅ Análise concluída e paciente salvo com sucesso!\n\nDeseja ir para a página 'Meus Pacientes' agora?\n(Clique em 'Cancelar' se preferir continuar nesta página para ler o laudo da IA)");
                            
                            if (irParaPacientes) {
                                window.location.href = 'pacientes.html';
                            }
                        }, 500);
                    }
                }

            } catch (error) {
                alert(error.message);
            } finally {
                // Restaura o estado do botão e oculta o spinner
                btnAnalisar.disabled = false;
                btnAnalisar.innerText = "Analisar com IA e Salvar";
                if (loading) loading.classList.add('hidden');
            }
        });
    }


    // 6. SALVAR A CONSULTA (BASE DE DADOS)

    if (btnSalvarAnamnese) {
        btnSalvarAnamnese.addEventListener('click', async () => {
            const nomePaciente = inputNome ? inputNome.value.trim() : '';
            const textoAnamnese = inputAnamnese ? inputAnamnese.value.trim() : '';

            if (!nomePaciente || !textoAnamnese) {
                alert("O nome e a anamnese são obrigatórios.");
                return;
            }

            const textoOriginal = btnSalvarAnamnese.innerText;
            btnSalvarAnamnese.innerText = "A Salvar...";
            btnSalvarAnamnese.disabled = true;

            try {
                let diagnosticoFinal = 'Atendimento finalizado.';
                if (divResultadoTexto && divResultadoTexto.innerText.trim() !== '') {
                    diagnosticoFinal = divResultadoTexto.innerText.trim();
                }

                if (atendimentoId) {
                    const { error: dbError } = await clienteSupabase
                        .from('atendimentos')
                        .update({ 
                            nome_paciente: nomePaciente, 
                            anamnese: textoAnamnese, 
                            diagnostico_ia: diagnosticoFinal 
                        })
                        .eq('id', atendimentoId);
                    if (dbError) throw dbError;
                } else {
                    const { error: dbError } = await clienteSupabase
                        .from('atendimentos')
                        .insert([{ 
                            medico_crm: medicoCrm, 
                            nome_paciente: nomePaciente, 
                            anamnese: textoAnamnese, 
                            diagnostico_ia: diagnosticoFinal 
                        }]);
                    if (dbError) throw dbError;
                }

                alert('Consulta salva com sucesso!');
                window.location.href = 'pacientes.html';
            } catch (error) {
                console.error("Erro ao salvar consulta:", error);
                alert("Erro ao salvar: " + error.message);
            } finally {
                btnSalvarAnamnese.innerText = textoOriginal;
                btnSalvarAnamnese.disabled = false;
            }
        });
    }
});
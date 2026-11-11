document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica a autenticação e pega o CRM
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoCrm = authData.crm;

    // Elementos do DOM
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
    // FUNÇÃO: CALCULAR IDADE DINAMICAMENTE
    // ==========================================
    function calcularIdade(dataNascimentoStr) {
        if (!dataNascimentoStr) return '';
        const hoje = new Date();
        const nascimento = new Date(dataNascimentoStr + 'T12:00:00'); 
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
            idade--;
        }
        return idade >= 0 ? idade + " anos" : "Data inválida";
    }

    if (inputNascimento && inputIdade) {
        inputNascimento.addEventListener('change', () => {
            inputIdade.value = calcularIdade(inputNascimento.value);
        });
    }

    // ==========================================
    // IMPORTAR DADOS DA FILA DE ESPERA
    // ==========================================
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

                const matchNascimento = textoProntuario.match(/Nascimento:\s*([^\n]+)/);
                const matchDocumento = textoProntuario.match(/Documento:\s*([^\n]+)/);

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

                // Limpeza do texto do prontuário
                textoProntuario = textoProntuario.replace(/\[MÉDICO ALOCADO:.*?\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/\[TRIAGEM\/RECEPÇÃO\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/\[AVALIAÇÃO MÉDICA\]\n*/g, '');
                textoProntuario = textoProntuario.replace(/Nascimento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Documento:[^\n]*\n?/g, '');
                textoProntuario = textoProntuario.replace(/Motivo:\s*/g, '');
                textoProntuario = textoProntuario.replace(/\n{3,}/g, '\n\n').trim();

                if (inputAnamnese) {
                    inputAnamnese.value = textoProntuario;
                }
            }
        } catch (error) {
            console.error("Erro ao puxar dados da fila:", error);
        }
    }

    // ==========================================
    // SISTEMA DE ABAS E BOTÕES DE PDF
    // ==========================================
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

    // ==========================================
    // ANALISAR COM IA (GEMINI) E CONTROLO DE LOADING
    // ==========================================
    if (btnAnalisar) {
        btnAnalisar.addEventListener('click', async () => {
            const anamneseText = inputAnamnese ? inputAnamnese.value.trim() : '';
            
            if (!anamneseText) {
                alert("A Anamnese / Queixa Principal é obrigatória para a análise da IA.");
                return;
            }

            const idadeText = inputIdade ? inputIdade.value : 'Não informada';
            const sexoText = selectSexo ? selectSexo.value : 'Não informado';
            const historicoText = historicoInput ? historicoInput.value.trim() : 'Nenhum histórico prévio informado.';
            const laudoText = laudoInput ? laudoInput.value.trim() : 'Nenhum laudo ou exame complementar anexado.';

            const promptIA = `Você é um assistente médico especialista operando um Sistema de Suporte à Decisão Clínica (CDSS).
Sua função é analisar o caso clínico abaixo e fornecer uma avaliação estruturada para apoiar o médico titular.

DADOS DO PACIENTE:
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
4. **Exames Recomendados:** Liste os exames laboratoriais ou de imagem que o paciente deve realizar para confirmar as hipóteses ou avaliar o quadro, com uma breve justificativa para cada um.`;

            // ATIVA O LOADING VISUAL
            btnAnalisar.disabled = true;
            btnAnalisar.innerText = "A processar...";
            if (loading) loading.classList.remove('hidden');
            if (resultadoBox) resultadoBox.classList.add('hidden');

            try {
                // ============================================================
                // Substitua a linha abaixo pela sua chamada real à API do Gemini
                // ============================================================
                await new Promise(resolve => setTimeout(resolve, 2000)); // Simula tempo de espera de 2 segundos
                const respostaDaIA = "<strong>1. Resumo do Quadro:</strong> Paciente sob avaliação clínica.<br><strong>2. Hipóteses:</strong> A definir pelo médico.<br><strong>3. Conduta:</strong> Monitorização.<br><strong>4. Exames Recomendados:</strong> Hemograma completo."; 
                
                if (divResultadoTexto) divResultadoTexto.innerHTML = respostaDaIA;
                if (resultadoBox) resultadoBox.classList.remove('hidden');

            } catch (error) {
                console.error("Erro ao comunicar com a IA:", error);
                alert("Falha ao gerar análise. Verifique o console.");
            } finally {
                // DESATIVA O LOADING VISUAL
                btnAnalisar.disabled = false;
                btnAnalisar.innerText = "Analisar com IA e Salvar";
                if (loading) loading.classList.add('hidden');
            }
        });
    }

    // ==========================================
    // SALVAR A CONSULTA
    // ==========================================
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
                    const { error: dbError } = await clienteSupabase.from('atendimentos').insert([{
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
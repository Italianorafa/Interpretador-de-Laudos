// consulta.js
document.addEventListener("DOMContentLoaded", async () => {
    // Dar feedback visual quando o PDF é selecionado
    const pdfInput = document.getElementById('pdfInput');
    if (pdfInput) {
        pdfInput.addEventListener('change', function(e) {
            const hint = document.querySelector('.file-hint');
            if (e.target.files && e.target.files.length > 0) {
                const nomeFicheiro = e.target.files[0].name;
                hint.innerHTML = `✅ Ficheiro anexado: <strong>${nomeFicheiro}</strong>`;
                hint.style.color = 'var(--success)';
            } else {
                hint.innerHTML = `📄 Clique aqui para anexar o PDF do laudo laboratorial ou de imagem.`;
                hint.style.color = 'var(--text-muted)';
            }
        });
    }
    // 1. Verifica se está logado e pega o CRM
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAtualCrm = authData.crm;

    // 2. Extração de PDF
    const btnExtrairHistorico = document.getElementById('btnExtrairHistorico');
    const historicoPdfInput = document.getElementById('historicoPdfInput');
    const historicoInput = document.getElementById('historicoInput');
    const historicoLoading = document.getElementById('historicoLoading');

    btnExtrairHistorico.addEventListener('click', () => historicoPdfInput.click());

    historicoPdfInput.addEventListener('change', async () => {
        if (!historicoPdfInput.files.length) return;
        const file = historicoPdfInput.files[0];
        const reader = new FileReader();
        historicoLoading.classList.remove('hidden');
        
        reader.readAsDataURL(file);
        reader.onload = async function () {
            const base64Data = reader.result.split(',')[1];
            const promptExtracao = `Extraia APENAS o Histórico Médico Prévio em tópicos. Se não houver, retorne "Sem histórico".`;
            
            try {
                const response = await fetch(GEMINI_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptExtracao }, { inlineData: { mimeType: file.type, data: base64Data } }] }]
                    })
                });
                const data = await response.json();
                historicoInput.value = data.candidates[0].content.parts[0].text.trim();
            } catch (error) {
                alert('Erro ao extrair PDF.');
            } finally {
                historicoLoading.classList.add('hidden');
            }
        };
    });
    // Lógica para alternar as abas de exames
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    // 3. Salvar Anamnese (Sem IA)
    document.getElementById('btnSalvarAnamnese').addEventListener('click', async () => {
        const paciente = document.getElementById('perfilInput').value.trim();
        const anamnese = document.getElementById('anamneseInput').value.trim();
        
        if (!paciente || !anamnese) { alert('Preencha Paciente e Anamnese.'); return; }
        document.getElementById('loading').classList.remove('hidden');

        try {
            await clienteSupabase.from('atendimentos').insert([{ 
                medico_crm: medicoAtualCrm, nome_paciente: paciente, 
                anamnese: anamnese, diagnostico_ia: 'Primeira consulta realizada. (Sem IA)' 
            }]);
            alert('Prontuário salvo!');
            window.location.href = 'pacientes.html'; // Redireciona para ver o paciente na lista
        } catch (error) {
            alert("Erro ao salvar.");
        }
    });

    // 4. Analisar com IA (Suporta Texto ou PDF em anexo)
    document.getElementById('btnAnalisar').addEventListener('click', async () => {
        const paciente = document.getElementById('perfilInput').value.trim();
        const anamnese = document.getElementById('anamneseInput').value.trim();
        const historico = document.getElementById('historicoInput').value;
        const laudoTexto = document.getElementById('laudoInput').value;
        const fileInput = document.getElementById('pdfInput');
        
        if (!paciente || !anamnese) { 
            alert('Preencha o Nome do Paciente e a Anamnese.'); 
            return; 
        }
        
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('resultadoBox').classList.add('hidden');

        const promptBase = `Você é um Assistente Médico Avançado (CDSS). Com base nos dados fornecidos, dê uma Síntese Clínica, Hipóteses Diagnósticas (CID-10), Raciocínio Clínico e Conduta Sugerida.`;
        let dadosPaciente = `Paciente: ${paciente}\nHistórico: ${historico || 'Nega'}\nAnamnese: ${anamnese}\n`;

        // Verifica se a aba de PDF está ativa e se há um ficheiro selecionado
        const isPdfTabActive = document.getElementById('tab-pdf').classList.contains('active');

        if (isPdfTabActive && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.readAsDataURL(file);
            reader.onload = async function () {
                const base64Data = reader.result.split(',')[1];
                
                try {
                    const response = await fetch(GEMINI_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: promptBase },
                                    { text: dadosPaciente + "\n- Segue laudo de exame em anexo (PDF)." },
                                    { inlineData: { mimeType: file.type, data: base64Data } }
                                ]
                            }]
                        })
                    });

                    const data = await response.json();
                    if (data.error) throw new Error(data.error.message);

                    const respostaIA = data.candidates[0].content.parts[0].text;
                    exibirEGuardarResultado(paciente, anamnese, respostaIA);

                } catch (error) {
                    console.error(error);
                    alert('Erro ao processar o PDF com a IA.');
                    document.getElementById('loading').classList.add('hidden');
                }
            };
        } else {
            // Caso seja texto normal ou aba de texto
            if (isPdfTabActive === false && laudoTexto.trim()) {
                dadosPaciente += `Exames Laboratoriais: ${laudoTexto}`;
            }

            try {
                const response = await fetch(GEMINI_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: promptBase }, { text: dadosPaciente }]
                        }]
                    })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                const respostaIA = data.candidates[0].content.parts[0].text;
                exibirEGuardarResultado(paciente, anamnese, respostaIA);

            } catch (error) {
                console.error(error);
                alert('Erro no processamento da IA.');
                document.getElementById('loading').classList.add('hidden');
            }
        }
    });

    // Função auxiliar para exibir o resultado e salvar no Supabase
    async function exibirEGuardarResultado(paciente, anamnese, respostaIA) {
        document.getElementById('resultadoTexto').innerHTML = respostaIA
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        
        document.getElementById('resultadoBox').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');

        try {
            await clienteSupabase.from('atendimentos').insert([{ 
                medico_crm: medicoAtualCrm, 
                nome_paciente: paciente, 
                anamnese: anamnese, 
                diagnostico_ia: respostaIA 
            }]);
        } catch (dbError) {
            console.error("Erro ao salvar no banco:", dbError);
        }
    }
});
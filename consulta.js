// consulta.js
document.addEventListener("DOMContentLoaded", async () => {
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

    // 4. Analisar com IA
    document.getElementById('btnAnalisar').addEventListener('click', async () => {
        const paciente = document.getElementById('perfilInput').value.trim();
        const anamnese = document.getElementById('anamneseInput').value.trim();
        const historico = document.getElementById('historicoInput').value;
        
        if (!paciente || !anamnese) { alert('Preencha Paciente e Anamnese.'); return; }
        
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('resultadoBox').classList.add('hidden');

        const promptBase = `Baseado nos dados: Paciente: ${paciente}. Histórico: ${historico}. Anamnese: ${anamnese}. Dê uma Síntese Clínica, Hipóteses e Conduta.`;

        try {
            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptBase }] }] })
            });

            const data = await response.json();
            const respostaIA = data.candidates[0].content.parts[0].text;
            
            document.getElementById('resultadoTexto').innerHTML = respostaIA.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            document.getElementById('resultadoBox').classList.remove('hidden');

            await clienteSupabase.from('atendimentos').insert([{ 
                medico_crm: medicoAtualCrm, nome_paciente: paciente, 
                anamnese: anamnese, diagnostico_ia: respostaIA 
            }]);

        } catch (error) {
            alert('Erro no processamento da IA.');
        } finally {
            document.getElementById('loading').classList.add('hidden');
        }
    });
});
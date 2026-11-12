document.addEventListener("DOMContentLoaded", async () => {
    const inputNome = document.getElementById('nomePaciente');
    const inputDocumento = document.getElementById('documentoPaciente');
    const selectSexo = document.getElementById('sexoPaciente');
    const inputNascimento = document.getElementById('nascimentoPaciente');
    const inputMotivo = document.getElementById('motivoConsulta');
    
    const selectMedico = document.getElementById('selectMedico');
    const btnAdicionarFila = document.getElementById('btnAdicionarFila');

    // ==========================================
    // BUSCAR MÉDICOS DINAMICAMENTE
    // ==========================================
    async function carregarMedicos() {
        if (!selectMedico) return;

        try {
            selectMedico.innerHTML = '<option value="">A procurar médicos...</option>';

            // Usa a variável global fixada no window
            const { data: medicos, error } = await window.clienteSupabase
                .from('equipe') 
                .select('*');

            if (error) throw error;

            if (!medicos || medicos.length === 0) {
                selectMedico.innerHTML = '<option value="">Nenhum médico encontrado na equipe</option>';
                return;
            }

            selectMedico.innerHTML = '<option value="">Sem preferência (Fila Geral)</option>';
            
            medicos.forEach(medico => {
                const option = document.createElement('option');
                const valorCrm = medico.admin_crm || ''; 
                const nomeMedico = medico.nome || 'Sem Nome';
                
                option.value = valorCrm;
                option.textContent = `Dr(a). ${nomeMedico} (CRM: ${valorCrm})`;
                selectMedico.appendChild(option);
            });

        } catch (error) {
            console.error("Erro ao carregar médicos:", error);
            selectMedico.innerHTML = '<option value="">Falha ao carregar lista</option>';
        }
    }

    carregarMedicos();

    // ==========================================
    // SALVAR E ENVIAR AO MÉDICO
    // ==========================================
    if (btnAdicionarFila) {
        btnAdicionarFila.addEventListener('click', async () => {
            const nome = inputNome ? inputNome.value.trim() : '';
            const documento = inputDocumento ? inputDocumento.value.trim() : 'Não informado';
            const sexo = selectSexo ? selectSexo.value : 'Não informado';
            const nascimento = inputNascimento && inputNascimento.value ? inputNascimento.value : 'Não informada';
            const motivo = inputMotivo ? inputMotivo.value.trim() : 'Sem motivo registado';
            const medicoCrmSelecionado = selectMedico ? selectMedico.value : null; 

            if (!nome) {
                alert("O Nome do Paciente é obrigatório.");
                return;
            }

            const textoOriginal = btnAdicionarFila.innerText;
            btnAdicionarFila.innerText = "A enviar para o consultório...";
            btnAdicionarFila.disabled = true;

            try {
                let textoTriagem = `[TRIAGEM/RECEPÇÃO]\nDocumento: ${documento}\nNascimento: ${nascimento}\nSexo: ${sexo}\nMotivo: ${motivo}`;
                
                if (medicoCrmSelecionado && selectMedico.options[selectMedico.selectedIndex]) {
                    const nomeMedico = selectMedico.options[selectMedico.selectedIndex].text;
                    textoTriagem = `[MÉDICO ALOCADO: ${nomeMedico}]\n\n` + textoTriagem;
                }

                const dadosInsercao = {
                    nome_paciente: nome,
                    anamnese: textoTriagem,
                    status: 'aguardando'
                };

                if (medicoCrmSelecionado) {
                    dadosInsercao.medico_crm = medicoCrmSelecionado;
                }

                const { error: dbError } = await window.clienteSupabase
                    .from('atendimentos')
                    .insert([dadosInsercao]);

                if (dbError) throw dbError;

                alert(`Ficha salva! O paciente ${nome} foi encaminhado com sucesso.`);
                
                if (inputNome) inputNome.value = '';
                if (inputDocumento) inputDocumento.value = '';
                if (selectSexo) selectSexo.value = '';
                if (inputNascimento) inputNascimento.value = '';
                if (inputMotivo) inputMotivo.value = '';
                if (selectMedico) selectMedico.value = '';

            } catch (error) {
                console.error("Erro ao enviar paciente:", error);
                alert("Erro ao adicionar paciente: " + error.message);
            } finally {
                btnAdicionarFila.innerText = textoOriginal;
                btnAdicionarFila.disabled = false;
            }
        });
    }
});
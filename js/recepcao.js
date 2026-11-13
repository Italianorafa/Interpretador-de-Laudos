document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtém os dados de autenticação
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const tenantCrm = authData.crm;

    const inputNome = document.getElementById('recNome');
    const inputDocumento = document.getElementById('recDocumento');
    const inputNascimento = document.getElementById('recNascimento');
    const selectSexo = document.getElementById('sexoPaciente');
    const inputContato = document.getElementById('recContato');
    
    const inputMedico = document.getElementById('recMedicoSelecionado');
    const datalistMedicos = document.getElementById('listaMedicosDatalist');
    
    const inputMotivo = document.getElementById('recMotivo');
    const btnSalvar = document.getElementById('btnSalvarAdmissao');
    const btnBuscarPaciente = document.getElementById('btnBuscarPaciente');

    // ==========================================
    // 2. CARREGAR MÉDICOS NA LISTA
    // ==========================================
    async function carregarMedicos() {
        if (!datalistMedicos) return;

        try {
            const { data: medicos, error } = await window.clienteSupabase
                .from('equipe') 
                .select('*')
                .eq('admin_crm', tenantCrm);

            if (error) throw error;
            
            datalistMedicos.innerHTML = ''; 
            const optionTitular = document.createElement('option');
            optionTitular.value = "Médico Titular";
            datalistMedicos.appendChild(optionTitular);

            if (medicos && medicos.length > 0) {
                medicos.forEach(membro => {
                    if (membro.nivel_acesso === 'Total' || membro.cargo.toLowerCase().includes('médico')) {
                        const option = document.createElement('option');
                        option.value = `Dr(a). ${membro.nome}`; 
                        datalistMedicos.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao carregar médicos:", error);
        }
    }
    carregarMedicos();

    // ==========================================
    // 3. BUSCAR CADASTRO DO PACIENTE POR CPF
    // ==========================================
    if (btnBuscarPaciente) {
        btnBuscarPaciente.addEventListener('click', async () => {
            const docBusca = inputDocumento ? inputDocumento.value.trim() : '';
            if (!docBusca) {
                alert("Por favor, digite o CPF/Documento antes de clicar em buscar.");
                return;
            }

            const textoOriginal = btnBuscarPaciente.innerText;
            btnBuscarPaciente.innerText = "⏳";
            btnBuscarPaciente.disabled = true;

            try {
                const { data, error } = await window.clienteSupabase
                    .from('pacientes')
                    .select('*')
                    .eq('documento', docBusca)
                    .single(); // Puxa apenas 1 registo

                if (data) {
                    // Preenche os campos automaticamente
                    if (inputNome) inputNome.value = data.nome_completo || '';
                    if (inputNascimento && data.data_nascimento) inputNascimento.value = data.data_nascimento;
                    if (selectSexo && data.sexo) selectSexo.value = data.sexo;
                    if (inputContato) inputContato.value = data.contato || '';
                    
                    // Alerta visual discreto (opcional, pode remover se achar chato)
                    alert(`✅ Cadastro de ${data.nome_completo} encontrado!`);
                } else {
                    alert("Este paciente não tem cadastro. Pode preencher os dados, ele será guardado automaticamente ao salvar a ficha.");
                }
            } catch (error) {
                // O Supabase retorna erro se não encontrar a linha, é normal
                alert("Paciente não encontrado. Novo cadastro será gerado.");
            } finally {
                btnBuscarPaciente.innerText = "🔍 Buscar";
                btnBuscarPaciente.disabled = false;
            }
        });
    }

    // ==========================================
    // 4. SALVAR CADASTRO E ENVIAR PARA A FILA
    // ==========================================
    if (btnSalvar) {
        btnSalvar.addEventListener('click', async () => {
            const nome = inputNome ? inputNome.value.trim() : '';
            const documento = inputDocumento ? inputDocumento.value.trim() : '';
            const nascimento = inputNascimento && inputNascimento.value ? inputNascimento.value : null;
            const sexo = selectSexo && selectSexo.value ? selectSexo.value : null;
            const contato = inputContato ? inputContato.value.trim() : null;
            const motivo = inputMotivo ? inputMotivo.value.trim() : 'Sem motivo registado';
            const medicoSelecionado = inputMedico ? inputMedico.value.trim() : null; 

            if (!nome) {
                alert("O Nome do Paciente é obrigatório.");
                return;
            }

            const textoOriginal = btnSalvar.innerText;
            btnSalvar.innerText = "A processar...";
            btnSalvar.disabled = true;

            try {
                // ETAPA A: ATUALIZAR OU CRIAR O PERFIL DO PACIENTE (Se houver Documento)
                if (documento) {
                    const { error: pacienteError } = await window.clienteSupabase
                        .from('pacientes')
                        .upsert([{
                            documento: documento,
                            nome_completo: nome,
                            data_nascimento: nascimento,
                            sexo: sexo,
                            contato: contato
                        }], { onConflict: 'documento' });

                    if (pacienteError) {
                        console.error("Erro ao salvar cadastro do paciente:", pacienteError);
                    }
                }

                // ETAPA B: ENVIAR PARA A FILA DE ESPERA
                let textoTriagem = `[TRIAGEM/RECEPÇÃO]\nDocumento: ${documento || 'Não informado'}\nNascimento: ${nascimento || 'Não informada'}\nSexo: ${sexo || 'Não informado'}\nContato: ${contato || 'Não informado'}\nMotivo: ${motivo}`;
                
                if (medicoSelecionado) {
                    textoTriagem = `[MÉDICO ALOCADO: ${medicoSelecionado}]\n\n` + textoTriagem;
                }

                const dadosInsercao = {
                    nome_paciente: nome,
                    anamnese: textoTriagem,
                    diagnostico_ia: 'Aguardando avaliação médica.', // Tag correta para o fila.js ler
                    medico_crm: tenantCrm 
                };

                const { error: dbError } = await window.clienteSupabase
                    .from('atendimentos')
                    .insert([dadosInsercao]);

                if (dbError) throw dbError;

                alert(`Ficha salva! O paciente ${nome} foi cadastrado e encaminhado com sucesso.`);
                
                // Limpa o formulário
                if (inputNome) inputNome.value = '';
                if (inputDocumento) inputDocumento.value = '';
                if (inputNascimento) inputNascimento.value = '';
                if (selectSexo) selectSexo.value = '';
                if (inputContato) inputContato.value = '';
                if (inputMotivo) inputMotivo.value = '';
                if (inputMedico) inputMedico.value = '';

            } catch (error) {
                console.error("Erro ao enviar paciente:", error);
                alert("Erro ao adicionar paciente: " + error.message);
            } finally {
                btnSalvar.innerText = textoOriginal;
                btnSalvar.disabled = false;
            }
        });
    }
});

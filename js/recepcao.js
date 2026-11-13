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
    const selectPrioridade = document.getElementById('recPrioridade');
    
    const inputMotivo = document.getElementById('recMotivo');
    const btnSalvar = document.getElementById('btnSalvarAdmissao');
    const btnBuscarPaciente = document.getElementById('btnBuscarPaciente');

    // Mapa local para permitir busca tanto por Nome quanto por CRM
    let listaMedicosClinica = [];

    // ==========================================
    // 2. CARREGAR MÉDICOS NA LISTA (NOME + CRM)
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
            listaMedicosClinica = [];

            // 1. Adiciona o Médico Titular com o CRM da Clínica
            const labelTitular = `Médico Titular (CRM: ${tenantCrm})`;
            listaMedicosClinica.push({
                exibicao: labelTitular,
                nomeAlocacao: "Médico Titular",
                crm: tenantCrm.toLowerCase(),
                nome: "médico titular"
            });

            const optionTitular = document.createElement('option');
            optionTitular.value = labelTitular;
            datalistMedicos.appendChild(optionTitular);

            // 2. Adiciona os médicos cadastrados na equipe com seus respectivos CRMs
            if (medicos && medicos.length > 0) {
                medicos.forEach(membro => {
                    const cargoStr = membro.cargo || '';
                    if (membro.nivel_acesso === 'Total' || cargoStr.toLowerCase().includes('médico')) {
                        // Extrai CRM se estiver salvo no cargo, ex: "Médico Plantonista (CRM: 12345-SP)" ou no nome
                        const matchCrmCargo = cargoStr.match(/CRM:\s*([^\)]+)/i);
                        const matchCrmNome = (membro.nome || '').match(/CRM:\s*([^\)]+)/i);
                        const crmExtraido = matchCrmCargo
                            ? matchCrmCargo[1].trim()
                            : (matchCrmNome ? matchCrmNome[1].trim() : tenantCrm);

                        const nomeLimpo = (membro.nome || '').replace(/\s*\(CRM:.*?\)/i, '').trim();
                        const nomeAlocacao = `Dr(a). ${nomeLimpo}`;
                        const labelOpcao = `${nomeAlocacao} (CRM: ${crmExtraido})`;

                        listaMedicosClinica.push({
                            exibicao: labelOpcao,
                            nomeAlocacao: labelOpcao,
                            crm: crmExtraido.toLowerCase(),
                            nome: nomeLimpo.toLowerCase()
                        });

                        const option = document.createElement('option');
                        option.value = labelOpcao;
                        datalistMedicos.appendChild(option);
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao carregar médicos:", error);
        }
    }
    carregarMedicos();

    // Se o utilizador digitar apenas o número do CRM no campo e sair dele, autocompleta com o médico correspondente
    if (inputMedico) {
        inputMedico.addEventListener('change', () => {
            const termo = inputMedico.value.trim().toLowerCase();
            if (!termo) return;
            const encontrado = listaMedicosClinica.find(m =>
                m.exibicao.toLowerCase() === termo ||
                m.crm === termo ||
                m.crm.includes(termo) ||
                m.nome.includes(termo)
            );
            if (encontrado) {
                inputMedico.value = encontrado.exibicao;
            }
        });
    }

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
                const docApenasNumeros = docBusca.replace(/\D/g, '');
                const docFormatado = window.formatarCPF ? window.formatarCPF(docApenasNumeros) : docBusca;

                const { data: listaEncontrada, error } = await window.clienteSupabase
                    .from('pacientes')
                    .select('*')
                    .in('documento', [docBusca, docFormatado, docApenasNumeros])
                    .limit(1);

                const data = listaEncontrada && listaEncontrada.length > 0 ? listaEncontrada[0] : null;

                if (data) {
                    // Preenche os campos automaticamente
                    if (inputNome) inputNome.value = data.nome_completo || '';
                    if (inputNascimento && data.data_nascimento) inputNascimento.value = data.data_nascimento;
                    if (selectSexo && data.sexo) selectSexo.value = data.sexo;
                    if (inputContato) inputContato.value = data.contato || '';
                    
                    alert(`✅ Cadastro de ${data.nome_completo} encontrado!`);
                } else {
                    alert("Este paciente não tem cadastro. Pode preencher os dados, ele será guardado automaticamente ao salvar a ficha.");
                }
            } catch (error) {
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
            const prioridade = selectPrioridade && selectPrioridade.value ? selectPrioridade.value : 'Verde';
            const motivo = inputMotivo ? inputMotivo.value.trim() : 'Sem motivo registado';
            let medicoSelecionado = inputMedico ? inputMedico.value.trim() : null; 

            if (!nome) {
                alert("O Nome do Paciente é obrigatório.");
                return;
            }

            // Resolve caso a recepção tenha digitado apenas o número do CRM sem clicar na sugestão
            if (medicoSelecionado) {
                const termo = medicoSelecionado.toLowerCase();
                const encontrado = listaMedicosClinica.find(m =>
                    m.exibicao.toLowerCase() === termo ||
                    m.crm === termo ||
                    m.crm.includes(termo) ||
                    m.nome.includes(termo)
                );
                if (encontrado) {
                    medicoSelecionado = encontrado.exibicao;
                }
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
                let textoTriagem = `[PRIORIDADE: ${prioridade}]\n[TRIAGEM/RECEPÇÃO]\nDocumento: ${documento || 'Não informado'}\nNascimento: ${nascimento || 'Não informada'}\nSexo: ${sexo || 'Não informado'}\nContato: ${contato || 'Não informado'}\nMotivo: ${motivo}`;
                
                if (medicoSelecionado) {
                    textoTriagem = `[MÉDICO ALOCADO: ${medicoSelecionado}]\n` + textoTriagem;
                }

                const dadosInsercao = {
                    nome_paciente: nome,
                    anamnese: textoTriagem,
                    diagnostico_ia: 'Aguardando avaliação médica.',
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
                if (selectPrioridade) selectPrioridade.value = 'Verde';

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

document.addEventListener("DOMContentLoaded", async () => {
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const crmClinica = authData.crm; // O CRM atua como a "Chave da Clínica"

    const btnSalvar = document.getElementById('btnSalvarAdmissao');
    const datalist = document.getElementById('listaMedicosDatalist');

    // 1. CARREGAR A LISTA DE MÉDICOS DINAMICAMENTE
    async function carregarMedicos() {
        // Primeiro, adiciona o próprio Médico Titular (Dono da clínica)
        datalist.innerHTML = `<option value="Dr(a). Titular - CRM: ${crmClinica}">`;

        // Depois, busca no Supabase todos os membros da equipe que são Médicos (Acesso Total)
        const { data, error } = await clienteSupabase
            .from('equipe')
            .select('nome, cargo')
            .eq('admin_crm', crmClinica)
            .eq('nivel_acesso', 'Total');

        if (!error && data) {
            data.forEach(med => {
                // Preenche a lista com o Nome e o Cargo. 
                // Dica: Se quiser que o CRM do plantonista seja buscável, basta colocar o CRM no nome ou cargo lá nas Configurações!
                datalist.innerHTML += `<option value="${med.nome} (${med.cargo})">`;
            });
        }
    }
    
    // Executa a busca assim que a página abre
    carregarMedicos();

    // 2. SALVAR A FICHA E ENVIAR PARA O MÉDICO
    btnSalvar.addEventListener('click', async () => {
        const medicoEscolhido = document.getElementById('recMedicoSelecionado').value.trim();
        const nome = document.getElementById('recNome').value.trim();
        const nascimento = document.getElementById('recNascimento').value;
        const documento = document.getElementById('recDocumento').value.trim();
        const motivo = document.getElementById('recMotivo').value.trim();

        // Validação extra
        if (!nome || !motivo || !medicoEscolhido) {
            alert('Por favor, preencha o Médico Responsável, o Nome do Paciente e o Motivo da Consulta.');
            return;
        }

        // Criamos uma tag visual no início da anamnese para o médico saber que foi direcionado a ele
        const textoAnamneseInicial = `[MÉDICO ALOCADO: ${medicoEscolhido}]\n\n[TRIAGEM/RECEPÇÃO]\nNascimento: ${nascimento}\nDocumento: ${documento}\nMotivo: ${motivo}`;

        btnSalvar.innerText = "Salvando...";
        btnSalvar.disabled = true;

        try {
            // Grava na mesma tabela de atendimentos
            const { error } = await clienteSupabase.from('atendimentos').insert([{
                medico_crm: crmClinica,
                nome_paciente: nome,
                anamnese: textoAnamneseInicial,
                diagnostico_ia: 'Aguardando avaliação médica.'
            }]);

            if (error) throw error;

            alert('Ficha criada! O paciente já aparece no painel do médico selecionado.');
            
            // Limpa o formulário para o próximo paciente
            document.getElementById('recMedicoSelecionado').value = '';
            document.getElementById('recNome').value = '';
            document.getElementById('recNascimento').value = '';
            document.getElementById('recDocumento').value = '';
            document.getElementById('recMotivo').value = '';

        } catch (error) {
            console.error(error);
            alert("Erro ao criar a ficha de admissão.");
        } finally {
            btnSalvar.innerText = "Salvar e Enviar para o Médico";
            btnSalvar.disabled = false;
        }
    });
});
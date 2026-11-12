document.addEventListener("DOMContentLoaded", async () => {
    // 1. Obtém Identidade do Médico
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoCrm = authData.crm;
    
    const metadata = authData.session.user.user_metadata;
    const nomeUsuarioLogado = metadata.nome_completo;
    const nomeFormatadoLogado = nomeUsuarioLogado ? `Dr(a). ${nomeUsuarioLogado}` : "Médico Titular";

    const listaContainer = document.getElementById('listaPacientesContainer');
    const tabelaCrud = document.getElementById('tabelaPacientesCrud');
    const detalhesContainer = document.getElementById('detalhesPacienteContainer');
    const btnVoltar = document.getElementById('btnVoltarPacientes');
    const timeline = document.getElementById('timelineProntuario');
    const tituloNome = document.getElementById('tituloNomePaciente');

    if (btnVoltar) {
        btnVoltar.addEventListener('click', () => {
            detalhesContainer.classList.add('hidden');
            listaContainer.classList.remove('hidden');
        });
    }

    function calcularIdade(dataNascimentoStr) {
        if (!dataNascimentoStr || dataNascimentoStr === 'Não informada' || dataNascimentoStr === 'null' || dataNascimentoStr === '---') return '---';
        const hoje = new Date();
        const nascimento = new Date(dataNascimentoStr + 'T12:00:00');
        if (isNaN(nascimento)) return '---';
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mes = hoje.getMonth() - nascimento.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) idade--;
        return idade + " anos";
    }

    async function carregarPacientes() {
        try {
            if (tabelaCrud) tabelaCrud.innerHTML = '<tr><td colspan="4" style="text-align:center;">A carregar pacientes...</td></tr>';

            // 1. Busca os atendimentos concluídos deste médico
            const { data: consultas, error: erroConsultas } = await window.clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('medico_crm', medicoCrm)
                .eq('nome_medico', nomeFormatadoLogado)
                .neq('diagnostico_ia', 'Aguardando avaliação médica.')
                .order('created_at', { ascending: false });

            if (erroConsultas) throw erroConsultas;

            if (!consultas || consultas.length === 0) {
                if (tabelaCrud) tabelaCrud.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum histórico de pacientes cadastrado para si.</td></tr>';
                return;
            }

            // 2. Busca a base de dados oficial de PACIENTES (para puxar CPF e Data de Nascimento)
            const { data: basePacientes, error: erroPacientes } = await window.clienteSupabase
                .from('pacientes')
                .select('*');
            
            if (erroPacientes) console.error("Erro ao puxar base de pacientes:", erroPacientes);

            // 3. Agrupa as consultas do mesmo paciente numa única linha
            const pacientesAgrupados = {};

            consultas.forEach(consulta => {
                const nome = consulta.nome_paciente;
                
                if (!pacientesAgrupados[nome]) {
                    let cpf = '---';
                    let nascimento = '---';
                    
                    // Cruza os dados: procura o nome do paciente na tabela oficial de cadastros
                    if (basePacientes) {
                        const perfil = basePacientes.find(p => p.nome_completo === nome);
                        if (perfil) {
                            cpf = perfil.documento || '---';
                            nascimento = perfil.data_nascimento || '---';
                        }
                    }

                    // Fallback: se não achar no cadastro, tenta ler de consultas antigas
                    if (cpf === '---' && consulta.anamnese) {
                        const matchDoc = consulta.anamnese.match(/Documento:\s*([^\n]+)/);
                        const matchNasc = consulta.anamnese.match(/Nascimento:\s*([^\n]+)/);
                        if (matchDoc) cpf = matchDoc[1].trim();
                        if (matchNasc) nascimento = matchNasc[1].trim();
                    }

                    pacientesAgrupados[nome] = {
                        nome: nome,
                        cpf: cpf,
                        idade: calcularIdade(nascimento),
                        historicoConsultas: []
                    };
                }
                
                pacientesAgrupados[nome].historicoConsultas.push(consulta);
            });

            window.dadosPacientes = pacientesAgrupados;

            // 4. Desenha a tabela com os dados corretos
            if (tabelaCrud) {
                tabelaCrud.innerHTML = '';
                Object.values(pacientesAgrupados).forEach(paciente => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${paciente.nome}</strong></td>
                        <td>${paciente.idade}</td>
                        <td>${paciente.cpf}</td>
                        <td style="text-align: center;">
                            <button class="btn-secondary" onclick="abrirHistorico('${paciente.nome}')" style="color: var(--primary); border-color: var(--primary);">
                                📖 Ver Histórico
                            </button>
                        </td>
                    `;
                    tabelaCrud.appendChild(tr);
                });
            }

        } catch (error) {
            console.error("Erro ao carregar pacientes:", error);
            if (tabelaCrud) tabelaCrud.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao carregar lista.</td></tr>';
        }
    }

    window.abrirHistorico = function(nomePaciente) {
        const paciente = window.dadosPacientes[nomePaciente];
        if (!paciente) return;

        tituloNome.innerText = `Prontuário: ${paciente.nome}`;
        timeline.innerHTML = '';

        paciente.historicoConsultas.forEach(consulta => {
            const dataObj = new Date(consulta.created_at);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR');
            const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            let anamneseLimpa = consulta.anamnese || '';
            anamneseLimpa = anamneseLimpa.replace(/\[TRIAGEM\/RECEPÇÃO\]\n*/g, '');
            anamneseLimpa = anamneseLimpa.replace(/\[MÉDICO ALOCADO:.*?\]\n*/g, '');
            anamneseLimpa = anamneseLimpa.replace(/Documento:[^\n]*\n?/g, '');
            anamneseLimpa = anamneseLimpa.replace(/Nascimento:[^\n]*\n?/g, '');
            anamneseLimpa = anamneseLimpa.replace(/Sexo:[^\n]*\n?/g, '');
            anamneseLimpa = anamneseLimpa.replace(/Contato:[^\n]*\n?/g, '');
            anamneseLimpa = anamneseLimpa.replace(/Motivo:\s*/g, '');
            anamneseLimpa = anamneseLimpa.trim();

            const card = document.createElement('div');
            card.className = 'timeline-card';
            card.innerHTML = `
                <div class="timeline-header">
                    <div class="timeline-date">📅 ${dataFormatada} às ${horaFormatada}</div>
                </div>
                <div class="timeline-body">
                    <p><strong>Queixa / Anamnese:</strong><br>${anamneseLimpa.replace(/\n/g, '<br>')}</p>
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-top: 15px;">
                        <strong>🧠 Diagnóstico / Conduta IA:</strong><br>
                        ${consulta.diagnostico_ia ? consulta.diagnostico_ia.replace(/\n/g, '<br>') : 'Nenhum diagnóstico registado.'}
                    </div>
                </div>
            `;
            timeline.appendChild(card);
        });

        listaContainer.classList.add('hidden');
        detalhesContainer.classList.remove('hidden');
    };

    carregarPacientes();
});
// pacientes.js
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica se está logado e pega o CRM
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAtualCrm = authData.crm;

    const tabela = document.getElementById('tabelaPacientesCrud');
    const timeline = document.getElementById('timelineProntuario');

    // 2. Carregar Lista Inicial
    async function carregarLista() {
        tabela.innerHTML = '<tr><td colspan="3" style="text-align:center;">A procurar pacientes...</td></tr>';
        document.getElementById('listaPacientesContainer').classList.remove('hidden');
        document.getElementById('detalhesPacienteContainer').classList.add('hidden');

        const { data, error } = await clienteSupabase.from('atendimentos').select('*').eq('medico_crm', medicoAtualCrm);
        
        if (error || !data || data.length === 0) {
            tabela.innerHTML = `<tr><td colspan="3" style="text-align:center;">Nenhum paciente encontrado.</td></tr>`;
            return;
        }

        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const pacientesMap = {};
        data.forEach(atend => {
            const nome = (atend.nome_paciente || 'Desconhecido').trim();
            if(!pacientesMap[nome.toUpperCase()]) {
                pacientesMap[nome.toUpperCase()] = { nome, dataStr: new Date(atend.created_at).toLocaleDateString('pt-BR') };
            }
        });

        tabela.innerHTML = '';
        Object.values(pacientesMap).forEach(paciente => {
            tabela.innerHTML += `
                <tr>
                    <td><strong>${paciente.nome}</strong></td>
                    <td>${paciente.dataStr}</td>
                    <td class="crud-actions">
                        <button class="btn-icon open" onclick="abrirProntuario('${paciente.nome}')">📂 Abrir Prontuário</button>
                    </td>
                </tr>
            `;
        });
    }

    // 3. Abrir Prontuário (Timeline) - Exposta globalmente para o onClick do HTML
    window.abrirProntuario = async function(nome) {
        document.getElementById('listaPacientesContainer').classList.add('hidden');
        document.getElementById('detalhesPacienteContainer').classList.remove('hidden');
        document.getElementById('tituloNomePaciente').innerText = `Prontuário: ${nome}`;
        timeline.innerHTML = '<p class="loading-text" style="text-align:center;">A carregar histórico...</p>';

        const { data } = await clienteSupabase.from('atendimentos')
            .select('*').eq('medico_crm', medicoAtualCrm).ilike('nome_paciente', nome);

        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        timeline.innerHTML = '';

        data.forEach(atend => {
            const dataHora = new Date(atend.created_at).toLocaleString('pt-BR');
            const diagIA = atend.diagnostico_ia ? atend.diagnostico_ia.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') : 'N/A';

            timeline.innerHTML += `
                <div class="timeline-card">
                    <div class="timeline-header">
                        <div class="timeline-date">📅 ${dataHora}</div>
                        <button class="btn-icon delete" onclick="deletarAtendimento(${atend.id}, '${nome}')">🗑️</button>
                    </div>
                    <div class="timeline-body">
                        <p><strong>Anamnese:</strong><br> ${atend.anamnese || 'N/A'}</p>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #bbf7d0; margin-top: 15px;">
                            <p style="margin-bottom:0;"><strong style="color: #166534;">Análise:</strong><br> ${diagIA}</p>
                        </div>
                    </div>
                </div>
            `;
        });
    };

    // 4. Voltar e Deletar
    document.getElementById('btnVoltarPacientes').addEventListener('click', carregarLista);

    window.deletarAtendimento = async function(id, nome) {
        if(!confirm("Eliminar esta consulta permanentemente?")) return;
        await clienteSupabase.from('atendimentos').delete().eq('id', id);
        abrirProntuario(nome); 
    };

    // Inicia a tabela assim que carrega
    carregarLista();
});
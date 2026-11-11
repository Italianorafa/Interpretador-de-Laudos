document.addEventListener("DOMContentLoaded", async () => {
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAdminCrm = authData.crm;
    
    // Tornamos a função global para poder ser chamada pelo botão "Atualizar Fila" no HTML
    window.carregarFila = async function() {
        const grid = document.getElementById('gridFilaEspera');
        grid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted);">A carregar pacientes na fila...</p>';

        try {
            // Busca apenas os pacientes do CRM atual que ainda não foram atendidos
            const { data: pacientes, error } = await clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('medico_crm', medicoAdminCrm)
                .eq('diagnostico_ia', 'Aguardando avaliação médica.')
                .order('created_at', { ascending: true }); // Ordena do mais antigo (quem chegou primeiro) para o mais novo

            if (error) throw error;

            grid.innerHTML = '';

            if (!pacientes || pacientes.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: span 3; text-align: center; padding: 40px; background: white; border-radius: 12px; border: 1px dashed var(--border);">
                        <span style="font-size: 40px; display: block; margin-bottom: 10px;">☕</span>
                        <h3 style="color: var(--text);">Fila Vazia</h3>
                        <p style="color: var(--text-muted);">Nenhum paciente a aguardar atendimento no momento.</p>
                    </div>`;
                return;
            }

            pacientes.forEach(paciente => {
                // Formatar a hora de chegada
                const dataChegada = new Date(paciente.created_at);
                const horaFormatada = dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // Extrair o nome do médico selecionado se a receção o tiver adicionado na anamnese
                let medicoAlocado = "Qualquer Médico";
                if (paciente.anamnese && paciente.anamnese.includes('[MÉDICO ALOCADO:')) {
                    const match = paciente.anamnese.match(/\[MÉDICO ALOCADO:\s(.*?)\]/);
                    if (match) medicoAlocado = match[1];
                }

                // Cria o cartão (Card) do paciente
                const card = document.createElement('div');
                card.style.cssText = "background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;";
                
                card.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: var(--primary); font-size: 18px;">${paciente.nome_paciente}</h3>
                            <span class="badge-consultas" style="background: #fef2f2; color: #991b1b; white-space: nowrap;">Chegou às ${horaFormatada}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text); margin-bottom: 10px;">
                            <strong>Direcionado a:</strong> ${medicoAlocado}
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; padding: 10px; border-radius: 6px; max-height: 80px; overflow-y: auto; margin-bottom: 20px;">
                            ${paciente.anamnese.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    <button class="action-btn" onclick="iniciarAtendimento(${paciente.id})" style="width: 100%; text-align: center; padding: 12px;">
                        👨‍⚕️ Iniciar Atendimento
                    </button>
                `;
                grid.appendChild(card);
            });

        } catch (error) {
            console.error("Erro ao carregar fila:", error);
            grid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: red;">Erro ao carregar a fila de espera.</p>';
        }
    };

    // Função para direcionar o médico para a tela de consulta com o ID do paciente
    window.iniciarAtendimento = function(idAtendimento) {
        // Redireciona para a página de consulta passando o ID do atendimento no URL (via Query Parameter)
        window.location.href = `consulta.html?atendimento_id=${idAtendimento}`;
    };

    // Carrega a fila automaticamente ao abrir a página
    carregarFila();
});
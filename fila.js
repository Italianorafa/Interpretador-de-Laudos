document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica quem está logado
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAdminCrm = authData.crm;
    
    // 2. Descobrir a identidade do utilizador logado
    const metadata = authData.session.user.user_metadata;
    // A conta raiz (criada no login) não tem 'acesso_level' definido no momento da criação
    const isContaTitular = !metadata.acesso_level; 
    const nomeUsuarioLogado = metadata.nome_completo;
    const nomeFormatadoLogado = nomeUsuarioLogado ? `Dr(a). ${nomeUsuarioLogado}` : "Médico Titular";
    
    window.carregarFila = async function() {
        const grid = document.getElementById('gridFilaEspera');
        grid.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-muted);">A carregar pacientes na fila...</p>';

        try {
            // Busca TODOS os pacientes da clínica que estão aguardando
            const { data: pacientes, error } = await window.clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('medico_crm', medicoAdminCrm)
                .eq('diagnostico_ia', 'Aguardando avaliação médica.')
                .order('created_at', { ascending: true });

            if (error) throw error;

            grid.innerHTML = '';

            // ==========================================
            // FILTRO INTELIGENTE DE DIRECIONAMENTO
            // ==========================================
            const pacientesParaMim = pacientes.filter(paciente => {
                const anamnese = paciente.anamnese || "";
                const match = anamnese.match(/\[MÉDICO ALOCADO:\s(.*?)\]/);
                
                // Se o paciente FOI direcionado a alguém específico na receção
                if (match) {
                    const medicoAlocado = match[1].trim();
                    
                    // 1. Se foi direcionado exatamente para o meu nome
                    if (medicoAlocado === nomeFormatadoLogado) return true;
                    
                    // 2. Se foi direcionado ao "Médico Titular" e eu sou o dono da clínica
                    if (medicoAlocado === "Médico Titular" && isContaTitular) return true;
                    
                    // 3. Se tem o nome de outro médico, ESCONDE!
                    return false;
                }
                
                // Se NÃO TEM a tag (Fila Geral), mostra para todos os médicos
                return true;
            });

            // ==========================================
            // RENDERIZAR A TELA
            // ==========================================
            if (!pacientesParaMim || pacientesParaMim.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: span 3; text-align: center; padding: 40px; background: white; border-radius: 12px; border: 1px dashed var(--border);">
                        <span style="font-size: 40px; display: block; margin-bottom: 10px;">☕</span>
                        <h3 style="color: var(--text);">Fila Vazia</h3>
                        <p style="color: var(--text-muted);">Nenhum paciente a aguardar atendimento direcionado a si no momento.</p>
                    </div>`;
                return;
            }

            pacientesParaMim.forEach(paciente => {
                const dataChegada = new Date(paciente.created_at);
                const horaFormatada = dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                let medicoAlocado = "Fila Geral";
                if (paciente.anamnese && paciente.anamnese.includes('[MÉDICO ALOCADO:')) {
                    const match = paciente.anamnese.match(/\[MÉDICO ALOCADO:\s(.*?)\]/);
                    if (match) medicoAlocado = match[1];
                }

                const card = document.createElement('div');
                card.style.cssText = "background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;";
                
                card.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: var(--primary); font-size: 18px;">${paciente.nome_paciente}</h3>
                            <span class="badge-consultas" style="background: #fef2f2; color: #991b1b; white-space: nowrap;">Chegou às ${horaFormatada}</span>
                        </div>
                        <div style="font-size: 14px; color: var(--text); margin-bottom: 10px;">
                            <strong>Direcionado a:</strong> <span style="color: var(--primary); font-weight: 600;">${medicoAlocado}</span>
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

    window.iniciarAtendimento = function(idAtendimento) {
        window.location.href = `consulta.html?atendimento_id=${idAtendimento}`;
    };

    carregarFila();
});
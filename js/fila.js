document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica quem está logado
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAdminCrm = authData.crm;
    const nivelAcesso = authData.nivelAcesso;
    
    // 2. Descobrir a identidade do utilizador logado
    const metadata = authData.session.user.user_metadata;
    // A conta raiz (criada no login) não tem 'acesso_level' definido no momento da criação
    const isContaTitular = authData.isContaTitular !== undefined ? authData.isContaTitular : !metadata.acesso_level; 
    const isAdmin = isContaTitular || nivelAcesso === 'Administrativo';
    const nomeUsuarioLogado = authData.nome || metadata.nome_completo;
    const crmPessoalLogado = ((authData.crmPessoal && authData.crmPessoal !== 'Sem CRM') ? authData.crmPessoal : (metadata.crm_pessoal || '')).trim().toLowerCase();
    const nomeFormatadoLogado = nomeUsuarioLogado ? `Dr(a). ${nomeUsuarioLogado}` : "Médico Titular";

    const selectFiltroAdmin = document.getElementById('filtroFilaAdmin');
    const subtituloFila = document.getElementById('subtituloFila');

    // Se for Administrador (Titular ou Administrativo), exibe o seletor de visão completa
    if (isAdmin && selectFiltroAdmin) {
        if (isContaTitular) {
            selectFiltroAdmin.style.display = 'inline-block';
            selectFiltroAdmin.addEventListener('change', () => window.carregarFila());
        }
        if (subtituloFila) {
            subtituloFila.innerText = "Visão de Administrador: acompanhando a fila completa de todos os médicos da clínica.";
        }
    }

    // Pesos e estilos do Protocolo de Manchester
    const mapaPrioridades = {
        'Vermelho': { peso: 4, label: '🔴 Emergência', corFundo: '#fee2e2', corTexto: '#991b1b', corBorda: '#ef4444' },
        'Laranja':  { peso: 3, label: '🟠 Muito Urgente', corFundo: '#ffedd5', corTexto: '#9a3412', corBorda: '#f97316' },
        'Amarelo':  { peso: 2, label: '🟡 Urgente', corFundo: '#fef3c7', corTexto: '#92400e', corBorda: '#f59e0b' },
        'Verde':    { peso: 1, label: '🟢 Pouco Urgente', corFundo: '#dcfce7', corTexto: '#166534', corBorda: '#10b981' }
    };

    function extrairPrioridade(anamnese) {
        if (!anamnese) return 'Verde';
        const match = anamnese.match(/\[PRIORIDADE:\s*(.*?)\]/i);
        if (match && mapaPrioridades[match[1].trim()]) {
            return match[1].trim();
        }
        return 'Verde';
    }
    
    window.carregarFila = async function() {
        const grid = document.getElementById('gridFilaEspera');
        grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">A carregar pacientes na fila...</p>';

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
            const modoFiltroAdmin = (selectFiltroAdmin && selectFiltroAdmin.value) ? selectFiltroAdmin.value : 'todos';

            const pacientesParaMim = pacientes.filter(paciente => {
                // Se o utilizador é Administrador (Titular ou Administrativo) e está no modo "todos", vê a fila completa da clínica!
                if (isAdmin && modoFiltroAdmin === 'todos') return true;
                if (nivelAcesso === 'Leitura') return true;

                const anamnese = paciente.anamnese || "";
                const match = anamnese.match(/\[MÉDICO ALOCADO:\s(.*?)\]/);
                
                // Se o paciente FOI direcionado a alguém específico na receção
                if (match) {
                    const medicoAlocado = match[1].trim();
                    const medicoAlocadoLower = medicoAlocado.toLowerCase();
                    
                    // 1. Se foi direcionado para o meu nome (com ou sem sufixo de CRM)
                    if (medicoAlocado === nomeFormatadoLogado || medicoAlocadoLower.startsWith(nomeFormatadoLogado.toLowerCase())) return true;
                    
                    // 2. Se foi direcionado pelo meu CRM Pessoal
                    if (crmPessoalLogado && medicoAlocadoLower.includes(`crm: ${crmPessoalLogado}`)) return true;

                    // 3. Se foi direcionado ao "Médico Titular" e eu sou o dono da clínica
                    if (medicoAlocadoLower.startsWith("médico titular") && isContaTitular) return true;

                    // 4. Se tem o nome de outro médico, ESCONDE!
                    return false;
                }
                
                // Se NÃO TEM a tag (Fila Geral), mostra para todos os médicos
                return true;
            });

            // Ordena primeiro pela gravidade (Manchester) e depois pela hora de chegada
            pacientesParaMim.sort((a, b) => {
                const pesoA = mapaPrioridades[extrairPrioridade(a.anamnese)].peso;
                const pesoB = mapaPrioridades[extrairPrioridade(b.anamnese)].peso;
                if (pesoB !== pesoA) return pesoB - pesoA;
                return new Date(a.created_at) - new Date(b.created_at);
            });

            // ==========================================
            // RENDERIZAR A TELA
            // ==========================================
            if (!pacientesParaMim || pacientesParaMim.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: var(--surface); border-radius: var(--radius); border: 1px dashed var(--border);">
                        <span style="font-size: 40px; display: block; margin-bottom: 10px;">☕</span>
                        <h3 style="color: var(--text-main);">Fila Vazia</h3>
                        <p style="color: var(--text-muted);">Nenhum paciente a aguardar atendimento direcionado a si no momento.</p>
                    </div>`;
                return;
            }

            pacientesParaMim.forEach(paciente => {
                const dataChegada = new Date(paciente.created_at);
                const horaFormatada = dataChegada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const chavePrioridade = extrairPrioridade(paciente.anamnese);
                const infoPrioridade = mapaPrioridades[chavePrioridade];

                let medicoAlocado = "Fila Geral";
                if (paciente.anamnese && paciente.anamnese.includes('[MÉDICO ALOCADO:')) {
                    const match = paciente.anamnese.match(/\[MÉDICO ALOCADO:\s(.*?)\]/);
                    if (match) medicoAlocado = match[1];
                }

                // Limpa as tags técnicas de cabeçalho apenas na visualização do card
                const resumoTriagem = (paciente.anamnese || '')
                    .replace(/\[MÉDICO ALOCADO:.*?\]\n*/gi, '')
                    .replace(/\[PRIORIDADE:.*?\]\n*/gi, '')
                    .replace(/\[TRIAGEM\/RECEPÇÃO\]\n*/gi, '')
                    .trim();

                const card = document.createElement('div');
                card.className = 'queue-card';
                card.style.borderLeft = `5px solid ${infoPrioridade.corBorda}`;
                
                const botaoAtendimentoHtml = (nivelAcesso === 'Leitura' || nivelAcesso === 'Administrativo')
                    ? ''
                    : `<button class="action-btn" onclick="iniciarAtendimento(${paciente.id})" style="width: 100%; text-align: center; padding: 12px;">
                        👨‍⚕️ Iniciar Atendimento
                       </button>`;

                card.innerHTML = `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                            <h3 style="margin: 0; color: var(--primary); font-size: 17px;">${paciente.nome_paciente}</h3>
                            <span class="badge-consultas" style="background: ${infoPrioridade.corFundo}; color: ${infoPrioridade.corTexto}; white-space: nowrap;">
                                ${infoPrioridade.label}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text-main); margin-bottom: 10px;">
                            <span><strong>Médico:</strong> <span style="color: var(--primary); font-weight: 600;">${medicoAlocado}</span></span>
                            <span style="color: var(--text-muted); font-size: 12px;">🕒 ${horaFormatada}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); max-height: 95px; overflow-y: auto; margin-bottom: 16px;">
                            ${resumoTriagem.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    ${botaoAtendimentoHtml}
                `;
                grid.appendChild(card);
            });

        } catch (error) {
            console.error("Erro ao carregar fila:", error);
            grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--danger);">Erro ao carregar a fila de espera.</p>';
        }
    };

    window.iniciarAtendimento = function(idAtendimento) {
        window.location.href = `consulta.html?atendimento_id=${idAtendimento}`;
    };

    carregarFila();
});

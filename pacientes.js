document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica autenticação
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoCrm = authData.crm;

    async function carregarPacientes() {
        // Encontra o container principal (adapte o ID se no seu HTML for diferente, como 'tabelaPacientes')
        const container = document.getElementById('listaPacientes') || document.querySelector('main');
        
        try {
            // Busca os atendimentos do médico logado, EXCLUINDO os que estão na fila de espera
            const { data: pacientes, error } = await clienteSupabase
                .from('atendimentos')
                .select('*')
                .eq('medico_crm', medicoCrm)
                .neq('diagnostico_ia', 'Aguardando avaliação médica.') // O Filtro Mágico
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Constrói o HTML visual dos pacientes já atendidos
            let html = `
                <div class="section-header">
                    <h2>Meus Pacientes (Histórico Clínico)</h2>
                </div>
            `;
            
            if (!pacientes || pacientes.length === 0) {
                html += `
                    <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; border: 1px dashed var(--border);">
                        <p style="color: var(--text-muted);">Nenhum histórico de consulta finalizada encontrado.</p>
                    </div>`;
                container.innerHTML = html;
                return;
            }

            html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
            
            pacientes.forEach(p => {
                const dataConsulta = new Date(p.created_at).toLocaleDateString('pt-BR');
                const horaConsulta = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                
                html += `
                    <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <h3 style="margin: 0; color: var(--primary); font-size: 18px;">${p.nome_paciente}</h3>
                            <span class="badge-consultas" style="background: #f1f5f9; color: #475569;">${dataConsulta} às ${horaConsulta}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); background: #f8fafc; padding: 10px; border-radius: 6px; max-height: 100px; overflow-y: auto; margin-bottom: 10px;">
                            <strong>Prontuário / Anamnese:</strong><br>
                            ${p.anamnese ? p.anamnese.replace(/\n/g, '<br>') : '---'}
                        </div>
                        <div style="font-size: 13px; color: var(--text); background: #f0fdf4; padding: 10px; border-radius: 6px; border: 1px solid #bbf7d0;">
                            <strong>Conclusão / Diagnóstico IA:</strong><br>
                            ${p.diagnostico_ia ? p.diagnostico_ia.replace(/\n/g, '<br>') : '---'}
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            container.innerHTML = html;

        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            container.innerHTML = '<p style="color: red; text-align:center;">Erro ao carregar a lista de pacientes.</p>';
        }
    }

    carregarPacientes();
});
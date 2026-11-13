document.addEventListener("DOMContentLoaded", async () => {
    console.log("🚀 START: A página carregou e o script começou!");

    // 1. Verifica autenticação usando a função global do config.js
    const authData = await verificarAutenticacao();
    console.log("🔐 AUTENTICAÇÃO:", authData); 

    if (!authData) {
        console.log("❌ ERRO: authData está vazio. O código vai parar aqui e não vai carregar as listas.");
        return;
    }
    
    // O CRM do logado atua como o "ID da Clínica/Tenant"
    const medicoAdminCrm = authData.crm; 
    console.log("👨‍⚕️ CRM do Admin Logado:", medicoAdminCrm);

    const tabela = document.getElementById('tabelaEquipe');
    const btnAdicionar = document.getElementById('btnAdicionarMembro');
    let listaMembros = [];

    // Garante que o Modal de Edição de Membro exista no DOM (mesmo se o HTML antigo estiver em cache)
    function garantirModalEdicaoNoDom() {
        let modal = document.getElementById('modalEditarMembro');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'modalEditarMembro';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Editar Informações e Permissões</h3>
                    <button type="button" id="btnFecharModalMembro" class="close-modal">✖</button>
                </div>

                <input type="hidden" id="editIdMembro">

                <div class="form-grid-2" style="margin-bottom: 20px;">
                    <div class="col-span-2">
                        <label for="editEmailMembro">E-mail de Acesso:</label>
                        <input type="email" id="editEmailMembro" disabled>
                    </div>

                    <div class="col-span-2">
                        <label for="editNomeMembro">Nome do Profissional:</label>
                        <input type="text" id="editNomeMembro" placeholder="Ex: Ana Souza">
                    </div>

                    <div>
                        <label for="editCargoMembro">Cargo / Função:</label>
                        <select id="editCargoMembro">
                            <option value="Médico Plantonista">Médico Plantonista</option>
                            <option value="Enfermeiro(a) Triagem">Enfermeiro(a) Triagem</option>
                            <option value="Atendente / Recepção">Atendente / Recepção</option>
                        </select>
                    </div>

                    <div>
                        <label for="editCrmMembro">CRM Individual (Médicos):</label>
                        <input type="text" id="editCrmMembro" placeholder="Ex: 123456-SP">
                    </div>

                    <div class="col-span-2">
                        <label for="editAcessoMembro">Permissão do Sistema (Nível de Acesso):</label>
                        <select id="editAcessoMembro">
                            <option value="Total">Médico (Acesso Total Clínico e Administrativo)</option>
                            <option value="Administrativo">Administrativo (Gestão de Equipe, Recepção e Fila Completa)</option>
                            <option value="Agendamento">Recepção (Apenas Cadastro de Pacientes)</option>
                            <option value="Leitura">Leitura (Apenas visualização de histórico e fila)</option>
                        </select>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button type="button" id="btnCancelarEdicaoMembro" class="btn-secondary">Cancelar</button>
                    <button type="button" id="btnSalvarEdicaoMembro" class="action-btn" style="width: auto; padding: 12px 24px;">Salvar Alterações</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    // ==========================================
    // CARREGAR LISTA DA EQUIPA
    // ==========================================
    async function carregarEquipe() {
        console.log("🔍 A iniciar a busca na tabela equipe...");
        
        if (tabela) {
            tabela.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando equipe...</td></tr>';
        } else {
            console.log("❌ ERRO: Elemento HTML 'tabelaEquipe' não foi encontrado na página.");
            return;
        }

        const { data: dadosEquipe, error: erroEquipe } = await clienteSupabase
            .from('equipe')
            .select('*')
            .eq('admin_crm', medicoAdminCrm)
            .order('created_at', { ascending: false });
        
        console.log("📥 Dados recebidos do Supabase:", dadosEquipe);
        console.log("⚠️ Erros do Supabase (se houver):", erroEquipe);

        if (erroEquipe) {
            console.error("Erro ao carregar equipe:", erroEquipe);
            tabela.innerHTML = `<tr><td colspan="4" style="text-align:center;">Erro ao buscar dados do banco.</td></tr>`;
            return;
        }

        listaMembros = dadosEquipe || [];
        tabela.innerHTML = '';

        // Mostra o próprio Administrador de forma fixa no topo (com botão para editar o próprio perfil)
        const nomeTitular = authData.nome || `Titular (${medicoAdminCrm})`;
        tabela.innerHTML += `
            <tr style="background-color: #f8fafc;">
                <td>
                    <strong>Dr(a). ${nomeTitular}</strong> (Você)<br>
                    <small style="color: var(--text-muted);">${authData.session.user.email || ''}</small>
                </td>
                <td>Administrador / Titular (CRM: ${medicoAdminCrm})</td>
                <td><span class="badge-consultas" style="background: var(--primary); color: white;">Acesso Total</span></td>
                <td class="crud-actions" style="justify-content: center;">
                    <button type="button" class="btn-icon edit" onclick="document.getElementById('modalPerfil').style.display='flex'" title="Editar Meus Dados Pessoais">✏️</button>
                </td>
            </tr>
        `;

        if (!dadosEquipe || dadosEquipe.length === 0) {
            console.log("⚠️ A busca funcionou, mas nenhum outro membro foi encontrado na base de dados para o CRM:", medicoAdminCrm);
            return;
        }

        dadosEquipe.forEach(membro => {
            let badgeStyle = "background: var(--secondary); color: var(--primary);"; // Padrão: Total
            
            if (membro.nivel_acesso === 'Administrativo') {
                badgeStyle = "background: #dbeafe; color: #1e3a8a;"; // Azul claro
            } else if (membro.nivel_acesso === 'Leitura') {
                badgeStyle = "background: #fef3c7; color: #b45309;"; // Amarelo
            } else if (membro.nivel_acesso === 'Agendamento') {
                badgeStyle = "background: #e2e8f0; color: #475569;"; // Cinza
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${membro.nome || 'Sem nome'}</strong><br>
                    <small style="color: var(--text-muted);">${membro.email || ''}</small>
                </td>
                <td>${membro.cargo || '---'}</td>
                <td><span class="badge-consultas" style="${badgeStyle}">${membro.nivel_acesso || 'Total'}</span></td>
                <td class="crud-actions" style="justify-content: center;">
                    <button type="button" class="btn-icon edit btn-editar-membro" data-id="${membro.id}" title="Editar Informações e Permissões">✏️</button>
                    <button type="button" class="btn-icon delete btn-remover-membro" data-id="${membro.id}" title="Revogar Acesso">🗑️</button>
                </td>
            `;

            const btnEdit = tr.querySelector('.btn-editar-membro');
            const btnDel = tr.querySelector('.btn-remover-membro');
            if (btnEdit) {
                btnEdit.addEventListener('click', () => window.abrirModalEditarMembro(membro.id));
            }
            if (btnDel) {
                btnDel.addEventListener('click', () => window.removerMembro(membro.id));
            }

            tabela.appendChild(tr);
        });
    }

    // ==========================================
    // CRIAR NOVO ACESSO (AUTH + DATABASE)
    // ==========================================
    if (btnAdicionar) {
        btnAdicionar.addEventListener('click', async () => {
            const email = document.getElementById('emailAcesso').value.trim();
            const senha = document.getElementById('senhaAcesso').value.trim();
            const nome = document.getElementById('nomeMembro').value.trim();
            const cargoBase = document.getElementById('cargoMembro').value;
            const crmIndividual = document.getElementById('crmMembro') ? document.getElementById('crmMembro').value.trim() : '';
            const cargo = crmIndividual ? `${cargoBase} (CRM: ${crmIndividual})` : cargoBase;
            const acesso = document.getElementById('acessoMembro').value;

            if (!nome || !email || !senha) {
                alert("E-mail, Senha e Nome são obrigatórios para criar um acesso.");
                return;
            }

            if ((acesso === 'Total' || cargoBase.toLowerCase().includes('médico')) && !crmIndividual) {
                alert("Para cadastrar um Médico, informe o CRM individual do profissional.");
                return;
            }

            if (senha.length < 6) {
                alert("Por segurança, a senha temporária deve ter pelo menos 6 caracteres.");
                return;
            }

            const originalText = btnAdicionar.innerText;
            btnAdicionar.innerText = "A criar acesso...";
            btnAdicionar.disabled = true;

            try {
                const clienteAuthIsolado = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                });

                const { error: authError } = await clienteAuthIsolado.auth.signUp({
                    email: email,
                    password: senha,
                    options: { 
                        data: { 
                            crm: medicoAdminCrm,
                            nome_completo: nome,
                            acesso_level: acesso,
                            crm_pessoal: crmIndividual
                        } 
                    }
                });

                if (authError) throw new Error("Erro na Autenticação: " + authError.message);

                const { error: dbError } = await clienteSupabase.from('equipe').insert([{
                    admin_crm: medicoAdminCrm,
                    nome: nome,
                    email: email, 
                    cargo: cargo,
                    nivel_acesso: acesso
                }]);

                if (dbError) throw new Error("Erro ao gravar na tabela: " + dbError.message);
                
                document.getElementById('emailAcesso').value = '';
                document.getElementById('senhaAcesso').value = '';
                document.getElementById('nomeMembro').value = '';
                if (document.getElementById('crmMembro')) document.getElementById('crmMembro').value = '';
                
                alert(`Acesso criado com sucesso!\nO profissional ${nome} já pode fazer login com o e-mail: ${email}`);
                carregarEquipe(); 
                
            } catch (error) {
                console.error(error);
                alert(error.message);
            } finally {
                btnAdicionar.innerText = originalText;
                btnAdicionar.disabled = false;
            }
        });
    } else {
        console.log("❌ ERRO: Botão 'btnAdicionarMembro' não encontrado no HTML.");
    }

    // ==========================================
    // EDITAR INFORMAÇÕES E PERMISSÕES DE MEMBRO DA EQUIPE
    // ==========================================
    const modalEditarMembro = garantirModalEdicaoNoDom();
    const btnFecharModalMembro = document.getElementById('btnFecharModalMembro');
    const btnCancelarEdicaoMembro = document.getElementById('btnCancelarEdicaoMembro');
    const btnSalvarEdicaoMembro = document.getElementById('btnSalvarEdicaoMembro');

    function fecharModalEdicao() {
        if (modalEditarMembro) modalEditarMembro.style.display = 'none';
    }

    if (btnFecharModalMembro) btnFecharModalMembro.addEventListener('click', fecharModalEdicao);
    if (btnCancelarEdicaoMembro) btnCancelarEdicaoMembro.addEventListener('click', fecharModalEdicao);
    if (modalEditarMembro) {
        modalEditarMembro.addEventListener('click', (e) => {
            if (e.target === modalEditarMembro) fecharModalEdicao();
        });
    }

    window.abrirModalEditarMembro = function(id) {
        const modal = garantirModalEdicaoNoDom();
        const membro = listaMembros.find(m => String(m.id) === String(id));
        if (!membro || !modal) {
            console.error("Membro não encontrado para edição:", id);
            return;
        }

        const matchCrm = (membro.cargo || '').match(/CRM:\s*([^\)]+)/i);
        const crmExtraido = matchCrm ? matchCrm[1].trim() : '';
        const cargoBase = (membro.cargo || 'Médico Plantonista').replace(/\s*\(CRM:.*?\)/i, '').trim();

        document.getElementById('editIdMembro').value = String(membro.id);
        document.getElementById('editEmailMembro').value = membro.email || '';
        document.getElementById('editNomeMembro').value = membro.nome || '';
        document.getElementById('editCrmMembro').value = crmExtraido;
        document.getElementById('editAcessoMembro').value = membro.nivel_acesso || 'Total';

        const selectCargo = document.getElementById('editCargoMembro');
        if (selectCargo) {
            const opcoesCargo = Array.from(selectCargo.options).map(o => o.value);
            selectCargo.value = opcoesCargo.includes(cargoBase) ? cargoBase : 'Médico Plantonista';
        }

        modal.style.display = 'flex';
    };

    if (btnSalvarEdicaoMembro) {
        btnSalvarEdicaoMembro.addEventListener('click', async () => {
            const idStr = document.getElementById('editIdMembro').value;
            const membroOriginal = listaMembros.find(m => String(m.id) === String(idStr));
            if (!membroOriginal) {
                alert("Erro: registo do membro não localizado.");
                return;
            }

            const novoNome = document.getElementById('editNomeMembro').value.trim();
            const novoCargoBase = document.getElementById('editCargoMembro').value;
            const novoCrm = document.getElementById('editCrmMembro').value.trim();
            const novoNivelAcesso = document.getElementById('editAcessoMembro').value;

            if (!novoNome) {
                alert("O nome do profissional é obrigatório.");
                return;
            }

            if ((novoNivelAcesso === 'Total' || novoCargoBase.toLowerCase().includes('médico')) && !novoCrm) {
                alert("Para o cargo ou permissão de Médico, informe o CRM individual do profissional.");
                return;
            }

            const cargoAtualizado = novoCrm ? `${novoCargoBase} (CRM: ${novoCrm})` : novoCargoBase;

            const textoOriginal = btnSalvarEdicaoMembro.innerText;
            btnSalvarEdicaoMembro.innerText = "Salvando...";
            btnSalvarEdicaoMembro.disabled = true;

            try {
                // Tenta atualizar diretamente via UPDATE
                const { data: updatedRows, error: updateError } = await clienteSupabase
                    .from('equipe')
                    .update({
                        nome: novoNome,
                        cargo: cargoAtualizado,
                        nivel_acesso: novoNivelAcesso
                    })
                    .eq('id', membroOriginal.id)
                    .select();

                // Se a política RLS do Supabase bloquear UPDATE (0 linhas afetadas ou erro),
                // aplica fallback seguro usando DELETE + INSERT (que já possuem permissão ativa na tabela)
                if (updateError || !updatedRows || updatedRows.length === 0) {
                    const { error: delErr } = await clienteSupabase
                        .from('equipe')
                        .delete()
                        .eq('id', membroOriginal.id);

                    if (delErr) throw delErr;

                    const { error: insErr } = await clienteSupabase
                        .from('equipe')
                        .insert([{
                            admin_crm: medicoAdminCrm,
                            nome: novoNome,
                            email: membroOriginal.email,
                            cargo: cargoAtualizado,
                            nivel_acesso: novoNivelAcesso
                        }]);

                    if (insErr) throw insErr;
                }

                fecharModalEdicao();
                await window.mostrarAlerta("Informações e permissões do usuário atualizadas com sucesso!", "sucesso");
                carregarEquipe();
            } catch (err) {
                console.error(err);
                alert("Erro ao atualizar dados do usuário: " + err.message);
            } finally {
                btnSalvarEdicaoMembro.innerText = textoOriginal;
                btnSalvarEdicaoMembro.disabled = false;
            }
        });
    }

    // ==========================================
    // REMOVER MEMBRO DA EQUIPA
    // ==========================================
    window.removerMembro = async function(id) {
        const confirmar = await window.mostrarConfirmacao(
            "Tem a certeza que deseja remover este membro da equipa?",
            {
                tipo: 'erro',
                titulo: 'Revogar Acesso',
                textoConfirmar: 'Sim, Remover',
                textoCancelar: 'Cancelar'
            }
        );
        if (!confirmar) return;

        try {
            const { error: deleteError } = await clienteSupabase.from('equipe').delete().eq('id', id);
            if (deleteError) throw deleteError;
            
            carregarEquipe();
        } catch (error) {
            console.error(error);
            alert("Erro ao remover membro.");
        }
    };

    // Inicializa a tabela assim que a página carrega
    carregarEquipe();
});

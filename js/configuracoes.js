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

        // Usamos dadosEquipe e erroEquipe para evitar o erro de sintaxe "Identifier 'data' has already been declared"
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

        tabela.innerHTML = '';

        // Mostra o próprio Administrador de forma fixa no topo
        tabela.innerHTML += `
            <tr style="background-color: #f8fafc;">
                <td><strong>Dr(a). Titular (${medicoAdminCrm})</strong> (Você)</td>
                <td>Administrador / Titular</td>
                <td><span class="badge-consultas" style="background: var(--primary); color: white;">Acesso Total</span></td>
                <td style="text-align: center; color: var(--text-muted);">---</td>
            </tr>
        `;

        if (!dadosEquipe || dadosEquipe.length === 0) {
            console.log("⚠️ A busca funcionou, mas nenhum outro membro foi encontrado na base de dados para o CRM:", medicoAdminCrm);
            return;
        }

        dadosEquipe.forEach(membro => {
            // Define as cores das tags dependendo do nível de acesso
            let badgeStyle = "background: var(--secondary); color: var(--primary);"; // Padrão: Total
            
            if (membro.nivel_acesso === 'Administrativo') {
                badgeStyle = "background: #dbeafe; color: #1e3a8a;"; // Azul claro
            } else if (membro.nivel_acesso === 'Leitura') {
                badgeStyle = "background: #fef3c7; color: #b45309;"; // Amarelo
            } else if (membro.nivel_acesso === 'Agendamento') {
                badgeStyle = "background: #e2e8f0; color: #475569;"; // Cinza
            }

            tabela.innerHTML += `
                <tr>
                    <td>
                        <strong>${membro.nome}</strong><br>
                        <small style="color: var(--text-muted);">${membro.email}</small>
                    </td>
                    <td>${membro.cargo}</td>
                    <td><span class="badge-consultas" style="${badgeStyle}">${membro.nivel_acesso}</span></td>
                    <td class="crud-actions" style="justify-content: center;">
                        <button class="btn-icon edit" onclick="editarCrmMembro(${membro.id}, '${(membro.cargo || '').replace(/'/g, "\\'")}')" title="Definir / Editar CRM Individual">✏️</button>
                        <button class="btn-icon delete" onclick="removerMembro(${membro.id})" title="Revogar Acesso">🗑️</button>
                    </td>
                </tr>
            `;
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
                // ETAPA 1: Criar a conta real no Supabase Auth usando um cliente sem persistência
                // para NÃO substituir a sessão atual do Administrador logado
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
                            crm: medicoAdminCrm, // Vincula ao tenant da clínica
                            nome_completo: nome,
                            acesso_level: acesso,
                            crm_pessoal: crmIndividual
                        } 
                    }
                });

                if (authError) throw new Error("Erro na Autenticação: " + authError.message);

                // ETAPA 2: Registar na tabela visual 'equipe'
                const { error: dbError } = await clienteSupabase.from('equipe').insert([{
                    admin_crm: medicoAdminCrm,
                    nome: nome,
                    email: email, 
                    cargo: cargo,
                    nivel_acesso: acesso
                }]);

                if (dbError) throw new Error("Erro ao gravar na tabela: " + dbError.message);
                
                // Sucesso - Limpar formulário
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
    // EDITAR CRM DE UM MÉDICO JÁ CADASTRADO NA EQUIPE
    // ==========================================
    window.editarCrmMembro = async function(id, cargoAtual) {
        const matchAtual = (cargoAtual || '').match(/CRM:\s*([^\)]+)/i);
        const crmAtual = matchAtual ? matchAtual[1].trim() : '';
        const novoCrm = await window.mostrarPrompt(
            "Informe o CRM individual deste médico:",
            crmAtual,
            { titulo: 'Editar CRM do Médico', placeholder: 'Ex: 123456-SP' }
        );
        if (novoCrm === null) return; // Cancelou

        const cargoBase = (cargoAtual || 'Médico Plantonista').replace(/\s*\(CRM:.*?\)/i, '').trim();
        const cargoAtualizado = novoCrm.trim() ? `${cargoBase} (CRM: ${novoCrm.trim()})` : cargoBase;

        try {
            const { error: updateError } = await clienteSupabase
                .from('equipe')
                .update({ cargo: cargoAtualizado })
                .eq('id', id);

            if (updateError) throw updateError;
            await window.mostrarAlerta("CRM do profissional atualizado com sucesso!", "sucesso");
            carregarEquipe();
        } catch (err) {
            console.error(err);
            alert("Erro ao atualizar o CRM do membro.");
        }
    };

    // ==========================================
    // REMOVER MEMBRO DA EQUIPA
    // ==========================================
    // Função exposta globalmente para o botão "onclick" do HTML conseguir chamar
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
            // Renomeado para deleteError para evitar choque com a palavra reservada 'error' noutros blocos
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

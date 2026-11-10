document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verifica autenticação
    const authData = await verificarAutenticacao();
    if (!authData) return;
    const medicoAdminCrm = authData.crm; // O CRM do logado atua como o "ID da Clínica/Tenant"

    const tabela = document.getElementById('tabelaEquipe');
    const btnAdicionar = document.getElementById('btnAdicionarMembro');

    // 2. Carregar Lista de Membros da Equipa
    async function carregarEquipe() {
        tabela.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando equipe...</td></tr>';

        // Busca na tabela 'equipe' filtrando pelo CRM do administrador
        const { data, error } = await clienteSupabase
            .from('equipe')
            .select('*')
            .eq('admin_crm', medicoAdminCrm)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("Erro ao carregar equipe:", error);
            tabela.innerHTML = `<tr><td colspan="4" style="text-align:center;">Nenhum membro encontrado ou erro na tabela. Crie a tabela 'equipe' no Supabase.</td></tr>`;
            return;
        }

        tabela.innerHTML = '';

        // Mostra o próprio Administrador de forma fixa
        tabela.innerHTML += `
            <tr style="background-color: #f8fafc;">
                <td><strong>Dr(a). ${medicoAdminCrm.split('-')[0]}</strong> (Você)</td>
                <td>Administrador / Titular</td>
                <td><span class="badge-consultas" style="background: var(--primary); color: white;">Acesso Total</span></td>
                <td style="text-align: center; color: var(--text-muted);">---</td>
            </tr>
        `;

        if (data.length === 0) return;

        data.forEach(membro => {
            let badgeStyle = "background: var(--secondary); color: var(--primary);";
            if (membro.nivel_acesso === 'Leitura') badgeStyle = "background: #fef3c7; color: #b45309;";
            if (membro.nivel_acesso === 'Agendamento') badgeStyle = "background: #e2e8f0; color: #475569;";

            tabela.innerHTML += `
                <tr>
                    <td><strong>${membro.nome}</strong></td>
                    <td>${membro.cargo}</td>
                    <td><span class="badge-consultas" style="${badgeStyle}">${membro.nivel_acesso}</span></td>
                    <td class="crud-actions" style="justify-content: center;">
                        <button class="btn-icon delete" onclick="removerMembro(${membro.id})">Revogar Acesso 🗑️</button>
                    </td>
                </tr>
            `;
        });
    }

    // 3. Criar Novo Acesso (Com Autenticação Real)
    btnAdicionar.addEventListener('click', async () => {
        const email = document.getElementById('emailAcesso').value.trim();
        const senha = document.getElementById('senhaAcesso').value.trim();
        const nome = document.getElementById('nomeMembro').value.trim();
        const cargo = document.getElementById('cargoMembro').value;
        const acesso = document.getElementById('acessoMembro').value;

        if (!nome || !email || !senha) {
            alert("E-mail, Senha e Nome são obrigatórios para criar um acesso.");
            return;
        }

        if (senha.length < 6) {
            alert("Por segurança, a senha deve ter pelo menos 6 caracteres.");
            return;
        }

        const originalText = btnAdicionar.innerText;
        btnAdicionar.innerText = "A criar acesso...";
        btnAdicionar.disabled = true;

        try {
            // ETAPA 1: Criar a conta real no Supabase Auth (Segurança)
            // O novo utilizador fica associado ao CRM da clínica para não ver dados de outras clínicas
            const { error: authError } = await clienteSupabase.auth.signUp({
                email: email,
                password: senha,
                options: { 
                    data: { 
                        crm: medicoAdminCrm,
                        nome_completo: nome,
                        acesso_level: acesso
                    } 
                }
            });

            if (authError) {
                // Se o email já existir ou a senha for fraca, o Supabase avisa aqui
                throw new Error("Erro na Autenticação: " + authError.message);
            }

            // ETAPA 2: Registar na tabela visual 'equipe' (Sem gravar a senha!)
            const { error: dbError } = await clienteSupabase.from('equipe').insert([{
                admin_crm: medicoAdminCrm,
                nome: nome,
                email: email, // Salvamos o email para referência
                cargo: cargo,
                nivel_acesso: acesso
            }]);

            if (dbError) throw new Error("Erro ao gravar na tabela: " + dbError.message);
            
            // Limpar formulário após o sucesso
            document.getElementById('emailAcesso').value = '';
            document.getElementById('senhaAcesso').value = '';
            document.getElementById('nomeMembro').value = '';
            
            alert(`Acesso criado com sucesso! O profissional ${nome} já pode fazer login com o e-mail ${email}.`);
            carregarEquipe(); 
            
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            btnAdicionar.innerText = originalText;
            btnAdicionar.disabled = false;
        }
    });

    // Inicialização
    carregarEquipe();
});
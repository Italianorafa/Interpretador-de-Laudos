// --- CHAVES DAS APIS ---
const GEMINI_API_KEY = 'AQ.Ab8RN6ItgKAf6RcvPHl3JeKXQBB-u5w0WDFtwbvO4DEtJK1ezw'; 
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
async function listarModelosDaIA() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    
    try {
        const resposta = await fetch(url);
        const dados = await resposta.json();
        
        console.log("=== MODELOS DISPONÍVEIS PARA ESTA CHAVE ===");
        if (dados.models) {
            // Cria uma tabela bonita na consola com os nomes corretos
            const listaMapeada = dados.models.map(m => ({
                Nome_Exato: m.name.replace('models/', ''),
                Descricao: m.description,
                Versao: m.version
            }));
            console.table(listaMapeada);
        } else {
            console.error("Erro ao listar:", dados);
        }
    } catch (erro) {
        console.error("Falha na ligação:", erro);
    }
}

// Executa a função automaticamente
listarModelosDaIA();

const SUPABASE_URL = 'https://kxdpgmpgmnogmtqvsask.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IPgFjiWNCGpdFjVIdaX_Rg_PHNHM6R9';

// Inicia o cliente Supabase globalmente
const clienteSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Função global para verificar se o médico está logado (proteção de rotas)
async function verificarAutenticacao() {
    const { data: { session }, error } = await clienteSupabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'login.html'; // Expulsa para o login se não estiver logado
        return null;
    }
    
    // Configura o cabeçalho com os dados do médico nas páginas protegidas
    const crm = session.user.user_metadata.crm || 'CRM-INDEFINIDO';
    const crmElement = document.getElementById('medicoLogadoCrm');
    const nameElement = document.getElementById('medicoLogadoName');
    
    if (crmElement && nameElement) {
        crmElement.innerText = crm;
        nameElement.innerText = "Dr(a). " + crm.split('-')[0];
    }
    
    return { session, crm };
}

// Função global de Logout
async function fazerLogout() {
    await clienteSupabase.auth.signOut();
    window.location.href = 'login.html';
}

// Atribui o evento ao botão de Sair (se ele existir na página)
document.addEventListener("DOMContentLoaded", () => {
    const btnSair = document.getElementById('btnSair');
    if (btnSair) {
        btnSair.addEventListener('click', fazerLogout);
    }
});

// Função global para verificar autenticação e nível de acesso
async function verificarAutenticacao() {
    const { data: { session }, error } = await clienteSupabase.auth.getSession();
    
    if (error || !session) {
        window.location.href = 'login.html';
        return null;
    }
    
    const crm = session.user.user_metadata.crm || 'CRM-INDEFINIDO';
    const nivelAcesso = session.user.user_metadata.acesso_level || 'Total'; // Médicos/Admins têm Total
    const nome = session.user.user_metadata.nome_completo || crm;
    
    // ==========================================
    // SISTEMA RBAC (Controlo de Acesso)
    // ==========================================
    const paginaAtual = window.location.pathname.toLowerCase();
    
    if (nivelAcesso === 'Agendamento') {
        // Se for recepção e tentar aceder a páginas médicas, expulsa para a recepção
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('pacientes.html')) {
            window.location.href = 'recepcao.html';
            return null;
        }
        // Esconde os menus médicos
        document.querySelectorAll('.header-nav a:not([href="recepcao.html"])').forEach(el => el.style.display = 'none');
    } else {
        // Se for médico e estiver numa página normal, pode esconder o menu da recepção se quiser
        // document.querySelectorAll('.header-nav a[href="recepcao.html"]').forEach(el => el.style.display = 'none');
    }

    // Configura o cabeçalho
    const crmElement = document.getElementById('medicoLogadoCrm');
    const nameElement = document.getElementById('medicoLogadoName');
    if (crmElement && nameElement) {
        crmElement.innerText = crm;
        nameElement.innerText = (nivelAcesso === 'Agendamento' ? '' : 'Dr(a). ') + nome.split(' ')[0];
    }
    
    return { session, crm, nivelAcesso };
}

// ==========================================
// SISTEMA DE EDIÇÃO DE DADOS PESSOAIS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    const btnPerfil = document.getElementById('btnPerfil');
    const modalPerfil = document.getElementById('modalPerfil');
    const btnFecharPerfil = document.getElementById('btnFecharPerfil');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    
    // Mapeamento dos campos
    const inputEmail = document.getElementById('perfilEmail');
    const inputNome = document.getElementById('perfilNome');
    const inputNascimento = document.getElementById('perfilNascimento');
    const inputCpf = document.getElementById('perfilCpf');
    const inputCrmPessoal = document.getElementById('perfilCrmPessoal');

    if (btnPerfil && modalPerfil) {
        // 1. Abrir a janela e carregar os dados guardados
        btnPerfil.addEventListener('click', async () => {
            const { data: { session } } = await clienteSupabase.auth.getSession();
            if (session) {
                const metadados = session.user.user_metadata;
                
                inputEmail.value = session.user.email;
                inputNome.value = metadados.nome_completo || '';
                inputNascimento.value = metadados.data_nascimento || '';
                inputCpf.value = metadados.cpf || '';
                inputCrmPessoal.value = metadados.crm_pessoal || '';
                
                modalPerfil.style.display = 'flex';
            }
        });

        // 2. Fechar a janela
        btnFecharPerfil.addEventListener('click', () => modalPerfil.style.display = 'none');
        modalPerfil.addEventListener('click', (e) => {
            if (e.target === modalPerfil) modalPerfil.style.display = 'none';
        });

        // 3. Salvar os novos dados no Supabase Auth
        btnSalvarPerfil.addEventListener('click', async () => {
            const novoNome = inputNome.value.trim();
            if (!novoNome) return alert("O Nome Completo é obrigatório.");

            const textoOriginal = btnSalvarPerfil.innerText;
            btnSalvarPerfil.innerText = "Salvando...";
            btnSalvarPerfil.disabled = true;

            try {
                // Envia os 4 campos de volta para os metadados do utilizador
                const { error } = await clienteSupabase.auth.updateUser({
                    data: { 
                        nome_completo: novoNome,
                        data_nascimento: inputNascimento.value,
                        cpf: inputCpf.value.trim(),
                        crm_pessoal: inputCrmPessoal.value.trim()
                    }
                });

                if (error) throw error;

                alert("Dados pessoais atualizados com sucesso!");
                modalPerfil.style.display = 'none';
                
                // Atualiza o ecrã para refletir o novo nome
                window.location.reload(); 

            } catch (error) {
                console.error(error);
                alert("Erro ao salvar os dados: " + error.message);
            } finally {
                btnSalvarPerfil.innerText = textoOriginal;
                btnSalvarPerfil.disabled = false;
            }
        });
    }
});
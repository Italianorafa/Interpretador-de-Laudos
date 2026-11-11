// --- CHAVES DAS APIS ---
const GEMINI_API_KEY = 'AQ.Ab8RN6JsxAXR0IK4nA2_-e2S8fhNRU2G4ciFvEINhjoA0In9Ig'; 
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${GEMINI_API_KEY}`;


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
    const btnConfig = document.querySelector('.settings-icon'); // A engrenagem

    // 1. Regras para RECEPÇÃO BÁSICA (Nível: Agendamento)
    if (nivelAcesso === 'Agendamento') {
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('pacientes.html') || paginaAtual.includes('configuracoes.html')) {
            window.location.href = 'recepcao.html';
            return null;
        }
        // Esconde menus médicos e a engrenagem de configurações
        document.querySelectorAll('.header-nav a:not([href="recepcao.html"])').forEach(el => el.style.display = 'none');
        if (btnConfig) btnConfig.style.display = 'none';
    } 
    
    // 2. Regras para GESTOR DA CLÍNICA (Nível: Administrativo)
    else if (nivelAcesso === 'Administrativo') {
        if (paginaAtual.includes('consulta.html') || paginaAtual.includes('pacientes.html')) {
            window.location.href = 'recepcao.html';
            return null;
        }
        // Esconde menus médicos, mas mantém a engrenagem de configurações
        document.querySelectorAll('.header-nav a').forEach(el => {
            if (el.getAttribute('href') === 'consulta.html' || el.getAttribute('href') === 'pacientes.html') {
                el.style.display = 'none';
            }
        });
        
        // Garante que o link da Recepção aparece no menu, caso a pessoa esteja nas configurações
        const nav = document.querySelector('.header-nav');
        if (nav && !document.querySelector('.header-nav a[href="recepcao.html"]')) {
            nav.innerHTML = `<a href="recepcao.html" class="nav-item" style="text-decoration: none;">Painel da Recepção</a>` + nav.innerHTML;
        }
    } 
    
    // 3. Regras para MÉDICOS (Nível: Total)
    else {
        // Se o médico quiser ver a recepção, ele pode. Senão, esconde o botão da recepção para não poluir.
        if (!paginaAtual.includes('recepcao.html')) {
            document.querySelectorAll('.header-nav a[href="recepcao.html"]').forEach(el => el.style.display = 'none');
        }
    }

    // Configura o cabeçalho
    const crmElement = document.getElementById('medicoLogadoCrm');
    const nameElement = document.getElementById('medicoLogadoName');
    if (crmElement && nameElement) {
        crmElement.innerText = crm;
        const prefixo = (nivelAcesso === 'Total') ? 'Dr(a). ' : '';
        nameElement.innerText = prefixo + nome.split(' ')[0];
    }
    
    // 👇 ADICIONE ESTA LINHA QUE FALTA AQUI 👇
    return { session, crm, nivelAcesso };
}


// ==========================================
// SISTEMA DE EDIÇÃO DE DADOS PESSOAIS
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    
    // Mapeamento dos campos
    const inputEmail = document.getElementById('perfilEmail');
    const inputNome = document.getElementById('perfilNome');
    const inputNascimento = document.getElementById('perfilNascimento');
    const inputCpf = document.getElementById('perfilCpf');
    const inputCrmPessoal = document.getElementById('perfilCrmPessoal');

    // 1. Botão de Logout
    const btnSair = document.getElementById('btnSair');
    if (btnSair) {
        btnSair.addEventListener('click', async () => {
            await clienteSupabase.auth.signOut();
            window.location.href = 'index.html'; // Redireciona para o login
        });
    }

    // 2. Abrir o Modal de Perfil
    const btnPerfil = document.getElementById('btnPerfil');
    const modalPerfil = document.getElementById('modalPerfil');
    if (btnPerfil && modalPerfil) {
        btnPerfil.addEventListener('click', () => {
            modalPerfil.style.display = 'flex';
        });
    }

    // 3. Fechar o Modal de Perfil
    const btnFecharPerfil = document.getElementById('btnFecharPerfil');
    if (btnFecharPerfil && modalPerfil) {
        btnFecharPerfil.addEventListener('click', () => {
            modalPerfil.style.display = 'none';
        });
    }

    if (modalPerfil) {
        modalPerfil.addEventListener('click', (e) => {
            if (e.target === modalPerfil) {
                modalPerfil.style.display = 'none';
            }
        });
    }

    // 4. Salvar os novos dados no Supabase Auth
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    if (btnSalvarPerfil) {
        btnSalvarPerfil.addEventListener('click', async () => {
            // Capta os inputs apenas se eles existirem na página
            const inputNome = document.getElementById('inputNome');
            const inputNascimento = document.getElementById('inputNascimento');
            const inputCpf = document.getElementById('inputCpf');
            const inputCrmPessoal = document.getElementById('inputCrmPessoal');

            const novoNome = inputNome ? inputNome.value.trim() : '';
            if (!novoNome) return alert("O Nome Completo é obrigatório.");

            const textoOriginal = btnSalvarPerfil.innerText;
            btnSalvarPerfil.innerText = "Salvando...";
            btnSalvarPerfil.disabled = true;

            try {
                const { error } = await clienteSupabase.auth.updateUser({
                    data: {
                        nome_completo: novoNome,
                        data_nascimento: inputNascimento ? inputNascimento.value : '',
                        cpf: inputCpf ? inputCpf.value.trim() : '',
                        crm_pessoal: inputCrmPessoal ? inputCrmPessoal.value.trim() : ''
                    }
                });

                if (error) throw error;

                alert("Dados pessoais atualizados com sucesso!");
                if (modalPerfil) modalPerfil.style.display = 'none';
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
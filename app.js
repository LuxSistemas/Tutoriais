import Fuse from './fuse.min.mjs';

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function extrairIdYoutube(url) {
    const m = String(url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
    return m ? m[1] : null;
}

function thumbUrl(url) {
    const id = extrairIdYoutube(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}

// Tira acento e caixa pra "devolucao" achar "Devolução", "carro" achar "Carro" etc.
function normalizarTexto(str) {
    return String(str ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Cada nó pode ter até 4 categorias de vídeo, nessa ordem de exibição:
// geral (visão geral — o primeiro que um cliente novo assiste), essenciais
// (funções mais importantes), erros (problemas comuns) e avancado (dicas extras).
const CATEGORIAS_VIDEO = [
    { chave: 'geral', label: 'Visão geral' },
    { chave: 'essenciais', label: 'Funções importantes' },
    { chave: 'erros', label: 'Erros comuns' },
    { chave: 'avancado', label: 'Dicas avançadas' },
];

const VIDEOS_RETAGUARDA = {
    'pessoas>contatos': { geral: [39], essenciais: [40, 41] },
    'pessoas>contador': { essenciais: [42] },
    'pessoas>vendedores': { essenciais: [43] },
    'estoque>produtos': { geral: [44], essenciais: [45], avancado: [46] },
    'estoque>grupo': { essenciais: [47] },
    'estoque>unidades': { essenciais: [48] },
    'estoque>marcas': { essenciais: [49] },
    'estoque>imp-etiqueta': { essenciais: [50] },
    'estoque>ajuste-estoque': { essenciais: [51] },
    'estoque>ajuste-estoque-lote': { essenciais: [52] },
    'estoque>inventario-mensal': { essenciais: [53] },
    'compras>lista-compras': { geral: [54], essenciais: [55, 56] },
    'compras>consulta-notas-fornecedor': {
        geral: [57],
        essenciais: [58, 59],
        nota: 'Se a importação automática não funcionar, não é erro do sistema — às vezes é o site da Receita que está fora do ar. Nesse caso, use a importação pela chave de acesso.',
    },
    'compras>devolucao-compra': { geral: [60], essenciais: [61] },
    'vendas>orcamento': { geral: [62], essenciais: [63] },
    'vendas>lista-vendas': { geral: [64], essenciais: [65] },
    'vendas>devolucao-venda': { essenciais: [66] },
    'vendas>contratos': { essenciais: [67] },
    'financeiro>planos-conta': { essenciais: [68] },
    'financeiro>formas-pagamento': { essenciais: [69] },
    'financeiro>centro-custo': { essenciais: [70] },
    'financeiro>contas': { essenciais: [71] },
    'financeiro>contas-pagar': { geral: [72], essenciais: [73, 74, 75] },
    'financeiro>contas-receber': { geral: [76], essenciais: [75, 77, 78] },
    'financeiro>encontro-contas': { geral: [79] },
    'financeiro>ficha-clientes': { geral: [80] },
    'financeiro>caixas-bancos': { geral: [81], essenciais: [82, 83] },
    'financeiro>transferencia-conta': { geral: [84] },
    'fiscal>nfse': { geral: [85], essenciais: [99] },
    'fiscal>nfce': { geral: [86], essenciais: [87] },
    'fiscal>nfe': { geral: [88], essenciais: [89, 90, 91, 92, 98] },
    'fiscal>cfop': { essenciais: [93] },
    'servicos>ordem-servico': { geral: [94], essenciais: [95, 96, 98, 99] },
    'servicos>checklist': { geral: [97] },
    'frotas>cadastro-veiculos': { geral: [100] },
    'relatorios': { geral: [101] },
    'inicio': { geral: [104], essenciais: [102] },
    'acesso': { geral: [103] },
    'faturas': { geral: [105] },
    'whatsapp': { geral: [106], essenciais: [107] },
    'app': { geral: [108] },
    'boas-vindas': { geral: [112] },
};

const VIDEOS_PDV = {
    'caixa': { geral: [109] },
    'emitir-nfce': { essenciais: [110, 111] },
};

// Trilha sequencial "Comece por aqui" — pensada pra quem tá vendo o sistema pela
// primeira vez (funcionário novo / cliente em implantação). Não mexe na navegação
// por módulo (que continua servindo quem já conhece o sistema e só quer consultar
// uma tela específica) — é um caminho em paralelo, na ordem em que as coisas
// realmente dependem umas das outras (ex: Plano de Contas antes de Contas a Pagar,
// CFOP antes de qualquer emissão). "video: null" = ainda não foi gravado; aparece
// na lista mesmo assim, como "em breve", porque a sequência em si é o produto.
const TRILHA_OFICINA = [
    {
        bloco: 'Configuração inicial (faz uma vez, na implantação)',
        itens: [
            { titulo: 'Configurações › Empresa — parâmetros gerais', video: null },
            { titulo: 'Pessoas › Contatos — Visão Geral', video: 39 },
            { titulo: 'Pessoas › Cadastro de Pessoas — Dados Básicos', video: 40 },
            { titulo: 'Pessoas › Cadastro de Pessoas — Aba Adicionais', video: 41 },
            { titulo: 'Pessoas › Vendedores', video: 43 },
            { titulo: 'Pessoas › Contador', video: 42 },
            { titulo: 'Financeiro › Contas', video: 71 },
            { titulo: 'Financeiro › Formas de Pagamento', video: 69 },
            { titulo: 'Financeiro › Planos de Conta', video: 68 },
            { titulo: 'Financeiro › Centro de Custo', video: 70 },
            { titulo: 'Estoque › Grupo', video: 47 },
            { titulo: 'Estoque › Unidades', video: 48 },
            { titulo: 'Estoque › Marcas', video: 49 },
            { titulo: 'Estoque › Produtos — Visão Geral', video: 44 },
            { titulo: 'Estoque › Cadastro de Produto — Aba Geral', video: 45 },
            { titulo: 'Estoque › Cadastro de Produto — Impostos e Combustível', video: 46 },
            { titulo: 'Estoque › Impressão de Etiqueta', video: 50 },
            { titulo: 'Frotas › Cadastro de Veículos', video: 100 },
            { titulo: 'Serviços › Configuração de Etapas da OS', video: 96 },
            { titulo: 'Acesso › Usuários', video: 103 },
            { titulo: 'Acesso › Permissões', video: 103 },
        ],
    },
    {
        bloco: 'O ciclo do serviço (o coração da oficina)',
        itens: [
            { titulo: 'Vendas › Orçamento — Visão Geral', video: 62 },
            { titulo: 'Vendas › Criar Orçamento', video: 63 },
            { titulo: 'Vendas › Contratos', video: 67 },
            { titulo: 'Serviços › Ordem de Serviço — Visão Geral', video: 94 },
            { titulo: 'Serviços › Criar OS — veículo, cliente, serviços e peças', video: 95 },
            { titulo: 'Serviços › OS — abas complementares (Problemas, Observações, Fotos)', video: 95 },
            { titulo: 'Serviços › Finalizar e Faturar OS', video: 96 },
            { titulo: 'Serviços › Mudar Status', video: 96 },
            { titulo: 'Início › Agenda', video: 102 },
        ],
    },
    {
        bloco: 'O dinheiro entrando e saindo',
        itens: [
            { titulo: 'Compras › Lista de Compras — Visão Geral', video: 54 },
            { titulo: 'Compras › Importação por XML (Ler XML)', video: 56 },
            { titulo: 'Compras › Consulta Notas de Fornecedor (DFE) — Visão Geral', video: 57 },
            { titulo: 'Compras › Importar Nota pelo DFE', video: 58 },
            { titulo: 'Compras › Nota de Compra Manual', video: 59 },
            { titulo: 'Financeiro › Contas a Pagar — Visão Geral', video: 72 },
            { titulo: 'Financeiro › Contas a Pagar — Dar baixa (F7)', video: 73 },
            { titulo: 'Financeiro › Contas a Pagar — Cadastro manual', video: 74 },
            { titulo: 'Financeiro › Contas a Receber — Visão Geral', video: 76 },
            { titulo: 'Financeiro › Contas a Receber — Dar baixa (F8)', video: 78 },
            { titulo: 'Financeiro › Contas a Receber — Cadastro manual', video: 77 },
            { titulo: 'Financeiro › Caixas e Bancos — Visão Geral', video: 81 },
            { titulo: 'Financeiro › Caixas e Bancos — Lançamento manual', video: 82 },
            { titulo: 'Financeiro › Transferência de Conta', video: 84 },
            { titulo: 'Financeiro › Adiantamento', video: 83 },
        ],
    },
    {
        bloco: 'Fiscal da oficina',
        itens: [
            { titulo: 'Fiscal › Cadastro de CFOP', video: 93 },
            { titulo: 'Fiscal › NFS-e — Visão Geral e Emissão', video: 85 },
            { titulo: 'Fiscal › NFS-e — Importar Ordem de Serviço', video: 99 },
            { titulo: 'Fiscal › NF-e — Visão Geral', video: 88 },
            { titulo: 'Fiscal › NF-e — Emissão', video: 89 },
            { titulo: 'Fiscal › NF-e — Importar Ordem de Serviço', video: 98 },
            { titulo: 'Fiscal › NF-e — Transportadora e Volumes', video: 91 },
            { titulo: 'Fiscal › NF-e — Carta de Correção (CCe) e Duplicar', video: 92 },
            { titulo: 'Fiscal › NF-e — Fechar Mês', video: 90 },
        ],
    },
    {
        bloco: 'Venda de balcão (PDV)',
        itens: [
            { titulo: 'Vendas › PDV — Caixa (abrir, sangria, suprimento, fechar)', video: 109 },
            { titulo: 'Vendas › PDV — Venda e emissão de NFC-e', video: 110 },
            { titulo: 'Vendas › PDV — Importar Pedido / Orçamento / O.S.', video: 111 },
            { titulo: 'Fiscal › NFC-e — Visão Geral', video: 86 },
            { titulo: 'Fiscal › NFC-e — Fechar Mês', video: 87 },
            { titulo: 'Vendas › Lista de Vendas', video: 64 },
        ],
    },
    {
        bloco: 'Rotinas periódicas e gestão',
        itens: [
            { titulo: 'Estoque › Ajuste de Estoque', video: 51 },
            { titulo: 'Estoque › Ajuste de Estoque em Lote', video: 52 },
            { titulo: 'Estoque › Inventário Mensal', video: 53 },
            { titulo: 'Compras › Devolução de Compra — Visão Geral', video: 60 },
            { titulo: 'Compras › Criar Devolução de Compra', video: 61 },
            { titulo: 'Vendas › Devolução de Venda', video: 66 },
            { titulo: 'Financeiro › Contas a Pagar — Renegociar', video: 75 },
            { titulo: 'Financeiro › Contas a Pagar — Estornar parcela', video: 75 },
            { titulo: 'Financeiro › Encontro de Contas', video: 79 },
            { titulo: 'Financeiro › Ficha de Clientes', video: 80 },
            { titulo: 'Frotas › Histórico do Veículo', video: 100 },
            { titulo: 'Início › Dashboards', video: 104 },
            { titulo: 'Relatórios', video: 101 },
        ],
    },
    {
        bloco: 'Diferenciais e administração',
        itens: [
            { titulo: 'WhatsApp — Conectar o número', video: 106 },
            { titulo: 'WhatsApp — Mensagens e pré-agendamento automático', video: 107 },
            { titulo: 'Serviços › Checklist do Reparador', video: 97 },
            { titulo: 'APP — Lux O.S.', video: 108 },
            { titulo: 'Barra superior › Faturas', video: 105 },
        ],
    },
];

function progressoTrilha() {
    try { return new Set(JSON.parse(localStorage.getItem('trilhaAssistidos') || '[]')); } catch { return new Set(); }
}

function marcarAssistidoTrilha(videoId) {
    const feitos = progressoTrilha();
    feitos.add(videoId);
    try { localStorage.setItem('trilhaAssistidos', JSON.stringify([...feitos])); } catch { /* navegador sem localStorage — segue sem salvar progresso */ }
}

const MENU_RETAGUARDA = [
    { id: 'inicio', label: 'Início', icone: '🏠' },
    { id: 'acesso', label: 'Acesso', icone: '🔑' },
    {
        id: 'pessoas', label: 'Pessoas', icone: '👥',
        submenu: [
            { id: 'contatos', label: 'Contatos' },
            { id: 'vendedores', label: 'Vendedores' },
            { id: 'contador', label: 'Contador' },
        ],
    },
    {
        id: 'estoque', label: 'Estoque', icone: '📦',
        submenu: [
            { id: 'produtos', label: 'Produtos' },
            { id: 'grupo', label: 'Grupo' },
            { id: 'unidades', label: 'Unidades' },
            { id: 'marcas', label: 'Marcas' },
            { id: 'imp-etiqueta', label: 'Imp. de Etiqueta' },
            { id: 'ajuste-estoque', label: 'Ajuste de Estoque' },
            { id: 'ajuste-estoque-lote', label: 'Ajuste de Estoque em Lote' },
            { id: 'inventario-mensal', label: 'Inventário Mensal' },
        ],
    },
    {
        id: 'compras', label: 'Compras', icone: '🛒',
        submenu: [
            { id: 'lista-compras', label: 'Lista Compras' },
            { id: 'consulta-notas-fornecedor', label: 'Consulta Notas de Fornecedor' },
            { id: 'devolucao-compra', label: 'Devolução de Compra' },
        ],
    },
    {
        id: 'vendas', label: 'Vendas', icone: '💲',
        submenu: [
            { id: 'orcamento', label: 'Orçamento' },
            { id: 'pdv-vendas', label: 'PDV - Vendas' },
            { id: 'lista-vendas', label: 'Lista de Vendas' },
            { id: 'devolucao-venda', label: 'Devolução de Venda' },
            { id: 'contratos', label: 'Contratos' },
        ],
    },
    {
        id: 'financeiro', label: 'Financeiro', icone: '💰',
        submenu: [
            { id: 'formas-pagamento', label: 'Formas de Pagamento' },
            { id: 'planos-conta', label: 'Planos de Conta' },
            { id: 'centro-custo', label: 'Centro de Custo' },
            { id: 'contas', label: 'Contas' },
            { id: 'contas-pagar', label: 'Contas à Pagar' },
            { id: 'contas-receber', label: 'Contas à Receber' },
            { id: 'encontro-contas', label: 'Encontro Contas' },
            { id: 'ficha-clientes', label: 'Ficha de Clientes' },
            { id: 'caixas-bancos', label: 'Caixas e Bancos' },
            { id: 'transferencia-conta', label: 'Transferência de Conta' },
        ],
    },
    {
        id: 'fiscal', label: 'Fiscal', icone: '🧾',
        submenu: [
            { id: 'nfse', label: 'NFS-e' },
            { id: 'nfce', label: 'NFC-e' },
            { id: 'nfe', label: 'NF-e' },
            { id: 'cfop', label: 'Cadastro de CFOP' },
        ],
    },
    {
        id: 'servicos', label: 'Serviços', icone: '🔧',
        submenu: [
            { id: 'ordem-servico', label: 'Ordem de Serviço' },
            { id: 'checklist', label: 'Checklist' },
        ],
    },
    {
        id: 'frotas', label: 'Frotas', icone: '🚚',
        submenu: [
            { id: 'cadastro-veiculos', label: 'Cadastro de Veículos' },
        ],
    },
    { id: 'relatorios', label: 'Relatórios', icone: '📊' },
    { id: 'configuracoes', label: 'Configurações', icone: '⚙️' },
];

const MENU_PDV = [
    { id: 'caixa', label: 'Caixa', icone: '💵' },
    { id: 'emitir-nfce', label: 'Emitir NFC-e', icone: '🧾' },
];

const SISTEMAS = {
    retaguarda: { menu: MENU_RETAGUARDA, videos: VIDEOS_RETAGUARDA },
    pdv: { menu: MENU_PDV, videos: VIDEOS_PDV },
};

let sistemaAtivo = 'retaguarda';
const noPorSistema = { retaguarda: 'boas-vindas', pdv: 'caixa' };
let todosVideos = null;
let fuseIndex = null;

function menuAtual() { return SISTEMAS[sistemaAtivo].menu; }
function noAtivo() { return noPorSistema[sistemaAtivo]; }

// Guarda sistema+tela atual na URL (#retaguarda:pessoas>contatos), assim um F5 ou
// um link direto volta pra mesma tela em vez de sempre reiniciar do zero.
function salvarEstadoNaUrl() {
    history.replaceState(null, '', `#${sistemaAtivo}:${noAtivo()}`);
}

function restaurarEstadoDaUrl() {
    const [sistema, no] = location.hash.slice(1).split(':');
    if (sistema && SISTEMAS[sistema]) sistemaAtivo = sistema;
    if (no) noPorSistema[sistemaAtivo] = no;
}

function limparBuscaGeralUI() {
    $('buscaGeral').value = '';
    $('limparBuscaGeral').hidden = true;
}

function navegarPara(no) {
    noPorSistema[sistemaAtivo] = no;
    limparBuscaGeralUI();
    renderSidebar();
    renderConteudo();
    salvarEstadoNaUrl();
}

function trocarSistema(sistema) {
    sistemaAtivo = sistema;
    limparBuscaGeralUI();
    renderTudo();
    salvarEstadoNaUrl();
}

function videosPara(no) {
    return SISTEMAS[sistemaAtivo].videos[no];
}

function renderTopo() {
    if (sistemaAtivo === 'retaguarda') {
        $('topbar').innerHTML = `
            <div class="topbar">
                <div class="marca"><img src="assets/logos/luxauto-logo.png" alt="LuxAUTO"></div>
                <div class="acoes">
                    <span class="ac clicavel" id="btnEntrarPdv"><span class="ic">🖨️</span><span class="txt">PDV</span></span>
                    <span class="ac clicavel" id="btnApp"><span class="ic">📱</span><span class="txt">APP</span></span>
                    <span class="ac clicavel" id="btnOrdemServico"><span class="ic">📋</span><span class="txt">Ordem de Serviço</span></span>
                    <span class="ac clicavel" id="btnFaturas"><span class="ic">🧾</span><span class="txt">Faturas</span></span>
                    <span class="ac redondo clicavel" id="btnWhatsapp"><img src="assets/logos/whatsapp.png" alt="WhatsApp"></span>
                    <span class="ac redondo">?</span>
                    <span class="ac"><span class="ic">👤</span><span class="txt">ADMIN</span></span>
                </div>
            </div>`;
        $('tabstrip').innerHTML = `
            <div class="tabstrip">
                <div class="tabs">
                    <div class="tab" id="tabDashboard">Dashboard <span class="x">✕</span></div>
                    <div class="tab ativa" id="tabModulo">Tutoriais <span class="x">✕</span></div>
                </div>
            </div>`;
        $('btnEntrarPdv').addEventListener('click', () => trocarSistema('pdv'));
        $('tabDashboard').addEventListener('click', () => navegarPara('inicio'));
        $('btnOrdemServico').addEventListener('click', () => navegarPara('servicos>ordem-servico'));
        $('btnFaturas').addEventListener('click', () => navegarPara('faturas'));
        $('btnApp').addEventListener('click', () => navegarPara('app'));
        $('btnWhatsapp').addEventListener('click', () => navegarPara('whatsapp'));
    } else {
        $('topbar').innerHTML = `
            <div class="topbar pdv">
                <div class="marca-pdv"><img src="assets/logos/pdv-logo.png" alt="PDV">CAIXA ABERTO</div>
                <div class="acoes-pdv">
                    <span class="ac clicavel" id="btnVoltarRetaguarda"><img class="ic-img" src="assets/logos/retaguarda-icon.png" alt=""><span class="txt">Retaguarda</span></span>
                    <span class="lux-txt">LUX SISTEMAS</span>
                    <span class="ajuda">❓ Ajuda</span>
                    <span class="janela-ic">▢</span>
                    <span class="janela-ic">✕</span>
                </div>
            </div>`;
        $('tabstrip').innerHTML = `
            <div class="tabstrip">
                <div class="tabs">
                    <div class="tab ativa" id="tabModulo">Tutoriais</div>
                </div>
            </div>`;
        $('btnVoltarRetaguarda').addEventListener('click', () => trocarSistema('retaguarda'));
    }
    document.body.classList.toggle('modo-pdv', sistemaAtivo === 'pdv');
}

function renderSidebar() {
    const menu = menuAtual();
    const no = noAtivo();
    const entradaTrilha = `
        <div class="item-menu ${no === 'trilha' ? 'ativo' : ''}" data-no="trilha"><span class="ic">📚</span><span class="lbl">Comece por aqui</span></div>
        <div class="sidebar-divisor"></div>`;
    $('sidebar').innerHTML = entradaTrilha + menu.map((mod) => {
        if (!mod.submenu) {
            return `<div class="item-menu ${no === mod.id ? 'ativo' : ''}" data-no="${mod.id}"><span class="ic">${mod.icone}</span><span class="lbl">${escapeHtml(mod.label)}</span></div>`;
        }
        const submenuAberto = no.startsWith(mod.id + '>');
        const subitens = mod.submenu.map((sub) => {
            const subno = `${mod.id}>${sub.id}`;
            return `<div class="subitem ${subno === no ? 'ativo' : ''}" data-no="${subno}">${escapeHtml(sub.label)}</div>`;
        }).join('');
        return `
            <div class="item-menu ${submenuAberto ? 'aberto' : ''}" data-modulo="${mod.id}">
                <span class="ic">${mod.icone}</span><span class="lbl">${escapeHtml(mod.label)}</span><span class="seta">▶</span>
            </div>
            <div class="submenu ${submenuAberto ? 'aberto' : ''}" data-submenu-de="${mod.id}">${subitens}</div>`;
    }).join('');
}

const EXTRAS_LABEL = { faturas: 'Faturas', app: 'App', whatsapp: 'WhatsApp', 'boas-vindas': 'Bem-vindo', trilha: 'Comece por aqui' };

function labelDoNo(no) {
    const [moduloId, subId] = no.split('>');
    const modulo = menuAtual().find((m) => m.id === moduloId);
    if (!modulo) return [EXTRAS_LABEL[no] || no];
    if (!subId) return [modulo.label];
    const sub = modulo.submenu.find((s) => s.id === subId);
    return [modulo.label, sub ? sub.label : subId];
}

function cardVideoHtml(v) {
    const thumb = thumbUrl(v.url);
    return `
        <div class="vcard">
            ${thumb ? `<img class="vthumb" src="${thumb}" alt="">` : '<div class="vthumb"></div>'}
            <div class="vbody">
                <h2>${escapeHtml(v.titulo)}</h2>
                ${v.descricao ? `<p class="vdesc">${escapeHtml(v.descricao)}</p>` : ''}
                <button type="button" class="btn-assistir" data-url="${escapeHtml(v.url)}" data-titulo="${escapeHtml(v.titulo)}">▶ assistir</button>
            </div>
        </div>`;
}

function abrirPlayer(url, titulo, onProximo) {
    const id = extrairIdYoutube(url);
    $('playerTitulo').textContent = titulo;
    if (id) {
        $('playerCorpo').innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" title="${escapeHtml(titulo)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        $('playerCorpo').innerHTML = `<div class="player-sem-embed">Esse vídeo não pode ser exibido aqui. <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir em outra aba</a></div>`;
    }
    $('playerRodape').innerHTML = onProximo ? `<button type="button" class="btn-assistir" id="btnProximoVideo">Próximo vídeo →</button>` : '';
    if (onProximo) $('btnProximoVideo').addEventListener('click', onProximo);
    $('overlayPlayer').style.display = 'flex';
}

function fecharPlayer() {
    $('overlayPlayer').style.display = 'none';
    $('playerCorpo').innerHTML = '';
}

function placeholderHtml(texto) {
    return `<div class="placeholder"><div class="ic">🚧</div><p>${escapeHtml(texto)}</p></div>`;
}

async function carregarVideos() {
    if (todosVideos) return todosVideos;
    try {
        const res = await fetch('videos.json');
        if (!res.ok) { todosVideos = 'erro'; return todosVideos; }
        todosVideos = await res.json();
    } catch {
        todosVideos = 'erro';
        return todosVideos;
    }
    fuseIndex = new Fuse(todosVideos, {
        keys: [
            { name: 'titulo', weight: 3 },
            { name: 'tags', weight: 2 },
            { name: 'categoria_nome', weight: 1 },
            { name: 'descricao', weight: 0.5 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        minMatchCharLength: 2,
        shouldSort: true,
        getFn: (obj, path) => normalizarTexto(obj[Array.isArray(path) ? path[0] : path]),
    });
    return todosVideos;
}

async function renderBuscaGeral(query) {
    const videos = await carregarVideos();
    if (videos === 'erro' || !fuseIndex) return;
    const resultados = fuseIndex.search(normalizarTexto(query)).map((r) => r.item);
    $('conteudo').innerHTML = `
        <div class="trilha">Busca geral</div>
        <h1>Resultados para "${escapeHtml(query)}"</h1>
        <p class="resultado-info">${resultados.length} vídeo${resultados.length !== 1 ? 's' : ''} encontrado${resultados.length !== 1 ? 's' : ''}</p>
        ${resultados.length ? `<div class="grid-videos">${resultados.map(cardVideoHtml).join('')}</div>` : placeholderHtml('Nenhum vídeo encontrado para essa busca.')}
    `;
}

function tocarPassoTrilha(passos, porId, index) {
    const passo = passos[index];
    if (!passo) return;
    const v = porId[passo.video];
    if (!v) return;
    marcarAssistidoTrilha(passo.video);
    // Marca TODO passo que usa esse mesmo vídeo (ex: Usuários/Permissões são o mesmo
    // vídeo, duas linhas na trilha), não só a que foi clicada.
    document.querySelectorAll(`.trilha-item[data-video="${passo.video}"]`).forEach((el) => {
        el.classList.add('feito');
        const marcador = el.querySelector('.trilha-marcador');
        if (marcador) marcador.textContent = '✓';
    });
    // Pula pro próximo passo que seja de fato um vídeo diferente — senão "próximo
    // vídeo" reabriria o mesmo vídeo de novo quando dois passos seguidos o compartilham.
    let proximoIndex = index + 1;
    while (proximoIndex < passos.length && passos[proximoIndex].video === passo.video) proximoIndex++;
    const temProximo = proximoIndex < passos.length;
    abrirPlayer(v.url, v.titulo, temProximo ? () => tocarPassoTrilha(passos, porId, proximoIndex) : null);
}

async function renderTrilha() {
    $('tabModulo').innerHTML = `Comece por aqui <span class="x">✕</span>`;
    $('conteudo').innerHTML = `<div class="trilha">Trilha de aprendizado</div><h1>Comece por aqui</h1><div id="areaTrilha">carregando…</div>`;

    const videos = await carregarVideos();
    if (videos === 'erro') {
        $('areaTrilha').outerHTML = `<div id="areaTrilha">${placeholderHtml('Não consegui carregar os vídeos agora.')}</div>`;
        return;
    }

    const porId = Object.fromEntries(videos.map((v) => [v.id, v]));
    const feitos = progressoTrilha();
    const passos = TRILHA_OFICINA.flatMap((bloco) => bloco.itens).filter((item) => item.video && porId[item.video]);

    const blocosHtml = TRILHA_OFICINA.map((bloco) => `
        <div class="trilha-bloco">
            <h2 class="trilha-bloco-titulo">${escapeHtml(bloco.bloco)}</h2>
            ${bloco.itens.map((item) => {
                const v = item.video ? porId[item.video] : null;
                const feito = v && feitos.has(item.video);
                const classe = !v ? 'em-breve' : feito ? 'feito' : '';
                const marcador = !v ? '🔒' : feito ? '✓' : '▶';
                return `<div class="trilha-item ${classe}" ${v ? `data-video="${item.video}"` : ''}>
                    <span class="trilha-marcador">${marcador}</span>
                    <span class="trilha-titulo">${escapeHtml(item.titulo)}</span>
                    ${!v ? '<span class="trilha-badge">em breve</span>' : ''}
                </div>`;
            }).join('')}
        </div>`).join('');

    $('areaTrilha').outerHTML = `<div id="areaTrilha">${blocosHtml}</div>`;

    document.querySelectorAll('#areaTrilha .trilha-item[data-video]').forEach((el) => {
        el.addEventListener('click', () => {
            const index = passos.findIndex((p) => p.video === Number(el.dataset.video));
            if (index !== -1) tocarPassoTrilha(passos, porId, index);
        });
    });
}

async function renderConteudo() {
    const no = noAtivo();
    if (no === 'trilha') { await renderTrilha(); return; }
    const [tituloModulo, tituloSub] = labelDoNo(no);
    $('tabModulo').innerHTML = `${escapeHtml(tituloSub || tituloModulo)} <span class="x">✕</span>`;
    $('conteudo').innerHTML = `<div class="trilha">${escapeHtml(tituloModulo)}${tituloSub ? ' / ' + escapeHtml(tituloSub) : ''}</div><h1>Tutoriais em vídeo</h1><div id="areaVideos">carregando…</div>`;

    const categorias = videosPara(no);
    if (!categorias) {
        $('areaVideos').outerHTML = `<div id="areaVideos">${placeholderHtml('Os tutoriais desse módulo ainda estão sendo organizados — em breve chegam aqui.')}</div>`;
        return;
    }

    const videos = await carregarVideos();
    if (videos === 'erro') {
        $('areaVideos').outerHTML = `<div id="areaVideos">${placeholderHtml('Não consegui carregar os vídeos agora.')}</div>`;
        return;
    }

    const porId = Object.fromEntries(videos.map((v) => [v.id, v]));
    const secoesHtml = CATEGORIAS_VIDEO.map(({ chave, label }) => {
        const ids = categorias[chave];
        if (!ids || !ids.length) return '';
        const encontrados = ids.map((id) => porId[id]).filter(Boolean);
        if (!encontrados.length) return '';
        return `<div class="secao-videos">
            <h2 class="secao-titulo">${escapeHtml(label)}</h2>
            <div class="grid-videos">${encontrados.map(cardVideoHtml).join('')}</div>
        </div>`;
    }).join('');

    const notaHtml = categorias.nota ? `<div class="aviso-nota">⚠️ ${escapeHtml(categorias.nota)}</div>` : '';
    const filtroHtml = secoesHtml ? `<input type="text" class="busca-submenu" id="buscaSubmenu" placeholder="Filtrar vídeos dessa tela...">` : '';
    $('areaVideos').outerHTML = `<div id="areaVideos">${notaHtml}${filtroHtml}${secoesHtml || placeholderHtml('Os tutoriais desse módulo ainda estão sendo organizados — em breve chegam aqui.')}</div>`;

    const buscaSub = $('buscaSubmenu');
    if (buscaSub) {
        buscaSub.addEventListener('input', () => {
            const termo = normalizarTexto(buscaSub.value.trim());
            document.querySelectorAll('#areaVideos .secao-videos').forEach((secao) => {
                let algumVisivel = false;
                secao.querySelectorAll('.vcard').forEach((card) => {
                    const titulo = normalizarTexto(card.querySelector('h2').textContent);
                    const visivel = !termo || titulo.includes(termo);
                    card.style.display = visivel ? '' : 'none';
                    if (visivel) algumVisivel = true;
                });
                secao.style.display = algumVisivel ? '' : 'none';
            });
        });
    }
}

function renderTudo() {
    renderTopo();
    renderSidebar();
    renderConteudo();
}

document.body.addEventListener('click', (e) => {
    const assistir = e.target.closest('.btn-assistir');
    if (assistir) {
        abrirPlayer(assistir.dataset.url, assistir.dataset.titulo);
        return;
    }
    const sub = e.target.closest('.subitem');
    if (sub) {
        if (sub.dataset.no === 'vendas>pdv-vendas') { trocarSistema('pdv'); return; }
        navegarPara(sub.dataset.no);
        return;
    }
    const item = e.target.closest('.item-menu[data-modulo]');
    if (item) {
        const modId = item.dataset.modulo;
        const atual = noAtivo();
        navegarPara(atual.startsWith(modId + '>') ? modId : `${modId}>${menuAtual().find((m) => m.id === modId).submenu[0].id}`);
        return;
    }
    const simples = e.target.closest('.item-menu[data-no]');
    if (simples) {
        navegarPara(simples.dataset.no);
    }
});

let debounceBuscaGeral;
$('buscaGeral').addEventListener('input', () => {
    clearTimeout(debounceBuscaGeral);
    const valor = $('buscaGeral').value.trim();
    $('limparBuscaGeral').hidden = !valor;
    debounceBuscaGeral = setTimeout(() => {
        if (valor.length >= 2) renderBuscaGeral(valor);
        else renderConteudo();
    }, 150);
});

$('limparBuscaGeral').addEventListener('click', () => {
    $('buscaGeral').value = '';
    $('limparBuscaGeral').hidden = true;
    renderConteudo();
});

$('fecharPlayer').addEventListener('click', fecharPlayer);
$('overlayPlayer').addEventListener('click', (e) => {
    if (e.target.id === 'overlayPlayer') fecharPlayer();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('overlayPlayer').style.display === 'flex') fecharPlayer();
});

restaurarEstadoDaUrl();
renderTudo();
salvarEstadoNaUrl();

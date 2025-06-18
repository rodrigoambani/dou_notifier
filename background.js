// Constantes para URL base e seletores
const DOU_BASE_URL = "https://www.in.gov.br/leiturajornal";
// Use os seletores baseados na análise do HTML que você forneceu
// Ajuste estes seletores se a estrutura do site mudar
const PUBLICATION_ITEM_SELECTOR = '.resultado';
const TITLE_SELECTOR = 'h5.title-marker a';
const LINK_SELECTOR = 'h5.title-marker a';
const ABSTRACT_SELECTOR = 'p.abstract-marker';
const PUBLICATION_INFO_SELECTOR = '.publication-info-marker';
const DATE_MARKER_SELECTOR = 'p.date-marker';
const HIERARCHY_ITEM_SELECTOR = '.hierarchy-item-marker';

// Cria um alarme para verificar o DOU a cada 60 minutos (ajuste conforme necessário)
chrome.alarms.create('checkDOU', { periodInMinutes: 60 });

// Listener para o alarme
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkDOU') {
    checkNewPublications();
  }
});

// Função principal para verificar novas publicações
async function checkNewPublications() {
  const settings = await chrome.storage.sync.get(['keywords', 'organizations', 'lastCheckedPublications']);
  const keywords = settings.keywords || [];
  const organizations = settings.organizations || [];
  let lastCheckedPublications = settings.lastCheckedPublications || [];

  if (organizations.length === 0) {
    console.log("Nenhuma organização configurada. Pulando a verificação do DOU.");
    return; // Não faz nada se não houver organizações para monitorar
  }

  // Obter a data de hoje formatada para a URL
  const todayDate = getFormattedDate();

  for (const org of organizations) {
    // Constrói a URL com base nos filtros da organização
    const douUrl = `${DOU_BASE_URL}?data=${todayDate}&secao=${org.section}&org=${encodeURIComponent(org.main)}&org_sub=${encodeURIComponent(org.sub)}`;
    console.log(`Verificando DOU para: ${org.main} - ${org.sub} na seção ${org.section}`);

    try {
      const response = await fetch(douUrl);
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      const currentPublications = [];
      const publicationElements = doc.querySelectorAll(PUBLICATION_ITEM_SELECTOR);

      publicationElements.forEach(el => {
        const titleElement = el.querySelector(TITLE_SELECTOR);
        const title = titleElement ? titleElement.textContent.trim() : '';
        const link = titleElement ? titleElement.href : '';

        const abstractElement = el.querySelector(ABSTRACT_SELECTOR);
        const abstract = abstractElement ? abstractElement.textContent.trim() : '';

        const publicationInfoElement = el.querySelector(PUBLICATION_INFO_SELECTOR);
        const publicationInfo = publicationInfoElement ? publicationInfoElement.textContent.trim() : '';

        const hierarchyElements = el.querySelectorAll(HIERARCHY_ITEM_SELECTOR);
        const hierarchy = Array.from(hierarchyElements).map(el => el.textContent.trim()).join(' > ');

        // Criar um identificador único para a publicação para evitar duplicações
        const uniqueId = `${link}-${title}-${publicationInfo}`;
        currentPublications.push(uniqueId);

        // Lógica de busca por palavras-chave e notificação
        const isNew = !lastCheckedPublications.includes(uniqueId);
        const textToSearch = `${title} ${abstract} ${hierarchy} ${publicationInfo}`.toLowerCase();
        const matchesKeyword = keywords.some(keyword => textToSearch.includes(keyword.toLowerCase()));

        if (isNew && matchesKeyword) {
          console.log('Nova publicação encontrada e correspondente:', title);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: `Nova publicação no DOU para ${org.main}!`,
            message: `${title} (${hierarchy})`,
            priority: 2,
            contextMessage: 'Clique para ver a publicação',
            buttons: [{ title: 'Abrir no DOU' }]
          }, (notificationId) => {
            // Adiciona um listener para quando a notificação for clicada
            chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
              if (notifId === notificationId && btnIdx === 0) {
                chrome.tabs.create({ url: link });
              }
            });
          });
        }
      });

      // Atualiza o histórico de publicações verificadas, mantendo um limite para não crescer indefinidamente
      lastCheckedPublications = [...new Set([...lastCheckedPublications, ...currentPublications])].slice(-500);
      await chrome.storage.sync.set({ lastCheckedPublications: lastCheckedPublications });

    } catch (error) {
      console.error(`Erro ao buscar DOU para ${org.main} - ${org.sub}:`, error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Erro na verificação do DOU',
        message: `Não foi possível verificar publicações para ${org.main} - ${org.sub}. Verifique sua conexão ou a URL.`,
        priority: 0
      });
    }
  }
}

// Função auxiliar para formatar a data como "DD-MM-YYYY"
function getFormattedDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexed
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Dispara uma verificação inicial quando a extensão é instalada/atualizada
chrome.runtime.onInstalled.addListener(() => {
  checkNewPublications();
});

// Listener para mensagens do popup para forçar uma verificação
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "manualCheck") {
    checkNewPublications();
    sendResponse({ status: "Verificação iniciada!" });
  }
});

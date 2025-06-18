document.addEventListener('DOMContentLoaded', loadSettings);

document.getElementById('saveKeywordsBtn').addEventListener('click', saveKeywords);
document.getElementById('addOrgBtn').addEventListener('click', addOrganization);
document.getElementById('manualCheckBtn').addEventListener('click', manualCheck);

async function loadSettings() {
    const settings = await chrome.storage.sync.get(['keywords', 'organizations']);
    document.getElementById('keywordsInput').value = (settings.keywords || []).join(', ');
    renderOrganizations(settings.organizations || []);
}

async function saveKeywords() {
    const keywordsText = document.getElementById('keywordsInput').value;
    const keywords = keywordsText.split(',').map(k => k.trim()).filter(k => k.length > 0);
    await chrome.storage.sync.set({ keywords: keywords });
    displayStatus('Palavras-chave salvas!', true);
}

async function addOrganization() {
    const section = document.getElementById('sectionSelect').value;
    const mainOrg = document.getElementById('mainOrgInput').value.trim();
    const subOrg = document.getElementById('subOrgInput').value.trim();

    if (!mainOrg) {
        displayStatus('A Organização Principal não pode estar vazia.', false);
        return;
    }

    const settings = await chrome.storage.sync.get('organizations');
    const organizations = settings.organizations || [];

    const newOrg = { section: section, main: mainOrg, sub: subOrg };

    // Verifica se a organização já existe para evitar duplicatas
    const exists = organizations.some(org => 
        org.section === newOrg.section && 
        org.main === newOrg.main && 
        org.sub === newOrg.sub
    );

    if (!exists) {
        organizations.push(newOrg);
        await chrome.storage.sync.set({ organizations: organizations });
        renderOrganizations(organizations);
        document.getElementById('mainOrgInput').value = '';
        document.getElementById('subOrgInput').value = '';
        displayStatus('Organização adicionada!', true);
    } else {
        displayStatus('Esta organização já está na lista.', false);
    }
}

async function removeOrganization(index) {
    const settings = await chrome.storage.sync.get('organizations');
    const organizations = settings.organizations || [];
    organizations.splice(index, 1);
    await chrome.storage.sync.set({ organizations: organizations });
    renderOrganizations(organizations);
    displayStatus('Organização removida!', true);
}

function renderOrganizations(organizations) {
    const listDiv = document.getElementById('organizationsList');
    listDiv.innerHTML = '';
    if (organizations.length === 0) {
        listDiv.innerHTML = '<p>Nenhuma organização adicionada ainda.</p>';
        return;
    }
    organizations.forEach((org, index) => {
        const div = document.createElement('div');
        div.className = 'org-item';
        div.innerHTML = `
            <span>${org.main} (${org.section.toUpperCase()}) ${org.sub ? ` - ${org.sub}` : ''}</span>
            <button data-index="${index}">Remover</button>
        `;
        div.querySelector('button').addEventListener('click', () => removeOrganization(index));
        listDiv.appendChild(div);
    });
}

function displayStatus(message, isSuccess) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.style.color = isSuccess ? 'green' : 'red';
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 3000);
}

async function manualCheck() {
    displayStatus('Iniciando verificação manual...', true);
    chrome.runtime.sendMessage({ action: "manualCheck" }, (response) => {
        console.log(response.status);
        displayStatus(response.status, true);
    });
}

import {
  getConfigurationByHost,
  getCurrentTabHostname,
  cleanPastRequests,
  getDomainFromURL,
  getRequests,
  cleanRequestsByHost,
} from '../../utils.js';

async function init() {
  await cleanPastRequests();
  const { requests } = await getRequests();

  if (requests) {
    await mountTableContent(requests);
  }

  document
    .getElementById('config-page-btn')
    .addEventListener('click', openConfigPage);

  document
    .getElementById('clean-requests-btn')
    .addEventListener('click', cleanRequests);

  listenForRequests();
}

async function listenForRequests() {
  chrome.runtime.onMessage.addListener(async function (
    message,
    _sender,
    sendResponse
  ) {
    if (message.type === 'new_request') {
      sendResponse();
      await appendNewRequest(message.request);
      return;
    }
    sendResponse();
  });
}

async function mountTableContent(requests) {
  const hostname = await getCurrentTabHostname();
  const table = document.getElementById('request_list');
  if (!table) {
    throw new Error('Could not find table');
  }

  const config = await getConfigurationByHost(hostname);

  const filtered = requests.filter((request) => {
    const requestHostname = getDomainFromURL(request.initiator);
    // Filter requests by hostname and requests that have a traceId (finished)
    return requestHostname === hostname && request.traceId;
  });

  if (filtered.length) {
    filtered.forEach((request) => {
      addRow(table, request, config);
    });
  } else {
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th>Status</th>
          <th class="description">Description</th>
          <th>Duration</th>
          <th>Trace</th>
        </tr>
      </thead>
      `;
  }
}

async function appendNewRequest(request) {
  const table = document.getElementById('request_list');
  if (!table) {
    throw new Error('Could not find table');
  }

  const hostname = await getCurrentTabHostname();
  const config = await getConfigurationByHost(hostname);
  const requestHostname = getDomainFromURL(request.initiator);

  if (requestHostname === hostname && request.traceId) {
    addRow(table, request, config);
  }
}

function addRow(table, request, config) {
  const row = table.insertRow(-1);
  row.insertCell(-1).innerHTML = new Date(request.date).toLocaleString();
  row.insertCell(-1).innerHTML = request.method;
  row.insertCell(-1).innerHTML = request.status;
  row.insertCell(-1).innerHTML = request.description;
  row.insertCell(-1).innerHTML = request.time.toFixed(2) + 'ms';
  row.insertCell(-1).innerHTML = config
    ? `<a href="${mountJaegerLink(
        config.jaeger_url,
        request.traceId,
        config.user,
        config.pwd,
        request.isGraphQL,
        request.description
      )}" rel="noopener noreferrer" target="_blank">See on Jaeger</a>`
    : 'Please, configure the extension for this host';
}

async function openConfigPage() {
  const tabURL = chrome.runtime.getURL('views/configuration/index.html');
  const result = await chrome.tabs.query({
    url: tabURL,
  });

  if (!result.length) {
    await chrome.tabs.create({ url: tabURL });
  } else {
    await chrome.tabs.update(result[0].id, { active: true });
  }
}

async function cleanRequests() {
  const hostname = await getCurrentTabHostname();
  await cleanRequestsByHost(hostname);
  const { requests } = await getRequests();
  await mountTableContent(requests);
}

function mountJaegerLink(
  url,
  traceId,
  user,
  pwd,
  isGraphQL = false,
  operationName
) {
  if (Boolean(user) && Boolean(pwd)) {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol +
      '//' +
      user +
      ':' +
      pwd +
      '@' +
      parsedUrl.host +
      parsedUrl.pathname +
      traceId +
      (isGraphQL ? `?uiFind=${operationName}` : '')
    );
  }

  return url + traceId + (isGraphQL ? `?uiFind=${operationName}` : '');
}

init();

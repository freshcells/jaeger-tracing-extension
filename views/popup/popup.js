import {
  getConfigurationByHost,
  getCurrentTabHostname,
  cleanPastRequests,
  getDomainFromURL,
  getRequests,
  cleanRequestsByHost,
  numberToMonth,
} from '../../utils.js';

async function init() {
  await cleanPastRequests();
  const { requests } = await getRequests();

  if (requests) {
    await mountTableContent(requests);
  }

  document
    .getElementsByClassName('header-close-btn')[0]
    .addEventListener('click', closePopup);
  document.getElementById('settings').addEventListener('click', openConfigPage);
  document.getElementById('clear').addEventListener('click', cleanRequests);

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
    filtered
      .sort((a, b) => {
        return b.date - a.date;
      })
      .forEach((request) => {
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
      <tbody></tbody>
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
  const row = table.getElementsByTagName('tbody')[0].insertRow(-1);

  const dateRow = row.insertCell(-1);
  dateRow.innerHTML = renderDate(new Date(request.date));

  const methodRow = row.insertCell(-1);
  methodRow.setAttribute('class', request.method.toLowerCase());
  methodRow.innerHTML = request.method;

  const statusRow = row.insertCell(-1);
  statusRow.innerHTML = request.status;

  const descriptionRow = row.insertCell(-1);
  descriptionRow.innerHTML = request.description;

  const timeRow = row.insertCell(-1);
  timeRow.setAttribute('class', getTimeClassname(request.time));
  timeRow.innerHTML = request.time.toFixed(2) + 'ms';

  row.insertCell(-1).innerHTML = config
    ? `<a class="view" href="${mountJaegerLink(
        config,
        request.traceId,
        request.isGraphQL,
        request.description
      )}" rel="noopener noreferrer" target="_blank">View</a>`
    : '-';
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

function mountJaegerLink(config, traceId, isGraphQL = false, operationName) {
  const {
    jaeger_url: url,
    auth_user: user,
    auth_password: pwd,
    enable_search,
  } = config;

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
      (enable_search && isGraphQL ? `?uiFind=${operationName}` : '')
    );
  }

  return (
    url +
    traceId +
    (enable_search && isGraphQL ? `?uiFind=${operationName}` : '')
  );
}

function closePopup() {
  window.close();
}

function renderDate(date) {
  return `<span class="date">${date.getDate()}. ${numberToMonth(
    date.getMonth()
  )},</span></br><span class="time">${padDateNumber(
    date.getHours()
  )}:${padDateNumber(date.getMinutes())}:${padDateNumber(
    date.getSeconds()
  )}</span>`;
}

function padDateNumber(number) {
  return number.toString().padStart(2, '0');
}

function getTimeClassname(time) {
  if (time <= 200) {
    return 'fast-response';
  }

  if (time < 1000) {
    return 'medium-response';
  }

  return 'slow-response';
}

init();

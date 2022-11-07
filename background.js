import { getRequests } from './utils.js';

chrome.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
  if (request == 'ping') {
    sendResponse('pong');
    return;
  }
  sendResponse();
});

chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  { urls: [`*://*.fcse.io/*`], types: ['xmlhttprequest'] },
  ['requestBody']
);

chrome.webRequest.onCompleted.addListener(
  onCompleted,
  { urls: [`*://*.fcse.io/**`], types: ['xmlhttprequest'] },
  ['responseHeaders']
);

async function onBeforeRequest(details) {
  const { requests } = await getRequests();
  const traceDate = new Date();
  traceDate.setHours(0, 0, 0, 0);

  let description = details.url;
  if (details.requestBody && Object.keys(details.requestBody).length > 0) {
    const body = parseRequestBody(details.requestBody);

    if (body && body.query && /query|mutation/.test(body.query)) {
      description =
        'operationName' in body
          ? 'Operation: ' + body.operationName
          : description;
    }

    requests.push({
      traceDate: traceDate.getTime(),
      date: new Date().getTime(),
      requestId: details.requestId,
      description,
      initiator: details.initiator,
      method: details.method,
      status: null,
      traceId: null,
      time: details.timeStamp,
    });
  } else {
    requests.push({
      traceDate,
      date: new Date().getTime(),
      requestId: details.requestId,
      description: details.url,
      initiator: details.initiator,
      method: details.method,
      status: null,
      traceId: null,
      time: details.timeStamp,
    });
  }

  await chrome.storage.local.set({ requests });
}

async function onCompleted(details) {
  const { requests } = await getRequests();
  const requestIndex = requests.findIndex(
    (r) => r.requestId === details.requestId
  );
  if (requestIndex >= 0) {
    const request = requests[requestIndex];
    const traceId = details.responseHeaders.find(
      (header) => header.name === 'x-trace-id'
    );

    request.status = details.statusCode;
    request.traceId = traceId ? traceId.value : null;
    request.time = details.timeStamp - request.time;
    if (request.traceId) {
      requests[requestIndex] = request;
      try {
        await chrome.runtime.sendMessage(null, {
          type: 'new_request',
          request,
        });
      } catch (error) {
        // Extension popup is not open
        console.error(error);
      }
    } else {
      requests.splice(requestIndex, 1);
    }
  }

  await chrome.storage.local.set({ requests });
}

function parseRequestBody(requestBody) {
  if (!requestBody.raw) {
    return null;
  }

  try {
    const stringBody = String.fromCharCode.apply(
      null,
      new Uint8Array(requestBody.raw[0].bytes)
    );
    return JSON.parse(stringBody);
  } catch (error) {
    return null;
  }
}

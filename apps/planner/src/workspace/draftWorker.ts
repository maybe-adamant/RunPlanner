import { catalog } from '@run-planner/hades2-catalog';

import { answerDraftWorkerRequest, type DraftWorkerRequest } from './draftWorkerProtocol';

// The draft search runs here so the editor stays responsive.
self.onmessage = (message: MessageEvent<DraftWorkerRequest>) => {
  self.postMessage(answerDraftWorkerRequest(catalog, message.data));
};

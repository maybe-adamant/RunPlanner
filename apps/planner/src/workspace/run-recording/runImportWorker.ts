import { catalog } from '@run-planner/hades2-catalog';

import { answerRunImportRequest, type RunImportRequest } from './runImportProtocol';

// Building and importing a run record runs here so the planner stays responsive.
self.onmessage = (message: MessageEvent<RunImportRequest>) => {
  self.postMessage(answerRunImportRequest(catalog, message.data));
};

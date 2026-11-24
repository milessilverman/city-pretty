// @ts-check
import { OBSERVED_CAPABILITIES, OBSERVATION } from './contract.js';

export * from './contract.js';
export * from './mockAdapter.js';

/** @type {Record<string, string>} */
const SENTENCES = {
  design_project_json: 'StreetForge is a street design tool that saves a design as a project file with a before scene and an after scene.',
  png_export: 'A StreetForge design can be exported as a PNG image.',
  share_link: 'A StreetForge design can be shared through a link.',
  remix_link: 'A StreetForge design can be reused by someone else through a remix link.',
};

/** Plain sentences safe to show users; never more than OBSERVED_CAPABILITIES. @returns {string[]} */
export function describeCapabilities() {
  return [
    ...OBSERVED_CAPABILITIES.map((c) => SENTENCES[c]),
    `These were read from the StreetForge page source on ${OBSERVATION.observed}.`,
    'StreetForge does not provide a cost estimate, engineering quantities or funding output, so City Pretty shows those as unavailable.',
  ];
}
